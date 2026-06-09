/**
 * deviceSemantics.ts
 *
 * Utility สำหรับเติม semantics ให้ response ของอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แปลง Device.status ให้เป็น pairingStatus
 * - derive onlineStatus และ isOnline จาก lastOnline
 * - เติม semantics ให้ device ตรง ๆ หรือ device ที่ซ้อนอยู่ใน resource อื่น
 * - ใช้กับ read endpoints ที่ต้องส่งข้อมูลให้ mobile/admin เข้าใจง่ายขึ้น
 */

import { getDeviceOnlineStatus } from './deviceConnectivity';

type DeviceWithConnectivityCore = {
  status: string;
  lastOnline?: Date | string | null;
  wifiStatus?: string | null;
};

type DeviceSemantics = {
  pairingStatus: string;
  onlineStatus: 'ONLINE' | 'OFFLINE';
  isOnline: boolean;
};

export const attachDeviceSemantics = <T extends DeviceWithConnectivityCore>(
  device: T,
): T & DeviceSemantics => {
  // Device.status คือ pairing state ส่วน online/offline ต้อง derive จาก lastOnline
  const onlineStatus = getDeviceOnlineStatus(device.lastOnline);

  return {
    ...device,
    pairingStatus: device.status,
    onlineStatus,
    isOnline: onlineStatus === 'ONLINE',
  };
};

export const attachNestedDeviceSemantics = <
  T extends { device: DeviceWithConnectivityCore | null },
>(
  entity: T,
): T | (Omit<T, 'device'> & { device: (T['device'] & DeviceSemantics) | null }) => {
  if (!entity.device) {
    return entity;
  }

  return {
    ...entity,
    device: attachDeviceSemantics(entity.device),
  };
};
