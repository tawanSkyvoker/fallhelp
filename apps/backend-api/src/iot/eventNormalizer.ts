/**
 * eventNormalizer.ts
 *
 * Helper สำหรับแปลง unified MQTT event จาก firmware ให้เป็น backend event shape กลาง
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - normalize ชื่อ event และชื่อ field จาก firmware หลายรูปแบบ
 * - map payload เป็น fall, heartRate หรือ fallCancelled
 * - ตรวจ field สำคัญเบื้องต้นก่อนส่งต่อให้ handler จริง
 * - คืนผลลัพธ์แบบ invalid/unknown เพื่อให้ mqttClient log สาเหตุได้ชัดเจน
 */

import { HEART_RATE_PAYLOAD_BPM_MAX } from './payloadValidator';
import { FallDetectionPayload, HeartRatePayload } from './topics';

interface ArduinoEventPayload {
  type?: string;
  bpm?: number;
  heartRate?: number;
  alertType?: string;
  event?: string;
  timestamp?: number | string;
  magnitude?: number;
  postureDelta?: number;
  postureDeltaDeg?: number;
  orientationDeltaDeg?: number;
}

export type UnifiedMqttEvent =
  | {
      readonly kind: 'fall';
      readonly eventType: string;
      readonly mode: 'suspected' | 'confirmed';
      readonly payload: FallDetectionPayload;
    }
  | {
      readonly kind: 'heartRate';
      readonly eventType: string;
      readonly payload: HeartRatePayload;
    }
  | {
      readonly kind: 'fallCancelled';
      readonly eventType: string;
    }
  | {
      readonly kind: 'invalid';
      readonly eventType: string;
      readonly reason: 'missing_type' | 'invalid_fall_payload' | 'invalid_heart_rate_payload';
    }
  | {
      readonly kind: 'unknown';
      readonly eventType: string;
    };

function normalizeEventType(eventType: unknown): string {
  // normalize ชื่อ event ให้เทียบกันได้ แม้ firmware ส่ง casing หรือช่องว่างต่างกัน
  if (typeof eventType !== 'string') return '';

  return eventType.trim().toLowerCase();
}

function readNumericField(value: unknown): number | null {
  // firmware บาง version ส่งตัวเลขมาเป็น string จึงอ่านแบบยืดหยุ่นก่อน validate ต่อ
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function readIntegerField(value: unknown): number | null {
  const parsed = readNumericField(value);

  if (parsed === null || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function mapFallPayload(eventPayload: ArduinoEventPayload): FallDetectionPayload | null {
  const magnitude = readNumericField(eventPayload.magnitude);

  if (magnitude === null) {
    return null;
  }

  // timestamp เป็น optional ใน unified event ถ้า firmware ไม่ส่งมาให้ใช้เวลาปัจจุบันแทน
  const mappedTimestamp =
    eventPayload.timestamp !== undefined && eventPayload.timestamp !== null
      ? eventPayload.timestamp
      : Date.now();

  // รองรับหลายชื่อ field เพื่อคง compatibility ระหว่าง firmware รุ่นเก่าและรุ่นใหม่
  const postureDelta =
    readNumericField(eventPayload.postureDelta) ??
    readNumericField(eventPayload.postureDeltaDeg) ??
    readNumericField(eventPayload.orientationDeltaDeg);

  if (postureDelta === null) {
    return null;
  }

  const rawBpm = readIntegerField(eventPayload.bpm);

  // BPM นอกช่วงที่ยอมรับได้จะถูกมองว่าไม่มีค่า แทนการทำให้ fall payload ทั้งก้อน invalid
  const bpm =
    rawBpm !== null && rawBpm >= 0 && rawBpm <= HEART_RATE_PAYLOAD_BPM_MAX ? rawBpm : null;

  return {
    timestamp: mappedTimestamp,
    magnitude,
    postureDelta,
    bpm,
  };
}

function mapHeartRatePayload(
  eventPayload: ArduinoEventPayload,
  eventType: string,
): HeartRatePayload | null {
  const eventSubtype = normalizeEventType(eventPayload.event);
  const bpm = readIntegerField(eventPayload.bpm) ?? readIntegerField(eventPayload.heartRate);

  if (bpm === null) {
    return null;
  }

  let resolvedType = eventType;

  // firmware บางรุ่นส่ง type เป็น heart_rate แล้วใช้ event แยก low/high
  if (eventType === 'heart_rate') {
    if (eventSubtype === 'low') {
      resolvedType = 'heart_rate_low';
    } else if (eventSubtype === 'high') {
      resolvedType = 'heart_rate_high';
    } else {
      resolvedType = 'hr';
    }
  }

  return {
    timestamp: Date.now(),
    heartRate: bpm,
    isAbnormal: resolvedType !== 'hr',
    ...(resolvedType === 'heart_rate_low'
      ? { alertType: 'LOW' as const }
      : resolvedType === 'heart_rate_high'
        ? { alertType: 'HIGH' as const }
        : {}),
  };
}

export function normalizeUnifiedEvent(data: Record<string, unknown>): UnifiedMqttEvent {
  const eventPayload = data as ArduinoEventPayload;
  const eventType = normalizeEventType(eventPayload.type);

  if (!eventType) {
    return { kind: 'invalid', eventType, reason: 'missing_type' };
  }

  if (eventType === 'fall' || eventType === 'suspected_fall' || eventType === 'fall_confirmed') {
    const payload = mapFallPayload(eventPayload);

    if (!payload) {
      return { kind: 'invalid', eventType, reason: 'invalid_fall_payload' };
    }

    return {
      kind: 'fall',
      eventType,
      mode: eventType === 'suspected_fall' ? 'suspected' : 'confirmed',
      payload,
    };
  }

  if (
    eventType === 'heart_rate' ||
    eventType === 'heart_rate_high' ||
    eventType === 'heart_rate_low' ||
    eventType === 'hr'
  ) {
    const payload = mapHeartRatePayload(eventPayload, eventType);

    if (!payload) {
      return { kind: 'invalid', eventType, reason: 'invalid_heart_rate_payload' };
    }

    return {
      kind: 'heartRate',
      eventType,
      payload,
    };
  }

  if (eventType === 'fall_cancelled' || eventType === 'fall_cancel') {
    return {
      kind: 'fallCancelled',
      eventType,
    };
  }

  return {
    kind: 'unknown',
    eventType,
  };
}
