/**
 * domain.ts
 *
 * ค่าคงที่ domain กลางของ backend
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนดชุดค่าที่ backend ยอมรับ แม้ database จะเก็บบาง field เป็น TEXT
 * - สร้าง type-safe string unions สำหรับ role, gender, device status และ WiFi status
 * - รวม lifecycle ของ fall event ไว้จุดเดียว
 */

export const USER_ROLES = ['ADMIN', 'CAREGIVER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

export const DEVICE_STATUSES = ['PAIRED', 'UNPAIRED'] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const WIFI_STATUSES = ['CONNECTED', 'DISCONNECTED', 'CONFIGURING', 'ERROR'] as const;
export type WifiStatus = (typeof WIFI_STATUSES)[number];

// fallStage คือ lifecycle ของ FALL event แต่ละรายการ
export const FALL_STAGES = ['PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'] as const;
export type FallStage = (typeof FALL_STAGES)[number];
