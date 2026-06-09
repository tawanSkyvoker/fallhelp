/**
 * fallHandler.ts
 *
 * Handler สำหรับ MQTT event การตรวจจับการล้ม
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - validate fall payload จาก ESP32
 * - dedup event เพื่อกัน MQTT retransmit ซ้ำ
 * - สร้าง pending event เมื่อเป็น suspected_fall
 * - emit FALL_SUSPECTED เป็น internal lifecycle signal ให้ mobile เตรียมตัว
 * - confirm pending event หรือสร้าง confirmed event ใหม่เมื่อเป็น fall_confirmed
 * - emit realtime alert และสร้าง notification หลังยืนยันการล้มแล้วเท่านั้น
 */

import { validateFallPayload } from '../payloadValidator';
import { FallDetectionPayload } from '../topics';

import { createEvent, findPendingFallEvent, confirmPendingFallEvent } from '../../services/eventService';
import { findDeviceBySerial } from '../../services/deviceService';
import { notifyFallDetection } from '../../services/notificationService';
import { socketServer } from '../../realtime/socketServer';

import createDebug from 'debug';

const log = createDebug('fallhelp:mqtt:fall');

export type FallHandlingMode = 'suspected' | 'confirmed';

interface FallHandlerOptions {
  mode?: FallHandlingMode;
}

// เก็บเวลาของ fall event ล่าสุดเพื่อกัน MQTT ส่งข้อมูลซ้ำจาก retransmit
const recentFallEvents = new Map<string, number>();
const FALL_DEDUP_PERIOD_MS = 30_000;
const FALL_PENDING_DEDUP_PERIOD_MS = 15_000;

function getDedupKey(deviceId: string, mode: FallHandlingMode): string {
  return `${mode}:${deviceId}`;
}

function getDedupPeriod(mode: FallHandlingMode): number {
  return mode === 'suspected' ? FALL_PENDING_DEDUP_PERIOD_MS : FALL_DEDUP_PERIOD_MS;
}

function isDuplicateFall(deviceId: string, mode: FallHandlingMode): boolean {
  const now = Date.now();
  const key = getDedupKey(deviceId, mode);
  const periodMs = getDedupPeriod(mode);
  const lastFall = recentFallEvents.get(key);

  if (lastFall && now - lastFall < periodMs) {
    return true;
  }

  recentFallEvents.set(key, now);

  if (recentFallEvents.size > 1000) {
    for (const [entryKey, timestamp] of recentFallEvents) {
      if (now - timestamp > FALL_DEDUP_PERIOD_MS) {
        recentFallEvents.delete(entryKey);
      }
    }
  }

  return false;
}

export function _resetFallDedup(): void {
  recentFallEvents.clear();
}

function getElderName(device: { elder: { firstName: string; lastName: string } | null }): string {
  return device.elder ? `${device.elder.firstName} ${device.elder.lastName}` : 'Unknown';
}

function resolveBpmFromPayload(payload: FallDetectionPayload): number | null {
  // 0/null/undefined หมายถึงไม่มีสัญญาณ BPM ที่ใช้ได้ ณ ตอนล้ม
  if (payload.bpm === null || payload.bpm === undefined) return null;
  if (payload.bpm === 0) return null;

  return payload.bpm;
}

