/**
 * useSocketConnection.ts
 *
 * Hook สำหรับจัดการ Socket.io realtime connection ของ mobile app
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เชื่อมต่อ socket หลังมี elderId และ deviceId
 * - authenticate socket ด้วย JWT token
 * - รับข้อมูล realtime ของสถานะอุปกรณ์, heart rate และ fall alert
 * - รับ fall lifecycle แบบ internal เพื่อให้แอปเตรียมรอ confirmed/cancelled
 * - sync cache ของ React Query เมื่อมีเหตุการณ์ใหม่
 * - ใช้ watchdog ตรวจข้อมูลที่เก่าเกินไปแล้วปรับสถานะอุปกรณ์
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

import { CONFIG } from '../constants/Config';
import { getToken } from '../services/tokenStorage';
import Logger from '../utils/logger';
import { getUnreadCount, listNotifications } from '../services/notificationService';
import { listEvents } from '../services/eventService';
import type { Event } from '../services/types';

import { useDeviceSetupStore } from '../store/useDeviceSetupStore';
import { useSensorStore } from '../store/useSensorStore';
import { useFallAlertStore } from '../store/useFallAlertStore';
import type { RealtimeHeartConfidence } from '../store/useSensorStore';
import { queryKeys } from './queryKeys';

const STALE_HEARTBEAT_THRESHOLD_MS = 60_000;
const STALE_DEVICE_THRESHOLD_MS = 15_000;
const WATCHDOG_CHECK_INTERVAL_MS = 1_000;
const INITIAL_OFFLINE_GRACE_MS = 8_000;
const OFFLINE_EVENT_DEBOUNCE_MS = 1_000;
const CLEAR_HEARTRATE_DEBOUNCE_MS = 6_000;
const NOTIFICATION_SYNC_DELAY_MS = 1_500;
const FALL_PENDING_GUARD_MS = 25_000;

type EventStatusChangedPayload = {
  elderId: string;
  eventId?: string;
  deviceId?: string;
  deviceCode?: string;
  status: 'FALL_SUSPECTED' | 'FALL_CONFIRMED' | 'FALL_CANCELLED';
  timestamp?: string;
  bpm?: number | null;
};

const getLastRealtimeActivityAgeMs = (
  sensorStore: ReturnType<typeof useSensorStore.getState>,
  now: number,
): number | null => {
  const lastStatusMs = sensorStore.lastStatusUpdate?.getTime() ?? 0;
  const lastHeartMs = sensorStore.lastHeartUpdate?.getTime() ?? 0;
  const lastActivity = Math.max(lastStatusMs, lastHeartMs);

  return lastActivity ? now - lastActivity : null;
};

export const useSocketConnection = () => {
  const queryClient = useQueryClient();

  // elderId/deviceId มาจาก setup store และใช้กำหนดว่าจะเชื่อม socket ของอุปกรณ์ไหน
  const elderId = useDeviceSetupStore((s) => s.elderId);
  const deviceId = useDeviceSetupStore((s) => s.deviceId);

  const socketRef = useRef<Socket | null>(null);
  const appState = useRef(AppState.currentState);

  // timer กลุ่มนี้ใช้หน่วง offline และล้างข้อมูลที่ stale โดยไม่ให้ UI กระพริบทันที
  const disconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceOfflineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHeartRateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ใช้จำจังหวะ authenticate เพื่อให้ช่วงแรกมี grace period ก่อนตัดสินว่า offline
  const socketAuthenticatedAtRef = useRef<number>(0);
  const hasSeenLiveOnlineSignalRef = useRef(false);

  // ใช้เป็น internal guard ตอน backend แจ้ง FALL_SUSPECTED
  // Dashboard ยังไม่แสดง suspected แต่ watchdog จะไม่ mark offline ระหว่างรอยืนยัน
  const fallPendingUntilRef = useRef<number | null>(null);

  const isInFallPendingWindow = useCallback((now: number): boolean => {
    return fallPendingUntilRef.current !== null && now < fallPendingUntilRef.current;
  }, []);

  const clearFallPendingWindow = useCallback(() => {
    fallPendingUntilRef.current = null;
  }, []);

  const syncNotificationBadge = useCallback(
    (reason: string) => {
      Logger.debug('[useSocketConnection] Sync badge:', { reason });

      // invalidate รายการที่เกี่ยวกับเหตุการณ์ก่อน เพื่อให้หน้าที่ใช้อยู่รู้ว่าข้อมูลกำลัง stale
      if (elderId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.initialEvents(elderId) });
      }

      void queryClient.invalidateQueries({ queryKey: ['monthlySummary'] });

      // รอ backend sync notification/event ให้เสร็จก่อนค่อย fetch ข้อมูลจริงกลับมา
      setTimeout(() => {
        void queryClient
          .fetchQuery({
            queryKey: queryKeys.unreadCount(),

            // เรียก service สำหรับดึงจำนวนแจ้งเตือนที่ยังไม่อ่าน
            // ไฟล์ถัดไป: services/notificationService.ts
            queryFn: getUnreadCount,
            staleTime: 0,
          })
          .catch((err) => Logger.warn('[useSocketConnection] Failed to fetch unread count', err));

        void queryClient
          .fetchQuery({
            queryKey: queryKeys.notifications(),
            queryFn: async () => {
              // เรียก service สำหรับดึงรายการแจ้งเตือนล่าสุด
              // ไฟล์ถัดไป: services/notificationService.ts
              const res = await listNotifications({ pageSize: 50, page: 1 });
              return res.data || [];
            },
            staleTime: 0,
          })
          .catch((err) => Logger.warn('[useSocketConnection] Failed to fetch notifications', err));

        if (elderId) {
          void queryClient
            .fetchQuery({
              queryKey: queryKeys.initialEvents(elderId),
              queryFn: async () => {
                // เรียก service สำหรับดึงเหตุการณ์ล่าสุดของผู้สูงอายุ
                // ไฟล์ถัดไป: services/eventService.ts
                const res = await listEvents({ elderId, limit: 20, page: 1 });
                return res.data || [];
              },
              staleTime: 0,
            })
            .catch((err) => Logger.warn('[useSocketConnection] Failed to fetch events', err));
        }
      }, NOTIFICATION_SYNC_DELAY_MS);
    },
    [elderId, queryClient],
  );

  const upsertInitialEventCache = useCallback(
    (event: Event) => {
      if (!elderId) return;

      // แทรก event ใหม่เข้า cache ทันที เพื่อให้หน้า Home/History เห็นเหตุการณ์ก่อน refetch จริง
      queryClient.setQueryData<Event[] | null | undefined>(
        queryKeys.initialEvents(elderId),
        (prev) => {
          const base = Array.isArray(prev) ? prev : [];
          const filtered = base.filter((evt) => evt.id !== event.id);
          const merged = [event, ...filtered];

          return merged
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 50);
        },
      );
    },
    [elderId, queryClient],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const sensorStore = useSensorStore.getState();
      const age = getLastRealtimeActivityAgeMs(sensorStore, now);
      const inFallPendingWindow = isInFallPendingWindow(now);

      // ไม่มี status/heart update นานเกิน threshold ให้ถือว่าอุปกรณ์ offline
      // ยกเว้นช่วง FALL_SUSPECTED ที่แอปกำลังรอ confirmed/cancelled จากอุปกรณ์
      if (
        age !== null &&
        age > STALE_DEVICE_THRESHOLD_MS &&
        sensorStore.isConnected &&
        !inFallPendingWindow
      ) {
        Logger.warn('Device stale: Marking OFFLINE', { age, threshold: STALE_DEVICE_THRESHOLD_MS });
        sensorStore.setIsConnected(false);
      }

      if (sensorStore.lastHeartUpdate) {
        const diff = now - sensorStore.lastHeartUpdate.getTime();

        // heart rate เก่าเกินไปแล้วให้ล้างออก เพื่อไม่ให้แสดงค่าที่ไม่สดบน dashboard
        if (diff > STALE_HEARTBEAT_THRESHOLD_MS && sensorStore.isConnected) {
          sensorStore.setHeartRate(null);
          sensorStore.setHeartConfidence(null);
        }
      }
    }, WATCHDOG_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isInFallPendingWindow]);

  useEffect(() => {
    if (!elderId || !deviceId) {
      Logger.debug('[useSocketConnection] Skip: No elder/device');
      return;
    }

    Logger.info('[useSocketConnection] Connecting:', CONFIG.SOCKET_URL);

    const socket = io(CONFIG.SOCKET_URL, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: 10000,
    });

    socketRef.current = socket;

    const connectSocket = () => {
      if (!socket.connected) socket.connect();
    };

    const handleOffline = (reason: string) => {
      if (disconnectTimeoutRef.current) clearTimeout(disconnectTimeoutRef.current);

      Logger.info(`[useSocketConnection] Offline: ${reason}`);

      // หน่วง 5 วินาทีก่อน mark socket offline เพื่อกันสถานะกระพริบจาก socket reconnect สั้น ๆ
      disconnectTimeoutRef.current = setTimeout(() => {
        const sensorStore = useSensorStore.getState();
        const age = getLastRealtimeActivityAgeMs(sensorStore, Date.now());

        // socket หลุดคือ realtime channel หลุด ไม่ใช่หลักฐานว่า ESP32 offline
        sensorStore.setSocketConnected(false);

        if (age !== null && age <= STALE_DEVICE_THRESHOLD_MS) {
          Logger.info(
            '[useSocketConnection] Socket disconnected but device signal is still fresh',
            {
              age,
              threshold: STALE_DEVICE_THRESHOLD_MS,
            },
          );
          return;
        }

        Logger.warn('[useSocketConnection] Socket disconnected and device signal is stale', {
          age,
          threshold: STALE_DEVICE_THRESHOLD_MS,
        });
      }, 5000);
    };

    const emitAuthenticate = async () => {
      try {
        // อ่าน JWT token เพื่อ authenticate socket กับ backend
        // ไฟล์ถัดไป: services/tokenStorage.ts
        const token = await getToken();

        if (!token) {
          Logger.warn('[useSocketConnection] Missing token');
          handleOffline('No Token');
          return;
        }

        socket.emit('authenticate', { token, elderId });
      } catch (err) {
        Logger.error('[useSocketConnection] Token read error', err);
        handleOffline('Token Error');
      }
    };

    socket.on('connect', () => {
      Logger.info('[useSocketConnection] Connected:', socket.id);

      if (disconnectTimeoutRef.current) clearTimeout(disconnectTimeoutRef.current);

      void emitAuthenticate();

      const sensorStore = useSensorStore.getState();

      if (sensorStore.wasEverConnected) Logger.info('[useSocketConnection] Reconnected!');

      sensorStore.setWasEverConnected(true);
    });

    socket.on('authenticated', (res: { success: boolean; error?: string }) => {
      const sensorStore = useSensorStore.getState();

      if (res.success) {
        // socket ผ่าน auth แล้ว แต่ยังรอสัญญาณ realtime จริงจากอุปกรณ์ก่อนตัดสิน online
        sensorStore.setSocketConnected(true);
        socketAuthenticatedAtRef.current = Date.now();
        hasSeenLiveOnlineSignalRef.current = false;
      } else {
        Logger.warn('[useSocketConnection] Auth failed:', res.error);
        sensorStore.setSocketConnected(false);
        sensorStore.setIsConnected(false);
      }
    });

    socket.on('disconnect', (reason) => handleOffline(reason));

    socket.on('connect_error', (err) => {
      Logger.warn('[useSocketConnection] Connect error:', err.message);
      handleOffline(`Error: ${err.message}`);
    });

    socket.on('reconnect_attempt', () => Logger.debug('[useSocketConnection] Reconnecting...'));

    socket.on(
      'device_status_update',
      (data: {
        elderId: string;
        online: boolean;
        timestamp?: string;
        signalStrength?: number;
        wifiSSID?: string;
        source?: string;
        serverTimestamp?: string;
      }) => {
        if (data.elderId !== elderId) return;
        if (data.source !== 'mqtt_status_update') return;
        if (!data.serverTimestamp || isNaN(Date.parse(data.serverTimestamp))) return;

        const ageMs = Date.now() - new Date(data.serverTimestamp).getTime();

        // ข้าม packet เก่าที่ค้างมานาน เพื่อไม่ให้ข้อมูลย้อนหลังมาเปลี่ยนสถานะปัจจุบัน
        if (ageMs > 30000) return;

        const sensorStore = useSensorStore.getState();
        sensorStore.setLastStatusUpdate(new Date());

        if (data.online === true) {
          if (deviceOfflineTimeoutRef.current) {
            clearTimeout(deviceOfflineTimeoutRef.current);
            deviceOfflineTimeoutRef.current = null;
          }

          hasSeenLiveOnlineSignalRef.current = true;
          sensorStore.setIsConnected(true);

          if (typeof data.signalStrength === 'number')
            sensorStore.setSignalStrength(data.signalStrength);

          if (typeof data.wifiSSID === 'string') sensorStore.setCurrentSSID(data.wifiSSID);

          return;
        }

        const inGracePeriod =
          !hasSeenLiveOnlineSignalRef.current &&
          socketAuthenticatedAtRef.current > 0 &&
          Date.now() - socketAuthenticatedAtRef.current < INITIAL_OFFLINE_GRACE_MS;

        // หลัง authenticate ใหม่ ๆ ยังไม่ตัดสิน offline ทันที เพื่อรอสัญญาณ online แรกจากอุปกรณ์
        if (inGracePeriod) return;

        // ระหว่าง FALL_SUSPECTED ให้ข้าม offline event ชั่วคราว เพราะอุปกรณ์กำลังอยู่ใน flow รอยืนยัน
        if (isInFallPendingWindow(Date.now())) return;

        if (deviceOfflineTimeoutRef.current) clearTimeout(deviceOfflineTimeoutRef.current);

        // debounce offline จาก MQTT เพื่อกัน offline สั้น ๆ ทำให้ dashboard กระพริบ
        deviceOfflineTimeoutRef.current = setTimeout(() => {
          const sensorStore = useSensorStore.getState();

          if (isInFallPendingWindow(Date.now())) {
            deviceOfflineTimeoutRef.current = null;
            return;
          }

          sensorStore.setIsConnected(false);
          sensorStore.setHeartRate(null);
          sensorStore.setSignalStrength(null);

          deviceOfflineTimeoutRef.current = null;
        }, OFFLINE_EVENT_DEBOUNCE_MS);
      },
    );

    socket.on(
      'heart_rate_update',
      (data: { elderId: string; heartRate: number; confidence?: string }) => {
        if (data.elderId !== elderId) return;

        const sensorStore = useSensorStore.getState();

        // รับ heart rate เฉพาะตอน socket และ device online แล้ว
        if (!sensorStore.isConnected || !sensorStore.socketConnected) return;

        // กันข้อมูล BPM ที่ผิดช่วง หรือ confidence ที่ไม่อยู่ในค่าที่รองรับ
        if (typeof data.heartRate !== 'number' || data.heartRate < 0 || data.heartRate > 250)
          return;

        if (data.confidence && !['none', 'low', 'medium', 'high'].includes(data.confidence)) {
          return;
        }

        if (data.heartRate === 0) {
          sensorStore.setLastHeartUpdate(new Date());

          if (!clearHeartRateTimeoutRef.current) {
            // 0 BPM อาจเป็นจังหวะ sensor อ่านไม่ได้ชั่วคราว จึงรอก่อนล้างค่าเดิม
            clearHeartRateTimeoutRef.current = setTimeout(() => {
              const s = useSensorStore.getState();

              s.setHeartRate(null);
              s.setHeartConfidence(null);

              clearHeartRateTimeoutRef.current = null;
            }, CLEAR_HEARTRATE_DEBOUNCE_MS);
          }

          return;
        }

        if (clearHeartRateTimeoutRef.current) {
          clearTimeout(clearHeartRateTimeoutRef.current);
          clearHeartRateTimeoutRef.current = null;
        }

        const currentHr = sensorStore.heartRate;

        // ข้าม spike ที่กระโดดแรงเกินไป เพื่อไม่ให้ UI แสดงค่าหัวใจผิดปกติชั่วขณะ
        if (currentHr !== null && currentHr !== 0 && Math.abs(data.heartRate - currentHr) > 50)
          return;

        if (deviceOfflineTimeoutRef.current) {
          clearTimeout(deviceOfflineTimeoutRef.current);
          deviceOfflineTimeoutRef.current = null;
        }

        hasSeenLiveOnlineSignalRef.current = true;
        sensorStore.setLastHeartUpdate(new Date());
        sensorStore.setIsConnected(true);
        sensorStore.setHeartConfidence((data.confidence as RealtimeHeartConfidence) ?? null);

        if (currentHr !== data.heartRate) sensorStore.setHeartRate(data.heartRate);
      },
    );

    socket.on('event_status_changed', (data: EventStatusChangedPayload) => {
      if (data.elderId !== elderId) return;

      Logger.info('[useSocketConnection] Event status changed:', data.status);

      const sensorStore = useSensorStore.getState();
      const fallStore = useFallAlertStore.getState();

      // lifecycle event มาจาก MQTT ผ่าน backend จึงถือว่าอุปกรณ์ยังมี activity
      sensorStore.setLastStatusUpdate(new Date());
      sensorStore.setIsConnected(true);
      hasSeenLiveOnlineSignalRef.current = true;

      if (deviceOfflineTimeoutRef.current) {
        clearTimeout(deviceOfflineTimeoutRef.current);
        deviceOfflineTimeoutRef.current = null;
      }

      if (data.status === 'FALL_SUSPECTED') {
        // ใช้เป็น internal guard เท่านั้น ไม่ setFallStatus('FALL') และไม่แสดง suspected บน Dashboard
        fallPendingUntilRef.current = Date.now() + FALL_PENDING_GUARD_MS;
        return;
      }

      if (data.status === 'FALL_CANCELLED') {
        clearFallPendingWindow();

        // cancelled คือจบ pending flow โดยไม่มี alert ให้ผู้ดูแล
        fallStore.setFallStatus('NORMAL');
        fallStore.setLastFallUpdate(new Date(data.timestamp || new Date().toISOString()));
        fallStore.setActiveFallEventId(null);
        fallStore.setActiveFallBpm(undefined);

        return;
      }

      if (data.status === 'FALL_CONFIRMED') {
        // fall_detected handler จะเป็นตัว setFallStatus('FALL') และเติมข้อมูล event
        clearFallPendingWindow();
      }
    });

    socket.on(
      'fall_detected',
      (data: {
        elderId: string;
        eventId: string;
        deviceId: string;
        timestamp: string;
        bpm?: number | null;
      }) => {
        if (data.elderId !== elderId) return;

        clearFallPendingWindow();

        // เพิ่ม unread badge ทันที เพื่อให้ UI ตอบสนองก่อน backend sync เสร็จ
        queryClient.setQueryData<number>(queryKeys.unreadCount(), (prev) => (prev ?? 0) + 1);

        const fallStore = useFallAlertStore.getState();

        // บันทึกสถานะ fall ลง store เพื่อให้หน้า dashboard แสดง alert ทันที
        fallStore.setFallStatus('FALL');
        fallStore.setLastFallUpdate(new Date(data.timestamp || new Date().toISOString()));
        fallStore.setActiveFallBpm(
          typeof data.bpm === 'number' ? data.bpm : data.bpm === null ? null : undefined,
        );

        if (data.eventId) {
          upsertInitialEventCache({
            id: data.eventId,
            elderId: data.elderId,
            deviceId: data.deviceId,
            fallStage: 'CONFIRMED',
            bpm: data.bpm ?? null,
            timestamp: data.timestamp,
          });

          fallStore.setActiveFallEventId(data.eventId);
        }

        syncNotificationBadge('fall_detected');

        if (deviceOfflineTimeoutRef.current) {
          clearTimeout(deviceOfflineTimeoutRef.current);
          deviceOfflineTimeoutRef.current = null;
        }

        // มี fall event แปลว่ายังได้รับข้อมูลจากอุปกรณ์ จึง mark online ไปพร้อมกัน
        hasSeenLiveOnlineSignalRef.current = true;

        const sensorStore = useSensorStore.getState();
        sensorStore.setLastStatusUpdate(new Date());
        sensorStore.setIsConnected(true);
      },
    );

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        Logger.info('[useSocketConnection] App Foreground');

        // กลับเข้า foreground แล้ว authenticate ใหม่ เพื่อ refresh room/session ของ socket
        if (socket.connected) void emitAuthenticate();
        else connectSocket();
      }

      appState.current = nextState;
    });

    return () => {
      Logger.debug('[useSocketConnection] Cleanup');

      subscription.remove();
      socket.disconnect();
      socket.removeAllListeners();
      socketRef.current = null;
      clearFallPendingWindow();

      if (disconnectTimeoutRef.current) clearTimeout(disconnectTimeoutRef.current);
      if (deviceOfflineTimeoutRef.current) clearTimeout(deviceOfflineTimeoutRef.current);
      if (clearHeartRateTimeoutRef.current) clearTimeout(clearHeartRateTimeoutRef.current);
    };
  }, [
    elderId,
    deviceId,
    syncNotificationBadge,
    upsertInitialEventCache,
    queryClient,
    isInFallPendingWindow,
    clearFallPendingWindow,
  ]);

  const reconnect = useCallback(() => {
    const socket = socketRef.current;

    if (socket && elderId) {
      if (socket.connected) {
        // ถ้า socket ต่ออยู่แล้ว ให้ re-authenticate แทนการ reconnect ใหม่
        void getToken().then((token) => {
          if (token) socket.emit('authenticate', { token, elderId });
        });
      } else {
        socket.connect();
      }
    }
  }, [elderId]);

  const disconnect = useCallback(() => {
    Logger.info('[useSocketConnection] Manual disconnect');

    const socket = socketRef.current;

    if (socket) socket.disconnect();

    clearFallPendingWindow();

    // manual disconnect ใช้ตอนออกจาก session จึงต้องล้าง store ที่ผูกกับ device/realtime ด้วย
    useDeviceSetupStore.getState().clearConfig();
    useSensorStore.getState().resetSensorState();
    useFallAlertStore.getState().resetFallAlertState();

    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }

    if (deviceOfflineTimeoutRef.current) {
      clearTimeout(deviceOfflineTimeoutRef.current);
      deviceOfflineTimeoutRef.current = null;
    }

    if (clearHeartRateTimeoutRef.current) {
      clearTimeout(clearHeartRateTimeoutRef.current);
      clearHeartRateTimeoutRef.current = null;
    }
  }, [clearFallPendingWindow]);

  return {
    reconnect,
    disconnect,
  };
};
