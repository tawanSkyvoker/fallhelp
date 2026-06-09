/**
 * socketServer.ts
 *
 * Socket.io server สำหรับกระจาย event แบบ real-time ของ FallHelp
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เริ่มต้น Socket.io server พร้อม CORS และ transport config
 * - authenticate client ด้วย JWT ก่อนเข้า room
 * - จัด room ตาม user และ elder ที่ตรวจ ownership แล้ว
 * - emit fall, heart rate, device status และ fall lifecycle ไปยัง mobile แบบ realtime
 * - จัดการ session เดิมเมื่อ user เดียวกัน reconnect เข้ามาใหม่
 */

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import createDebug from 'debug';

import { verifyToken } from '../utils/jwt';
import prisma from '../prisma';
import { getDeviceOnlineStatus } from '../utils/deviceConnectivity';
import { isAllowedClientOrigin } from '../config/origin';

const log = createDebug('fallhelp:socket');

type AuthenticatePayload = {
  token?: string;
  userId?: string;
  elderId?: string;
};

type FallLifecycleStatus = 'FALL_SUSPECTED' | 'FALL_CONFIRMED' | 'FALL_CANCELLED';

type ElderWithDevice = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  device: {
    id: string;
    deviceCode: string;
    lastOnline: Date | null;
  } | null;
} | null;

class SocketServerManager {
  private io: Server | null = null;
  private connectedClients: Map<string, Socket> = new Map();

  // เก็บ socket ล่าสุดของแต่ละ user เพื่อให้ session ใหม่แทนที่ session เก่าได้
  private userSessions: Map<string, string> = new Map();

  initialize(httpServer: HTTPServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          if (isAllowedClientOrigin(origin)) {
            callback(null, true);
          } else {
            log('Socket CORS rejected origin: %s', origin);
            callback(new Error('Not allowed by CORS'));
          }
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],

