/**
 * deviceConnectivity.ts
 *
 * Utility สำหรับคำนวณ online/offline ของอุปกรณ์จาก lastOnline
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด threshold กลางสำหรับ freshness ของ heartbeat
 * - ตรวจว่า lastOnline ยังสดพอจะถือว่า online หรือไม่
 * - คืนสถานะ ONLINE/OFFLINE สำหรับ response JSON
 * - แยก online/offline ออกจาก Device.status ที่ใช้เป็น pairing state
 */

import { backendEnv } from '../config/env';

export const DEVICE_ONLINE_THRESHOLD_MS = backendEnv.deviceOnlineThresholdMs;

export const isDeviceOnlineByLastOnline = (
  lastOnline: Date | string | null | undefined,
): boolean => {
  if (!lastOnline) return false;

  const time =
    lastOnline instanceof Date
      ? lastOnline.getTime()
      : typeof lastOnline === 'string'
        ? new Date(lastOnline).getTime()
        : NaN;

  if (!Number.isFinite(time)) return false;

  // lastOnline ที่อยู่ใน threshold ยังถือว่าอุปกรณ์ online
  return Date.now() - time < DEVICE_ONLINE_THRESHOLD_MS;
};

export const getDeviceOnlineStatus = (
  lastOnline: Date | string | null | undefined,
): 'ONLINE' | 'OFFLINE' => {
  return isDeviceOnlineByLastOnline(lastOnline) ? 'ONLINE' : 'OFFLINE';
};
