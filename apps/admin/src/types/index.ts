/**
 * index.ts
 *
 * Type definitions สำหรับข้อมูลอุปกรณ์ในระบบ Admin
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนดสถานะการจับคู่อุปกรณ์และสถานะออนไลน์ของอุปกรณ์
 * - กำหนด interface ของ Device และ payload สำหรับลงทะเบียนอุปกรณ์ใหม่
 */

export type DeviceStatus = "PAIRED" | "UNPAIRED";
export type DeviceOnlineStatus = "ONLINE" | "OFFLINE" | "WAITING_WIFI";

export interface Device {
  id: string;
  serialNumber: string;
  deviceCode: string;

  // status คือสถานะการจับคู่กับผู้สูงอายุ ไม่ใช่ online/offline
  status: DeviceStatus;

  // onlineStatus และ isOnline เป็นค่าที่ backend derive จาก lastOnline
  onlineStatus: DeviceOnlineStatus;
  isOnline: boolean;
  lastOnline: Date | null;

  // ID ของผู้สูงอายุที่จับคู่กับอุปกรณ์ (เป็น null หากยังไม่ได้จับคู่)
  elderId: string | null;
}

export interface CreateDevicePayload {
  serialNumber: string;
}
