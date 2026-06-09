/**
 * mqttClient.ts
 *
 * ศูนย์กลางรับ/ส่งข้อความ MQTT ระหว่าง backend กับอุปกรณ์ ESP32
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เชื่อมต่อ MQTT broker และ subscribe topic ที่เกี่ยวกับอุปกรณ์
 * - parse payload จาก MQTT แล้ว route ไปยัง handler ที่ถูกต้อง
 * - guard อุปกรณ์ที่ถูก unpair แล้วไม่ให้ส่ง event เข้า business flow
 * - publish config/RESET_WIFI ไปยังอุปกรณ์
 * - รอ config ACK ด้วย requestId และจัดการ timeout/cancel
 */

import mqtt, { MqttClient } from 'mqtt';
import createDebug from 'debug';
import crypto from 'crypto';

import { fallHandler } from './handlers/fallHandler';
import { fallCancelledHandler } from './handlers/fallCancelledHandler';
import { heartRateHandler } from './handlers/heartRateHandler';
import { statusHandler } from './handlers/statusHandler';

import { MQTT_TOPICS, DeviceConfigAckPayload } from './topics';

import prisma from '../prisma';
import { backendEnv } from '../config/env';
import { normalizeUnifiedEvent } from './eventNormalizer';

interface PendingConfigAck {
  resolve: (payload: DeviceConfigAckPayload) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
}

interface PublishOptions {
  readonly qos?: 0 | 1 | 2;
  readonly retain?: boolean;
}

const SENSITIVE_CONFIG_KEYS = new Set(['wifiPassword', 'password', 'wifiSSID', 'ssid']);

class MQTTClientManager {
  private client: MqttClient | null = null;
  private isConnected: boolean = false;
  private log = createDebug('fallhelp:mqtt');
  private logMsg = createDebug('fallhelp:mqtt:msg');
  private pendingConfigAcks = new Map<string, PendingConfigAck>();

