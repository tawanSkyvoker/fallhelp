/**
 * deviceSerial.ts
 *
 * กติกากลางของหมายเลขอุปกรณ์ ESP32
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด prefix และความยาวของ serial number
 * - กำหนด pattern สำหรับ ESP32-XXXXXXXXXXXX
 * - normalize serial ก่อนตรวจหรือบันทึก
 * - ใช้ร่วมกันระหว่าง validation และ service ฝั่ง device/admin
 */

export const DEVICE_SERIAL_PREFIX = 'ESP32-';
export const DEVICE_SERIAL_HEX_LENGTH = 12;
export const DEVICE_SERIAL_TOTAL_LENGTH = DEVICE_SERIAL_PREFIX.length + DEVICE_SERIAL_HEX_LENGTH;
export const DEVICE_SERIAL_PATTERN = /^ESP32-[0-9A-F]{12}$/;

export const normalizeDeviceSerial = (value: string): string => value.trim().toUpperCase();

export const isValidDeviceSerial = (value: string): boolean =>
  DEVICE_SERIAL_PATTERN.test(normalizeDeviceSerial(value));
