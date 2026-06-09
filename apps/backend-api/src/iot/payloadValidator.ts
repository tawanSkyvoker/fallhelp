/**
 * payloadValidator.ts
 *
 * Helper สำหรับตรวจสอบ payload จาก ESP32 ก่อนส่งต่อไปยัง handler และ DB
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - validate payload การล้ม ชีพจร และสถานะอุปกรณ์
 * - คืน null เมื่อข้อมูลผิดรูปแบบ เพื่อให้ handler หยุดได้แบบไม่ throw
 * - จำกัดช่วงค่าที่ backend ยอมรับ เช่น BPM, magnitude และ RSSI
 * - เติมค่า timestamp fallback เมื่อ firmware ไม่ส่งเวลามา
 */

import { FallDetectionPayload, HeartRatePayload, DeviceStatusPayload } from './topics';

export const HEART_RATE_PAYLOAD_BPM_MIN = 0;
export const HEART_RATE_PAYLOAD_BPM_MAX = 180;

function isValidNumber(value: unknown, min?: number, max?: number): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;

  return true;
}

function isValidInteger(value: unknown, min?: number, max?: number): value is number {
  return isValidNumber(value, min, max) && Number.isInteger(value);
}

function isValidTimestamp(value: unknown): value is number | string {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0;
  }

  return typeof value === 'string' && value.trim().length > 0;
}

export function validateFallPayload(data: unknown): FallDetectionPayload | null {
  if (!data || typeof data !== 'object') return null;

  const payload = data as Record<string, unknown>;
  const magnitude = payload['magnitude'];
  const postureDelta = payload['postureDelta'];
  const timestamp = payload['timestamp'];
  const rawBpm = payload['bpm'];

  // fall event ต้องมี evidence หลักครบก่อนจึงยอมให้สร้าง event ต่อ
  if (!isValidNumber(magnitude, 0, 200)) return null;
  if (!isValidNumber(postureDelta, 0, 360)) return null;
  if (!isValidTimestamp(timestamp)) return null;

  // bpm เป็น optional: 0 = ไม่มีสัญญาณ, null = firmware เก่าไม่ส่งมา
  const bpm = isValidInteger(rawBpm, 0, HEART_RATE_PAYLOAD_BPM_MAX) ? rawBpm : null;

  return {
    timestamp,
    magnitude,
    postureDelta,
    bpm,
  };
}

export function validateHeartRatePayload(data: unknown): HeartRatePayload | null {
  if (!data || typeof data !== 'object') return null;

  const payload = data as Record<string, unknown>;
  const heartRate = payload['heartRate'];
  const rawAlertType = payload['alertType'];
  const rawZone = payload['zone'];
  const rawConfidence = payload['confidence'];
  const isAbnormal = payload['isAbnormal'];
  const timestamp = payload['timestamp'];

  // heartRate ต้องเป็นจำนวนเต็มและอยู่ในช่วงที่ระบบยอมรับ
  if (!isValidInteger(heartRate, HEART_RATE_PAYLOAD_BPM_MIN, HEART_RATE_PAYLOAD_BPM_MAX)) {
    return null;
  }

  const alertType = rawAlertType === 'LOW' || rawAlertType === 'HIGH' ? rawAlertType : undefined;
  const zone =
    rawZone === 'low' || rawZone === 'normal' || rawZone === 'high' ? rawZone : undefined;

  const confidence =
    rawConfidence === 'none' ||
    rawConfidence === 'low' ||
    rawConfidence === 'medium' ||
    rawConfidence === 'high'
      ? rawConfidence
      : undefined;

  return {
    timestamp: isValidTimestamp(timestamp) ? timestamp : Date.now(),
    heartRate,
    ...(zone !== undefined ? { zone } : {}),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(typeof isAbnormal === 'boolean' ? { isAbnormal } : {}),
    ...(alertType !== undefined ? { alertType } : {}),
  };
}

export function validateStatusPayload(data: unknown): DeviceStatusPayload | null {
  if (!data || typeof data !== 'object') return null;

  const payload = data as Record<string, unknown>;
  const online = payload['online'];
  const timestamp = payload['timestamp'];
  const signalStrength = payload['signalStrength'];
  const ip = payload['ip'];
  const wifiSSID = payload['wifiSSID'];

  // online เป็น field บังคับ เพราะใช้ตัดสิน connectivity side effects โดยตรง
  if (typeof online !== 'boolean') return null;

  return {
    timestamp: isValidTimestamp(timestamp) ? timestamp : Date.now(),
    online,
    ...(isValidNumber(signalStrength, -150, 0) ? { signalStrength } : {}),
    ...(typeof ip === 'string' ? { ip } : {}),
    ...(typeof wifiSSID === 'string' ? { wifiSSID } : {}),
  };
}