      // ส่ง ping เป็นระยะเพื่อกัน proxy/CDN ตัด connection ที่ idle นานเกินไป
      pingInterval: 25000,
      pingTimeout: 20000,
    });

    this.io.on('connection', this.handleConnection.bind(this));

    log('Socket.io server initialized');
  }

  private handleConnection(socket: Socket): void {
    // เก็บ socket ไว้ก่อน เพื่อจัดการ authenticate/reconnect/disconnect ของ client นี้
    this.connectedClients.set(socket.id, socket);

    socket.on('authenticate', async (data: AuthenticatePayload) => {
      try {
        if (!data.token) {
          this.emitAuthenticationFailed(socket, 'Token is required');
          return;
        }

        // ตรวจ JWT ก่อนให้ client เข้า room ใด ๆ
        const decoded = this.tryVerifyToken(data.token);

        if (!decoded) {
          this.emitAuthenticationFailed(socket, 'Invalid or expired token');
          return;
        }

        const userId = decoded.userId;

        const oldSocketId = this.userSessions.get(userId);

        if (oldSocketId && oldSocketId !== socket.id) {
          const oldSocket = this.connectedClients.get(oldSocketId);

          if (oldSocket) {
            // user เดียวกันมี session ใหม่ ให้ตัด session เก่าเพื่อลด socket ซ้อน
            log('Disconnecting old session %s (replaced by %s)', oldSocketId, socket.id);
            oldSocket.disconnect(true);
            this.connectedClients.delete(oldSocketId);
          }
        }

        // บันทึก socket ปัจจุบันเป็น session หลักของ user นี้
        this.userSessions.set(userId, socket.id);

        // user room ใช้กับ event ที่ผูกกับบัญชีโดยตรง
        socket.join(`user:${userId}`);
        log('Client %s authenticated & joined room: user:%s', socket.id, userId);

        if (data.elderId) {
          // elder room ต้องตรวจ ownership ก่อนเสมอ เพื่อกัน subscribe ข้ามผู้ใช้
          const elder = await prisma.elder.findUnique({
            where: { id: data.elderId },
            include: { device: true },
          });

          this.joinOwnedElderRoom(socket, userId, data.elderId, elder);
        }

        socket.emit('authenticated', { success: true, userId });
      } catch (error) {
        log('Socket authentication error: %O', error);
        this.emitAuthenticationFailed(socket, 'Authentication failed');
      }
    });

    socket.on('disconnect', () => {
      log('Client disconnected: %s', socket.id);
      this.connectedClients.delete(socket.id);

      // ล้าง mapping ของ user ที่ผูกกับ socket นี้ เพื่อไม่ให้ session เก่าค้าง
      for (const [userId, socketId] of this.userSessions.entries()) {
        if (socketId === socket.id) {
          this.userSessions.delete(userId);
          break;
        }
      }
    });

    socket.on('ping', () => {
      // endpoint เบา ๆ สำหรับ client ทดสอบว่า socket ยังตอบสนองอยู่
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  }

  private emitAuthenticationFailed(socket: Socket, error: string): void {
    socket.emit('authenticated', { success: false, error });
  }

  private tryVerifyToken(token: string): ReturnType<typeof verifyToken> | null {
    try {
      return verifyToken(token);
    } catch {
      return null;
    }
  }

  private joinOwnedElderRoom(
    socket: Socket,
    userId: string,
    elderId: string,
    elder: ElderWithDevice,
  ): void {
    if (!elder || elder.userId !== userId) {
      log('Client %s DENIED access to elder:%s (not owner)', socket.id, elderId);
      return;
    }

    // elder room ใช้กระจาย event realtime ของผู้สูงอายุคนนั้นให้ caregiver ที่เป็นเจ้าของ
    socket.join(`elder:${elderId}`);
    log('Client %s joined room: elder:%s (ownership verified)', socket.id, elderId);

    if (!elder.device) {
      return;
    }

    // ส่งสถานะอุปกรณ์ล่าสุดทันทีหลังเข้า room เพื่อลดการรอ heartbeat รอบถัดไป
    socket.emit('device_status_update', {
      deviceId: elder.device.id,
      deviceCode: elder.device.deviceCode,
      elderId: elder.id,
      elderName: `${elder.firstName} ${elder.lastName}`,
      online: getDeviceOnlineStatus(elder.device.lastOnline) === 'ONLINE',
      timestamp: elder.device.lastOnline
        ? new Date(elder.device.lastOnline).toISOString()
        : new Date().toISOString(),
    });
  }

  emitFallDetected(data: {
    eventId: string;
    elderId: string;
    elderName: string;
    deviceId: string;
    deviceCode: string;
    timestamp: Date;
    accelerationMagnitude: number;
    bpm?: number | null;
  }): void {
    if (!this.io) return;

    log('Emitting fall detected for elder %s', data.elderId);

    // ส่งเฉพาะ client ที่อยู่ใน elder room เดียวกัน
    this.io.to(`elder:${data.elderId}`).emit('fall_detected', {
      ...data,
      timestamp: data.timestamp.toISOString(),
    });
  }

  emitEventStatusChanged(data: {
    eventId?: string;
    elderId: string;
    deviceId: string;
    deviceCode: string;
    status: FallLifecycleStatus;
    timestamp: Date;
    bpm?: number | null;
  }): void {
    if (!this.io) return;

    log('Emitting event status changed for elder %s: %s', data.elderId, data.status);

    // ใช้เป็น lifecycle signal ภายใน mobile เช่น FALL_SUSPECTED เพื่อให้ hook เตรียมตัว
    // โดยไม่จำเป็นต้องแสดงสถานะ suspected บน Dashboard
    this.io.to(`elder:${data.elderId}`).emit('event_status_changed', {
      ...data,
      timestamp: data.timestamp.toISOString(),
    });
  }

  emitHeartRateUpdate(data: {
    elderId: string;
    elderName: string;
    deviceId: string;
    deviceCode: string;
    timestamp: Date;
    heartRate: number;
    confidence?: 'none' | 'low' | 'medium' | 'high';
  }): void {
    if (!this.io) return;

    // heart rate ใช้สำหรับอัปเดต UI สด ไม่ได้แปลว่าเป็น alert เสมอไป
    this.io.to(`elder:${data.elderId}`).emit('heart_rate_update', {
      ...data,
      timestamp: data.timestamp.toISOString(),
    });
  }

  emitDeviceStatusUpdate(data: {
    deviceId: string;
    deviceCode: string;
    elderId: string;
    elderName: string;
    online: boolean;
    signalStrength?: number;
    wifiSSID?: string;
    timestamp: Date;
    source?: string;
    serverTimestamp?: string;
    deviceTimestamp?: number | null;
  }): void {
    if (!this.io) return;

    log('Emitting device status update for device %s', data.deviceCode);

    // ส่งสถานะอุปกรณ์ให้ caregiver room ของ elder คนนั้น
    this.io.to(`elder:${data.elderId}`).emit('device_status_update', {
      ...data,
      timestamp: data.timestamp.toISOString(),
    });
  }

  broadcastSystemMessage(message: string, data?: unknown): void {
    if (!this.io) return;

    log('Broadcasting system message: %s', message);

    // ใช้สำหรับประกาศกลางหรือ debug event ที่ไม่ผูกกับ user/elder เฉพาะคน
    this.io.emit('system_message', {
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  getConnectedClientsCount(): number {
    // ใช้ดูจำนวน socket ที่ยังเชื่อมต่ออยู่ตอนนี้
    return this.connectedClients.size;
  }

  close(): void {
    if (this.io) {
      this.io.close();
      this.connectedClients.clear();
      log('Socket.io server closed');
    }
  }
}

export const socketServer = new SocketServerManager();
