/**
 * rateLimit.ts
 *
 * Middleware สำหรับจำกัดจำนวน request ตามประเภท endpoint
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด limiter กลางสำหรับ API ทั่วไป
 * - กำหนด limiter สำหรับ auth, login และ OTP flow
 * - ใช้ค่าเข้มกว่าใน production และผ่อนกว่าใน development
 * - ลดความเสี่ยงจาก brute-force, spam และ abuse เบื้องต้น
 */

import rateLimit from 'express-rate-limit';

import { backendEnv } from '../config/env';

const isProduction = backendEnv.isProduction;

export const apiLimiter = rateLimit({
  // limiter ทั่วไปสำหรับ endpoint ที่ไม่ได้อยู่ในกลุ่มเสี่ยงพิเศษ
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  // ใช้กับ register/request auth flow เพื่อลดการยิงถี่ผิดปกติ
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 60,
  message: {
    success: false,
    error: 'Too many authentication requests, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  // login เป็นจุดเสี่ยง brute-force สูง จึงจำกัดเข้มกว่า auth endpoint อื่น
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 5 : 15,
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpLimiter = rateLimit({
  // OTP เสี่ยงถูกยิงรัวเพื่อ spam email จึงใช้ limit แยกจาก auth ทั่วไป
  windowMs: isProduction ? 10 * 60 * 1000 : 5 * 60 * 1000,
  max: isProduction ? 3 : 20,
  message: {
    success: false,
    error: 'Too many OTP requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
