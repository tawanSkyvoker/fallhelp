/**
 * userController.ts
 *
 * Controller สำหรับข้อมูลผู้ใช้ปัจจุบัน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - อ่าน userId จาก JWT
 * - ดูและแก้ไขโปรไฟล์ผู้ใช้ปัจจุบัน
 * - เปลี่ยนรหัสผ่าน
 * - อัปเดต Expo Push Token สำหรับ notification
 */

import { Request, Response } from 'express';

import { createError } from '../utils/ApiError';
import * as userService from '../services/userService';
import { asyncHandler } from '../middlewares/errorHandler';

// endpoint สำหรับ GET /api/users/me
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  // ดึงโปรไฟล์โดย service จะไม่คืน password hash
  // ไฟล์ถัดไป: services/userService.ts
  const user = await userService.getUserProfile(userId);

  res.json({
    success: true,
    data: user,
  });
});

// endpoint สำหรับ PATCH /api/users/me
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const { firstName, lastName, phone, profileImage, gender, email } = req.body;

  // แก้ไขข้อมูลโปรไฟล์ ถ้าเปลี่ยนรูป service จะจัดการลบรูปเก่าเอง
  // ไฟล์ถัดไป: services/userService.ts
  const user = await userService.updateUserProfile(userId, {
    firstName,
    lastName,
    phone,
    profileImage,
    gender,
    email,
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: user,
  });
});

// endpoint สำหรับ PUT /api/users/me/password
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const { currentPassword, newPassword } = req.body;

  // เปลี่ยนรหัสผ่านโดย service จะตรวจรหัสเดิมและ hash รหัสใหม่
  // ไฟล์ถัดไป: services/userService.ts
  const result = await userService.changePassword(userId, currentPassword, newPassword);

  res.json({
    success: true,
    data: result,
  });
});

// endpoint สำหรับ PUT /api/users/me/push-token
export const updatePushToken = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const { pushToken } = req.body;

  // บันทึก Expo Push Token เพื่อใช้ส่ง fallback notification
  // ไฟล์ถัดไป: services/userService.ts
  const result = await userService.updatePushToken(userId, pushToken);

  res.json({
    success: true,
    data: result,
  });
});
