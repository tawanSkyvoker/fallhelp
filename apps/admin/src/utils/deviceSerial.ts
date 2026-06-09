/**
 * deviceSerial.ts
 *
 * Utility สำหรับจัดการ serial number ของอุปกรณ์ฝั่ง Admin
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนดรูปแบบ serial กลางของ ESP32
 * - normalize input จากฟอร์มก่อน validate
 * - ตรวจว่า serial ตรง pattern ที่ backend/firmware ยอมรับ
 * - ใช้ในหน้า Devices ตอนลงทะเบียนอุปกรณ์ใหม่
 */

export const DEVICE_SERIAL_PREFIX = "ESP32-";
export const DEVICE_SERIAL_HEX_LENGTH = 12;
export const DEVICE_SERIAL_TOTAL_LENGTH = DEVICE_SERIAL_PREFIX.length + DEVICE_SERIAL_HEX_LENGTH;
export const DEVICE_SERIAL_PATTERN = /^ESP32-[0-9A-F]{12}$/;

export const normalizeDeviceSerialInput = (value: string): string =>
  value.toUpperCase().replace(/\s+/g, "");

export const normalizeDeviceSerial = (value: string): string => value.trim().toUpperCase();

export const isValidDeviceSerial = (value: string): boolean =>
  DEVICE_SERIAL_PATTERN.test(normalizeDeviceSerial(value));