  async connect(): Promise<void> {
    if (backendEnv.mqttDisabled) {
      this.log('🚫 MQTT is disabled by configuration');
      return;
    }

    const brokerUrl = backendEnv.mqttBrokerUrl;
    const clientId = `fallhelp-backend-${Math.random().toString(16).slice(2, 10)}`;
    const protocolVersion = 4 as const;
    const protocolLabel = 'MQTT 3.1.1';

    const options: mqtt.IClientOptions = {
      clientId,
      clean: true,
      protocolVersion,
      connectTimeout: 15000,
      reconnectPeriod: 2000,
      rejectUnauthorized: true,
      ...(backendEnv.mqttUsername ? { username: backendEnv.mqttUsername } : {}),
      ...(backendEnv.mqttPassword ? { password: backendEnv.mqttPassword } : {}),
    };

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        this.log('✅ MQTT Client connected to broker (%s)', protocolLabel);

        this.isConnected = true;
        this.subscribeToTopics();

        resolve();
      });

      this.client.on('error', (error) => {
        this.log('❌ MQTT Connection error: %O', error);

        this.isConnected = false;
        this.rejectAllPendingConfigAcks(new Error('MQTT connection error while waiting for ACK'));

        reject(error);
      });

      this.client.on('offline', () => {
        this.log('⚠️ MQTT Client offline');

        this.isConnected = false;
        this.rejectAllPendingConfigAcks(
          new Error('MQTT client went offline while waiting for ACK'),
        );
      });

      this.client.on('reconnect', () => {
        this.log('🔄 MQTT Client reconnecting...');
      });

      this.client.on(
        'message',
        (topic, payload, packet) => void this.handleMessage(topic, payload, packet),
      );
    });
  }

  private subscribeToTopics(): void {
    if (!this.client) return;

    const topics = [
      MQTT_TOPICS.HEART_RATE_WILDCARD,
      MQTT_TOPICS.DEVICE_STATUS_WILDCARD,
      MQTT_TOPICS.DEVICE_EVENTS_WILDCARD,
      MQTT_TOPICS.CONFIG_ACK_WILDCARD,
      MQTT_TOPICS.EVENTS_WILDCARD,
      MQTT_TOPICS.DEVICE_LWT_WILDCARD,
    ];

    topics.forEach((topic) => {
      const client = this.client;

      if (!client) return;

      client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          this.log('❌ Failed to subscribe to %s: %O', topic, error);
        } else {
          this.log('📡 Subscribed to %s', topic);
        }
      });
    });
  }

  private async handleMessage(
    topic: string,
    payload: Buffer,
    packet: mqtt.IPublishPacket,
  ): Promise<void> {
    try {
      const message = payload.toString();

      this.logMsg('Message received on %s: %s', topic, message);

      let data: Record<string, unknown>;

      try {
        data = JSON.parse(message);
      } catch {
        this.logMsg('Invalid JSON payload on topic %s: %s', topic, message);
        return;
      }

      const deviceId = this.extractDeviceId(topic);

      if (!deviceId) {
        this.log('Could not extract deviceId from topic: %s', topic);
        return;
      }

      if (!this.isConfigAckTopic(topic)) {
        // guard นี้กัน ghost device ที่ยังค้าง WiFi/MQTT หลังถูก unpair หรือโดนลบออกจากฐานข้อมูลแล้ว
        const device = await prisma.device.findFirst({
          where: { serialNumber: deviceId },
          select: { status: true, elderId: true },
        });

        if (!device || device.status === 'UNPAIRED' || !device.elderId) {
          const reason = !device
            ? 'DEVICE_NOT_FOUND'
            : device.status === 'UNPAIRED'
              ? 'DEVICE_UNPAIRED'
              : 'DEVICE_UNPAIRED_NO_ELDER';
          this.log('🚫 Rejected event from %s device %s (topic: %s)', reason, deviceId, topic);

          void this.publish(
            MQTT_TOPICS.getConfigTopic(deviceId),
            {
              action: 'RESET_NVS',
              reason,
              deviceSerial: deviceId,
              requestId: crypto.randomUUID(),
            },
            { retain: true },
          ).catch((err) => {
            this.log(
              '⚠️ Failed to send retained RESET_NVS to %s device %s: %O',
              reason.toLowerCase(),
              deviceId,
              err,
            );
          });

          return;
        }
      }

      if (this.isConfigAckTopic(topic)) {
        this.handleConfigAck(deviceId, data);
      } else if (topic.startsWith('events/') || topic.endsWith('/event')) {
        // unified event หลักจาก firmware ปัจจุบัน
        // ไฟล์ถัดไป: iot/eventNormalizer.ts
        await this.handleUnifiedEvent(deviceId, data);
      } else if (topic.includes('/heartrate')) {
        // legacy heart-rate topic สำหรับ backward compatibility
        // ไฟล์ถัดไป: iot/handlers/heartRateHandler.ts
        await heartRateHandler(deviceId, data);
      } else if (topic.includes('/lwt')) {
        this.log('💀 LWT received for device %s — marking OFFLINE immediately', deviceId);

        // LWT มาจาก broker เมื่ออุปกรณ์ disconnect ผิดปกติ
        // ไฟล์ถัดไป: iot/handlers/statusHandler.ts
        await statusHandler(deviceId, { online: false, timestamp: Date.now(), lwt: true });
      } else if (topic.includes('/status')) {
        // retained status เป็น cache เก่าจาก broker ไม่ใช่ live heartbeat จึงต้องข้าม
        if (packet.retain) {
          this.log(
            '⏭️ Skipping retained /status message for %s (stale broker cache, not a live update)',
            deviceId,
          );
          return;
        }

        // ไฟล์ถัดไป: iot/handlers/statusHandler.ts
        await statusHandler(deviceId, data);
      } else {
        this.log('Unknown topic: %s', topic);
      }
    } catch (error) {
      // จับ error ต่อ message เพื่อไม่ให้ consumer ทั้งตัวล้มจาก payload เดียว
      this.log('Error handling MQTT message: %O', error);
    }
  }

  private async handleUnifiedEvent(deviceId: string, data: Record<string, unknown>): Promise<void> {
    const normalizedEvent = normalizeUnifiedEvent(data);

    switch (normalizedEvent.kind) {
      case 'invalid':
        if (normalizedEvent.reason === 'missing_type') {
          this.log('⚠️ Unified event missing type from %s: %O', deviceId, data);
        } else if (normalizedEvent.reason === 'invalid_fall_payload') {
          this.log('❌ Invalid fall payload from %s: %O', deviceId, data);
        } else {
          this.log('❌ Invalid heart rate event payload from %s: %O', deviceId, data);
        }
        return;

      case 'fall':
        this.log('🚨 %s event received from %s', normalizedEvent.eventType.toUpperCase(), deviceId);

        await fallHandler(deviceId, normalizedEvent.payload, { mode: normalizedEvent.mode });
        return;

      case 'heartRate':
        this.log(
          '❤️ HEART RATE EVENT received from %s (BPM: %d)',
          deviceId,
          normalizedEvent.payload.heartRate,
        );

        await heartRateHandler(deviceId, normalizedEvent.payload);
        return;

      case 'fallCancelled':
        this.log('🟢 FALL CANCELLED received from %s', deviceId);

        await fallCancelledHandler(deviceId);
        return;

      case 'unknown':
        this.log('ℹ️ Unknown unified event type from %s: %s', deviceId, normalizedEvent.eventType);
        return;
    }
  }

  private handleConfigAck(deviceId: string, payload: Record<string, unknown>): void {
    const rawRequestId = payload['requestId'];
    const requestId = typeof rawRequestId === 'string' ? rawRequestId : '';

    if (!requestId) {
      this.log('⚠️ Config ACK missing requestId from device %s: %O', deviceId, payload);
      return;
    }

    const key = this.getConfigAckKey(deviceId, requestId);

    const ackPayload: DeviceConfigAckPayload = {
      requestId,
      success: payload['success'] === true,
      timestamp:
        typeof payload['timestamp'] === 'number' || typeof payload['timestamp'] === 'string'
          ? payload['timestamp']
          : Date.now(),
      ...(typeof payload['reason'] === 'string' ? { reason: payload['reason'] } : {}),
      ...(typeof payload['ip'] === 'string' ? { ip: payload['ip'] } : {}),
    };

    const pending = this.pendingConfigAcks.get(key);

    if (!pending) {
      // ถ้าเป็น ACK ของ RESET_WIFI หรือ RESET_NVS ที่ไม่มี waiter แล้ว ให้ล้าง retained command ได้เลย
      if (
        ackPayload.success &&
        (ackPayload.reason === 'RESET_WIFI_ACCEPTED' || ackPayload.reason === 'RESET_NVS_ACCEPTED')
      ) {
        void this.clearRetainedConfigCommand(deviceId).catch((error) => {
          this.log('⚠️ Failed to clear retained reset command for %s: %O', deviceId, error);
        });
      }

      this.log('ℹ️ Config ACK received but no pending waiter for %s', key);
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pendingConfigAcks.delete(key);

    this.log('📥 Config ACK received for %s: %O', key, ackPayload);

    if (
      ackPayload.success &&
      (ackPayload.reason === 'RESET_WIFI_ACCEPTED' || ackPayload.reason === 'RESET_NVS_ACCEPTED')
    ) {
      void this.clearRetainedConfigCommand(deviceId).catch((error) => {
        this.log('⚠️ Failed to clear retained reset command for %s: %O', deviceId, error);
      });
    }

    if (!ackPayload.success) {
      pending.reject(new Error(ackPayload.reason || 'Device rejected config update'));
      return;
    }

    pending.resolve(ackPayload);
  }

  private extractDeviceId(topic: string): string | null {
    const parts = topic.split('/');

    // topic หลักขึ้นต้นด้วย device/{serialNumber}/... หรือ events/{serialNumber}
    if (parts.length >= 2 && (parts[0] === 'device' || parts[0] === 'events')) {
      return parts[1] ?? null;
    }

    return null;
  }

  private isConfigAckTopic(topic: string): boolean {
    return topic.includes('/config/ack');
  }

  async publish(
    topic: string,
    message: string | object,
    options: PublishOptions = {},
  ): Promise<void> {
    if (!this.client || !this.isConnected) {
      this.log('⚠️ MQTT Client not connected');
      throw new Error('MQTT client is not connected');
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    const redactedPayload = JSON.stringify(this.redactForLog(message));

    const client = this.client;

    await new Promise<void>((resolve, reject) => {
      client.publish(
        topic,
        payload,
        { qos: options.qos ?? 1, retain: options.retain ?? false },
        (error) => {
          if (error) {
            this.log('❌ Failed to publish to %s: %O', topic, error);
            reject(error);
          } else {
            // log แบบ redacted เพื่อไม่ให้ SSID/password หลุดใน log
            if (payload === '' && options.retain === true) {
              this.log('📤 Published retained clear to %s', topic);
            } else {
              this.log('📤 Published to %s: %s', topic, redactedPayload);
            }
            resolve();
          }
        },
      );
    });
  }

  async clearRetainedConfigCommand(deviceId: string): Promise<void> {
    // publish payload ว่างพร้อม retain=true คือการล้าง retained message ของ topic นั้น
    await this.publish(MQTT_TOPICS.getConfigTopic(deviceId), '', { retain: true });

    this.log('🧹 Cleared retained config command for %s', deviceId);
  }

  waitForConfigAck(
    deviceId: string,
    requestId: string,
    timeoutMs: number = 15000,
  ): Promise<DeviceConfigAckPayload> {
    const normalizedRequestId = requestId.trim();

    if (!normalizedRequestId) {
      return Promise.reject(new Error('requestId is required for config ACK waiting'));
    }

    const key = this.getConfigAckKey(deviceId, normalizedRequestId);

    if (this.pendingConfigAcks.has(key)) {
      return Promise.reject(new Error(`Config ACK already pending for ${key}`));
    }

    return new Promise<DeviceConfigAckPayload>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingConfigAcks.delete(key);
        reject(new Error(`Timed out waiting for config ACK (${key})`));
      }, timeoutMs);

      // เก็บ waiter ไว้จนกว่าจะมี ACK topic ตอบกลับด้วย requestId เดียวกัน
      this.pendingConfigAcks.set(key, { resolve, reject, timeoutId });
    });
  }

  cancelConfigAckWait(deviceId: string, requestId: string): void {
    const key = this.getConfigAckKey(deviceId, requestId);
    const pending = this.pendingConfigAcks.get(key);

    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pendingConfigAcks.delete(key);
    pending.reject(new Error(`Config ACK wait cancelled (${key})`));
  }

  private getConfigAckKey(deviceId: string, requestId: string): string {
    return `${deviceId}:${requestId}`;
  }

  private rejectAllPendingConfigAcks(error: Error): void {
    // ถ้า MQTT หลุด ต้อง reject waiter ทั้งหมด เพื่อไม่ให้ request ค้างจน timeout เอง
    for (const pending of this.pendingConfigAcks.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }

    this.pendingConfigAcks.clear();
  }

  private redactForLog(message: string | object): unknown {
    if (typeof message === 'string') {
      return message;
    }

    return this.redactObject(message as Record<string, unknown>);
  }

  private redactObject(input: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_CONFIG_KEYS.has(key)) {
        redacted[key] = '***';
        continue;
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        redacted[key] = this.redactObject(value as Record<string, unknown>);
        continue;
      }

      if (Array.isArray(value)) {
        redacted[key] = value.map((item) => {
          if (item && typeof item === 'object') {
            return this.redactObject(item as Record<string, unknown>);
          }

          return item;
        });
        continue;
      }

      redacted[key] = value;
    }

    return redacted;
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }

      this.client.end(false, {}, () => {
        this.log('🔌 MQTT Client disconnected');

        this.isConnected = false;
        this.rejectAllPendingConfigAcks(new Error('MQTT client disconnected'));

        resolve();
      });
    });
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }
}

export const mqttClient = new MQTTClientManager();