export async function fallHandler(
  deviceId: string,
  data: unknown,
  options: FallHandlerOptions = {},
): Promise<void> {
  try {
    const mode: FallHandlingMode = options.mode ?? 'confirmed';

    const payload = validateFallPayload(data);

    if (!payload) {
      log('❌ Invalid fall detection payload from device %s: %O', deviceId, data);
      return;
    }

    if (isDuplicateFall(deviceId, mode)) {
      log('⚠️ Duplicate %s event ignored for device %s', mode, deviceId);
      return;
    }

    // ไฟล์ถัดไป: services/deviceService.ts
    const device = await findDeviceBySerial(deviceId);

    if (!device) {
      log('❌ Device %s not found', deviceId);
      return;
    }

    if (!device.elderId) {
      log('❌ Device %s not paired with any elder', deviceId);
      return;
    }

    if (mode === 'suspected') {
      log('⏳ Suspected fall for device %s: %O', deviceId, payload);

      const heartRateAtSuspected = resolveBpmFromPayload(payload);

      // ตรวจ pending event เดิมก่อน เพื่อไม่สร้าง suspected ซ้ำในช่วงเดียวกัน
      // ไฟล์ถัดไป: services/eventService.ts
      const existingPending = await findPendingFallEvent(device.id);

      if (existingPending) {
        log(
          '⚠️ Pending fall already exists for device %s, skip duplicate suspected event',
          deviceId,
        );
        return;
      }

      // suspected_fall บันทึก lifecycle ไว้ใน DB เท่านั้น ยังไม่แจ้งเตือน caregiver
      // ไฟล์ถัดไป: services/eventService.ts
      const pendingEvent = await createEvent({
        elderId: device.elderId,
        deviceId: device.id,
        fallStage: 'PENDING_CONFIRMATION',
        ...(heartRateAtSuspected !== null ? { bpm: heartRateAtSuspected } : {}),
        magnitude: payload.magnitude,
        postureDelta: payload.postureDelta,
        timestamp: new Date(),
      });

      // ส่ง lifecycle signal ให้ mobile เตรียมรอ confirmed/cancelled ภายในเท่านั้น
      // Dashboard ยังไม่แสดง alert จนกว่าจะได้รับ fall_detected
      // ไฟล์ถัดไป: realtime/socketServer.ts
      socketServer.emitEventStatusChanged({
        eventId: pendingEvent.id,
        elderId: device.elderId,
        deviceId: device.id,
        deviceCode: device.deviceCode,
        status: 'FALL_SUSPECTED',
        timestamp: pendingEvent.timestamp,
        bpm: heartRateAtSuspected,
      });

      log('✅ Pending fall event persisted and internal lifecycle emitted: %s', pendingEvent.id);
      return;
    }

    log('🚨 Fall confirmed for device %s: %O', deviceId, payload);

    // เมื่อยืนยันแล้ว ให้หา pending event ล่าสุดมา update เป็น CONFIRMED ก่อน
    // ไฟล์ถัดไป: services/eventService.ts
    const pendingEvent = await findPendingFallEvent(device.id);

    if (pendingEvent) {
      // BPM ณ ตอน suspected_fall คือชีพจรขณะ impact จริง — ใช้เป็นหลัก
      // fall_confirmed ส่งมา 15 วินาทีทีหลัง ซึ่ง heart rate อาจ recover ไปแล้ว
      const bpmAtImpact = pendingEvent.bpm ?? resolveBpmFromPayload(payload);

      // ไฟล์ถัดไป: services/eventService.ts
      const updatedEvent = await confirmPendingFallEvent(pendingEvent.id, {
        magnitude: payload.magnitude,
        postureDelta: payload.postureDelta,
      });

      // emit realtime ไปยัง mobile หลังยืนยัน fall แล้วเท่านั้น
      // ไฟล์ถัดไป: realtime/socketServer.ts
      socketServer.emitFallDetected({
        eventId: updatedEvent.id,
        elderId: device.elderId,
        elderName: getElderName(device),
        deviceId: device.id,
        deviceCode: device.deviceCode,
        timestamp: updatedEvent.timestamp,
        accelerationMagnitude: payload.magnitude,
        bpm: bpmAtImpact,
      });

      // lifecycle signal นี้ใช้ clear pending guard ฝั่ง mobile
      socketServer.emitEventStatusChanged({
        eventId: updatedEvent.id,
        elderId: device.elderId,
        deviceId: device.id,
        deviceCode: device.deviceCode,
        status: 'FALL_CONFIRMED',
        timestamp: updatedEvent.timestamp,
        bpm: bpmAtImpact,
      });

      // สร้าง in-app notification และพยายามส่ง push
      // ไฟล์ถัดไป: services/notificationService.ts
      await notifyFallDetection(device.elderId, updatedEvent.id, bpmAtImpact);

      log('✅ Pending fall event confirmed: %s', updatedEvent.id);
      return;
    }

    // fallback สำหรับ flow เก่าหรือกรณี pending event หายไปก่อน confirmed
    const heartRateAtFall = resolveBpmFromPayload(payload);

    const event = await createEvent({
      elderId: device.elderId,
      deviceId: device.id,
      fallStage: 'CONFIRMED',
      ...(heartRateAtFall !== null ? { bpm: heartRateAtFall } : {}),
      magnitude: payload.magnitude,
      postureDelta: payload.postureDelta,
      timestamp: new Date(),
    });

    socketServer.emitFallDetected({
      eventId: event.id,
      elderId: device.elderId,
      elderName: getElderName(device),
      deviceId: device.id,
      deviceCode: device.deviceCode,
      timestamp: event.timestamp,
      accelerationMagnitude: payload.magnitude,
      bpm: heartRateAtFall,
    });

    socketServer.emitEventStatusChanged({
      eventId: event.id,
      elderId: device.elderId,
      deviceId: device.id,
      deviceCode: device.deviceCode,
      status: 'FALL_CONFIRMED',
      timestamp: event.timestamp,
      bpm: heartRateAtFall,
    });

    await notifyFallDetection(device.elderId, event.id, heartRateAtFall);

    log('✅ Direct fall event created and notified: %s', event.id);
  } catch (error) {
    // จับ error ระดับ handler เพื่อไม่ให้ MQTT consumer ล้มจาก fall message เดียว
    log('❌ Error handling fall detection: %O', error);
  }
}
