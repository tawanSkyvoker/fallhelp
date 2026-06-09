/**
 * authController.ts
 *
 * Controller สำหรับยืนยันตัวตน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับ request สมัครสมาชิก ล็อกอิน OTP และ reset password
 * - ตรวจข้อมูลจำเป็นบางจุดก่อนส่งเข้า service
 * - เรียก authService เพื่อทำ business logic
 * - ส่ง response กลับในรูปแบบ success/message/data
 */

import { Request, Response } from 'express';

import * as authService from '../services/authService';
import { asyncHandler } from '../middlewares/errorHandler';
import { createError } from '../utils/ApiError';

// POST /api/auth/register
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, phone, gender } = req.body;

  // ส่งข้อมูลสมัครสมาชิกต่อให้ service ตรวจซ้ำและสร้าง JWT
  // ไฟล์ถัดไป: services/authService.ts
  const result = await authService.register({
    email,
    password,
    firstName,
    lastName,
    phone,
    gender,
  });

  res.status(201).json({ success: true, message: 'User registered successfully', data: result });
});

// POST /api/auth/login
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, identifier, password } = req.body;

  // Mobile ใช้ identifier ได้ ส่วน Admin อาจส่ง email โดยตรง
  const loginIdentifier = identifier || email;

  if (!loginIdentifier || !password)
    throw createError.validationError('กรุณากรอกอีเมล/เบอร์โทรและรหัสผ่าน');

  // ยืนยันตัวตนและรับ JWT กลับจาก service
  // ไฟล์ถัดไป: services/authService.ts
  const result = await authService.login(loginIdentifier, password);

  res.json({ success: true, message: 'Login successful', data: result });
});

// POST /api/auth/admin-login
export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) throw createError.validationError('กรุณากรอกอีเมลและรหัสผ่าน');

  // Admin login แยก endpoint เพื่อให้ backend ตรวจสิทธิ์ ADMIN ก่อนออก JWT ให้ใช้งาน Admin Panel
  // ไฟล์ถัดไป: services/authService.ts
  const result = await authService.login(email, password, 'ADMIN');

  res.json({ success: true, message: 'Admin login successful', data: result });
});

// POST /api/auth/request-otp
export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  // ขอ OTP สำหรับ reset password
  // ไฟล์ถัดไป: services/authService.ts
  const result = await authService.requestOtp(email);

  res.json({ success: true, data: result });
});

// POST /api/auth/verify-otp
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body;

  // ตรวจว่า OTP ถูกต้องและยังไม่หมดอายุ แต่ยังไม่ consume OTP
  // ไฟล์ถัดไป: services/authService.ts
  const result = await authService.verifyOtp(email, code);

  res.json({ success: true, data: result });
});

// POST /api/auth/reset-password
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;

  // ตั้งรหัสผ่านใหม่และ consume OTP ที่ใช้สำเร็จ
  // ไฟล์ถัดไป: services/authService.ts
  const result = await authService.resetPassword(email, code, newPassword);

  res.json({ success: true, data: result });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  // logout ต้องมี userId จาก JWT เพื่อให้ service ล้าง pushToken ของบัญชีนี้
  if (!userId) throw createError.accessDenied();

  const result = await authService.logout(userId);

  res.json({ success: true, data: result });
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  // ดึง profile ผู้ใช้ที่ล็อกอินอยู่ โดย service จะไม่คืน password hash
  // ไฟล์ถัดไป: services/authService.ts
  const user = await authService.getProfile(userId);

  res.json({ success: true, data: user });
});
