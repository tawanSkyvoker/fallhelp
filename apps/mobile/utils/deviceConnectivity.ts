/**
 * deviceConnectivity.ts
 *
 * Helper กลางสำหรับตีความสถานะ online/offline ของอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมกติกา freshness ของ lastOnline ไว้ที่เดียว
 * - อ่านสถานะ online จาก API snapshot
 * - ตรวจว่ามี realtime signal จาก heart/status update หรือไม่
 * - คำนวณ optimistic online ก่อน realtime signal แรกจะเข้ามา
 */

import type { Device } from '../services/types';

// กำหนดความสดใหม่ของข้อมูลออนไลน์จาก API เป็น 15 วินาที
export const DEVICE_ONLINE_FRESHNESS_MS = 15 * 1000;

type DeviceConnectivitySnapshot = Pick<Device, 'isOnline' | 'onlineStatus' | 'lastOnline'> | null;

type RealtimeDeviceSignal = {
  lastHeartUpdate?: Date | null;
  lastStatusUpdate?: Date | null;
};

type OptimisticOnlineInput = {
  device: DeviceConnectivitySnapshot | undefined;
  now: number;
  hasRealtimeSignal: boolean;
  freshnessMs?: number;
};

type EffectiveOnlineInput = {
  device: DeviceConnectivitySnapshot | undefined;
  now: number;
  realtimeConnected: boolean;
  socketConnected: boolean;
  hasRealtimeSignal: boolean;
  freshnessMs?: number;
};

export const parseDeviceTimestamp = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;

  // parse วันที่จาก API แบบ fail-safe เพื่อกัน legacy payload หรือค่า invalid
  const parsed = value instanceof Date ? value : new Date(value);

  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const getDeviceLastOnlineAt = (
  device: DeviceConnectivitySnapshot | undefined,
): Date | null => parseDeviceTimestamp(device?.lastOnline);

export const isDeviceMarkedOnlineByApi = (
  device: DeviceConnectivitySnapshot | undefined,
): boolean => device?.isOnline === true || device?.onlineStatus === 'ONLINE';

export const hasFreshDeviceLastOnline = ({
  lastOnlineAt,
  now,
  freshnessMs = DEVICE_ONLINE_FRESHNESS_MS,
}: {
  lastOnlineAt: Date | null;
  now: number;
  freshnessMs?: number;
}): boolean => !!lastOnlineAt && now - lastOnlineAt.getTime() <= freshnessMs;

export const hasRealtimeDeviceSignal = ({
  lastHeartUpdate,
  lastStatusUpdate,
}: RealtimeDeviceSignal): boolean =>
  // มี heart หรือ status update อย่างน้อยหนึ่งอย่าง แปลว่าเริ่มได้รับ realtime signal แล้ว
  !!lastHeartUpdate || !!lastStatusUpdate;

export const getOptimisticOnlineFromApi = ({
  device,
  now,
  hasRealtimeSignal,
  freshnessMs = DEVICE_ONLINE_FRESHNESS_MS,
}: OptimisticOnlineInput): boolean => {
  const lastOnlineAt = getDeviceLastOnlineAt(device);

  // ใช้ API snapshot เป็น online ชั่วคราวเฉพาะช่วงที่ยังไม่มี realtime signal
  return (
    isDeviceMarkedOnlineByApi(device) &&
    hasFreshDeviceLastOnline({ lastOnlineAt, now, freshnessMs }) &&
    !hasRealtimeSignal
  );
};

export const getEffectiveDeviceOnline = ({
  device,
  now,
  realtimeConnected,
  socketConnected,
  hasRealtimeSignal,
  freshnessMs = DEVICE_ONLINE_FRESHNESS_MS,
}: EffectiveOnlineInput): boolean => {
  // realtime จาก socket สำคัญที่สุด ถ้าบอกว่า connected ให้ถือว่า online ทันที
  if (realtimeConnected) return true;

  // socket ต่อแล้วแต่ realtime device ไม่ connected ให้ถือว่า offline
  if (socketConnected) return false;

  // ระหว่างยังไม่มี realtime ชัดเจน ให้ fallback ไป API snapshot ที่ยังสดอยู่
  return getOptimisticOnlineFromApi({
    device,
    now,
    hasRealtimeSignal,
    freshnessMs,
  });
};
