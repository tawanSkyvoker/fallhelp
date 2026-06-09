/**
 * jwt.ts
 *
 * Utility สำหรับสร้างและตรวจสอบ JWT token
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - อ่าน JWT_SECRET และอายุ token จาก backendEnv
 * - กำหนด payload ที่ backend ใช้สำหรับ authorization
 * - สร้าง token หลัง login/register
 * - verify token ใน authenticate middleware
 */

import jwt from 'jsonwebtoken';

import { createError } from './ApiError';
import { backendEnv } from '../config/env';
import type { UserRole as AppUserRole } from '../constants/domain';

const JWT_SECRET = backendEnv.jwtSecret;
const JWT_EXPIRES_IN = backendEnv.jwtExpiresIn;

export interface JwtPayload {
  userId: string;
  email: string;
  role: AppUserRole;
}

export const generateToken = (payload: JwtPayload): string => {
  // เก็บเฉพาะข้อมูลที่จำเป็นต่อ authorization ไม่ใส่ข้อมูลส่วนตัวเกินจำเป็น
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    // ให้ middleware/controller เห็นเป็น ApiError กลาง ไม่ส่ง error ดิบจาก jsonwebtoken ออกไป
    throw createError.invalidToken();
  }
};
