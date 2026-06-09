/**
 * config.ts
 *
 * ค่าคงที่กลางของ Admin Panel
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนดค่าการแบ่งหน้า
 * - กำหนดช่วงเวลาตรวจสถานะออนไลน์ของอุปกรณ์
 * - กำหนดรอบ polling สำหรับข้อมูลที่เปลี่ยนเร็วและช้า
 * - รวม error code จาก backend ที่หน้า Admin ต้องใช้แยกกรณี
 */

export const PAGE_SIZE = 10;
export const PAGINATION_MAX_VISIBLE = 10;

// ต้องตรงกับ backend: apps/backend-api/src/utils/deviceConnectivity.ts
export const DEVICE_ONLINE_THRESHOLD_MS = 15000;

// ใช้อัปเดตเวลาฝั่ง client เพื่อคำนวณ online/offline fallback จาก lastOnline
export const DEVICE_CLOCK_TICK_MS = 5000;

export const REFETCH_INTERVAL = {
  fast: 10000, // dashboard, devices — ข้อมูลเปลี่ยนค่อนข้างบ่อย
  slow: 30000, // elders, users — ข้อมูลเปลี่ยนบ่อยน้อยกว่า
} as const;

export const ERROR_CODES = {
  SERIAL_NUMBER_EXISTS: "serial_number_exists",
} as const;
