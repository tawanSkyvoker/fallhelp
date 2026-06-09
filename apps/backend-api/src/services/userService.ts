/**
 * userService.ts
 *
 * Service สำหรับจัดการโปรไฟล์ผู้ใช้
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดึงและแก้ไขข้อมูลโปรไฟล์
 * - ลบรูปโปรไฟล์เก่าเมื่ออัปโหลดรูปใหม่
 * - เปลี่ยนรหัสผ่านโดยตรวจรหัสเดิมก่อน
 * - อัปเดต Expo Push Token สำหรับส่ง push notification
 */

import { hashPassword, comparePassword, isPasswordStrong } from '../utils/password';
import prisma from '../prisma';
import { createError } from '../utils/ApiError';
import logger from '../utils/logger';
import { deleteOldProfileImage } from '../utils/fileCleanup';

import { User } from '../generated/prisma/client';
import type { Gender } from '../constants/domain';

const sanitizeUser = (user: User): Omit<User, 'password'> => {
  // service นี้ไม่คืน password hash ออกไปยัง controller/API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, ...userWithoutPassword } = user;

  return userWithoutPassword;
};

export const getUserProfile = async (userId: string): Promise<Omit<User, 'password'>> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw createError.userNotFound();

  return sanitizeUser(user);
};

export const updateUserProfile = async (
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    profileImage?: string;
    gender?: string;
    email?: string;
  },
): Promise<Omit<User, 'password'>> => {
  if (data.profileImage) {
    // ถ้ามีรูปใหม่ ให้ลบรูปเดิมออกจาก disk เพื่อไม่ให้ไฟล์เก่าค้างสะสม
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { profileImage: true },
    });

    if (currentUser?.profileImage && currentUser.profileImage !== data.profileImage) {
      // ไฟล์ถัดไป: utils/fileCleanup.ts
      await deleteOldProfileImage(currentUser.profileImage);
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...data,
      // gender ผ่าน validation มาก่อนแล้ว จึง cast ให้ตรง type ของ Prisma/domain
      gender: data.gender as Gender,
    },
  });

  return sanitizeUser(user);
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw createError.userNotFound();
  }

  // ต้องยืนยันรหัสผ่านเดิมก่อนเปลี่ยน เพื่อกันการเปลี่ยนรหัสผ่านโดยไม่ได้รับอนุญาต
  const isPasswordValid = await comparePassword(currentPassword, user.password);
  if (!isPasswordValid) {
    throw createError.currentPasswordIncorrect();
  }

  // รหัสผ่านใหม่ใช้กฎเดียวกับ register/reset password
  if (!isPasswordStrong(newPassword)) {
    throw createError.validationError(
      'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข',
    );
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  logger.audit('password_changed', { userId });

  return {
    message: 'Password changed successfully',
  };
};

export const updatePushToken = async (
  userId: string,
  pushToken: string,
): Promise<{ message: string }> => {
  // รับเฉพาะ token รูปแบบของ Expo Push Notification
  const isExpoPushToken =
    typeof pushToken === 'string' &&
    (pushToken.startsWith('ExponentPushToken[') || pushToken.startsWith('ExpoPushToken['));

  if (!pushToken || !isExpoPushToken) {
    throw createError.invalidPushToken();
  }

  // เก็บ token ล่าสุดของ user เพื่อให้ notification service ส่ง push ได้
  await prisma.user.update({
    where: { id: userId },
    data: { pushToken },
  });

  return {
    message: 'Push token updated successfully',
  };
};
