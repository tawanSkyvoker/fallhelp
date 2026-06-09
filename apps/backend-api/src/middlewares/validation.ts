/**
 * validation.ts
 *
 * Middleware สำหรับตรวจสอบข้อมูล request ก่อนเข้า controller
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - สร้าง validate() factory สำหรับตรวจ req.body ตามกฎที่กำหนด
 * - validate auth flow เช่น login, register, OTP และ reset password
 * - validate serial number สำหรับการสร้างอุปกรณ์
 * - validate WiFi config ก่อนส่งค่าไปยัง ESP32
 */

import { Request, Response, NextFunction } from 'express';

import {
  DEVICE_SERIAL_PATTERN,
  DEVICE_SERIAL_TOTAL_LENGTH,
  normalizeDeviceSerial,
} from '../utils/deviceSerial';

interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'array';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean;
  message?: string;
}

export const validate = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      // field ที่ required ต้องไม่เป็น undefined, null หรือ string ว่าง
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(rule.message || `${rule.field} is required`);
        continue;
      }

      // field optional ที่ไม่ได้ส่งมา ให้ข้าม validation ของ field นั้น
      if (!rule.required && (value === undefined || value === null)) {
        continue;
      }

      if (rule.type) {
        if (rule.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          if (!emailRegex.test(value)) {
            errors.push(`${rule.field} must be a valid email`);
          }
        } else if (rule.type === 'array') {
          if (!Array.isArray(value)) {
            errors.push(`${rule.field} must be an array`);
          }
        } else if (typeof value !== rule.type) {
          errors.push(`${rule.field} must be a ${rule.type}`);
        }
      }

      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
        }

        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${rule.field} must be at most ${rule.maxLength} characters`);
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(rule.message || `${rule.field} format is invalid`);
        }
      }

      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${rule.field} must be at least ${rule.min}`);
        }

        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${rule.field} must be at most ${rule.max}`);
        }
      }

      if (rule.custom && !rule.custom(value)) {
        errors.push(rule.message || `${rule.field} is invalid`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors,
      });

      return;
    }

    next();
  };
};

export const validateLogin = validate([
  // mobile ใช้ identifier ส่วน admin อาจส่ง email โดยตรง
  { field: 'identifier', required: false, type: 'string' },
  { field: 'email', required: false, type: 'email' },
  { field: 'password', required: true, type: 'string', minLength: 6 },
]);

export const validateRegister = validate([
  { field: 'email', required: true, type: 'email' },
  { field: 'password', required: true, type: 'string', minLength: 8 },
  { field: 'firstName', required: true, type: 'string', minLength: 1 },
  { field: 'lastName', required: true, type: 'string', minLength: 1 },
  {
    field: 'gender',
    required: false,
    type: 'string',
    custom: (value) => ['MALE', 'FEMALE', 'OTHER'].includes(value as string),
    message: 'Gender must be MALE, FEMALE, or OTHER',
  },
  {
    field: 'phone',
    required: false,
    type: 'string',
    pattern: /^0\d{9}$/,
    message: 'Phone must be 10 digits starting with 0',
  },
]);

export const validateOtpRequest = validate([{ field: 'email', required: true, type: 'email' }]);

export const validateOtpVerification = validate([
  { field: 'email', required: true, type: 'email' },
  { field: 'code', required: true, type: 'string', minLength: 6, maxLength: 6 },
]);

export const validateResetPassword = validate([
  { field: 'email', required: true, type: 'email' },
  { field: 'code', required: true, type: 'string', minLength: 6, maxLength: 6 },
  { field: 'newPassword', required: true, type: 'string', minLength: 8 },
]);

export const validateCreateDevice = (req: Request, res: Response, next: NextFunction): void => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const serialNumber = body['serialNumber'];

  if (typeof serialNumber !== 'string' || serialNumber.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: ['serialNumber is required'],
    });

    return;
  }

  // normalize ก่อนตรวจ เพื่อให้รูปแบบ serial ที่ admin กรอกถูกจัดให้อยู่ใน format กลาง
  const normalizedSerialNumber = normalizeDeviceSerial(serialNumber);

  if (normalizedSerialNumber.length !== DEVICE_SERIAL_TOTAL_LENGTH) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: [
        `serialNumber must be exactly ${DEVICE_SERIAL_TOTAL_LENGTH} characters in ESP32-XXXXXXXXXXXX format`,
      ],
    });

    return;
  }

  if (!DEVICE_SERIAL_PATTERN.test(normalizedSerialNumber)) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: ['serialNumber must match ESP32-XXXXXXXXXXXX (12 uppercase hexadecimal characters)'],
    });

    return;
  }

  // ส่ง serialNumber ที่ normalize แล้วให้ controller/service ใช้ต่อ
  req.body = { ...body, serialNumber: normalizedSerialNumber };

  next();
};

export const validateWiFiConfig = (req: Request, res: Response, next: NextFunction): void => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const ssid = body['ssid'];
  const wifiPassword = body['wifiPassword'];

  // SSID ต้องไม่ว่าง และไม่เกิน 32 ตัวอักษรตามข้อจำกัดของ WiFi standard
  if (typeof ssid !== 'string' || ssid.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: ['ssid is required'],
    });

    return;
  }

  if (ssid.trim().length > 32) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: ['ssid must be at most 32 characters'],
    });

    return;
  }

  // ใช้ field canonical คือ wifiPassword และรองรับ open network ด้วย string ว่าง
  if (typeof wifiPassword !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: ['wifiPassword is required'],
    });

    return;
  }

  if (wifiPassword.length > 64) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: ['wifiPassword must be at most 64 characters'],
    });

    return;
  }

  if (wifiPassword.length > 0 && wifiPassword.length < 8) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: ['wifiPassword must be at least 8 characters or empty for open network'],
    });

    return;
  }

  // trim เฉพาะ SSID แต่ไม่ trim password เพราะรหัสผ่านอาจตั้งใจมีช่องว่าง
  req.body = { ...body, ssid: ssid.trim(), wifiPassword };

  next();
};
