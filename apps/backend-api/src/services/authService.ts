/**
 * authService.ts
 *
 * Service สำหรับ business logic ระบบยืนยันตัวตน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - สมัครสมาชิกและล็อกอิน พร้อมสร้าง JWT token
 * - จัดการ OTP สำหรับ reset password
 * - ดึงข้อมูลโปรไฟล์ผู้ใช้โดยไม่คืน password hash
 * - logout โดยล้าง pushToken ของ session ผู้ใช้
 * - cleanup OTP ที่หมดอายุ
 */

import createDebug from 'debug';

import { hashPassword, comparePassword, generateOtp, isPasswordStrong } from '../utils/password';
import { generateToken, JwtPayload } from '../utils/jwt';
import { addMinutes } from '../utils/time';
import { sendOtpEmail } from '../utils/email';
import { createError } from '../utils/ApiError';
import prisma from '../prisma';
import logger from '../utils/logger';

import { User } from '../generated/prisma/client';
import { USER_ROLES } from '../constants/domain';
import type { Gender, UserRole } from '../constants/domain';

const log = createDebug('fallhelp:auth');
const OTP_EXPIRY_MINUTES = 5;

const toAppUserRole = (role: string): UserRole => {
  if (USER_ROLES.includes(role as UserRole)) {
    return role as UserRole;
  }

  throw createError.roleNotAllowed(role);
};

const sanitizeUser = (user: User): Omit<User, 'password'> => {
  // ลบ password hash ออกก่อนส่งข้อมูลผู้ใช้กลับไปยัง controller/API
  return Object.fromEntries(Object.entries(user).filter(([key]) => key !== 'password')) as Omit<
    User,
    'password'
  >;
};

const generateReferenceCode = (): string => {
  // รหัสอ้างอิงใช้คู่กับ OTP ในอีเมล เพื่อให้ผู้ใช้รู้ว่า OTP เป็นรอบล่าสุด
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';

  for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));

  return result;
};

const findUserByEmailOrThrow = async (email: string): Promise<User> => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw createError.userNotFound();
  }

  return user;
};

const findLatestOtp = async (userId: string, code: string) => {
  // ใช้ OTP ล่าสุดที่ตรงกับ code เพื่อรองรับกรณีผู้ใช้ขอ OTP ใหม่หลายครั้ง
  return prisma.authOtp.findFirst({
    where: { userId, code },
    orderBy: { createdAt: 'desc' },
  });
};

export const register = async (data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: string;
}): Promise<{ user: Omit<User, 'password'>; token: string }> => {
  // ตรวจอีเมลซ้ำก่อนสร้างบัญชีใหม่
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) throw createError.emailExists();

  // ใช้กฎรหัสผ่านเดียวกับ flow reset/change password
  if (!isPasswordStrong(data.password)) {
    throw createError.validationError(
      'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข',
    );
  }

  // ถ้ามีเบอร์โทร ต้องกันค่าซ้ำด้วย เพราะระบบรองรับ identifier ได้ทั้งอีเมลและเบอร์โทร
  if (data.phone) {
    const existingPhone = await prisma.user.findFirst({ where: { phone: data.phone } });
    if (existingPhone) throw createError.phoneExists();
  }

  // เก็บรหัสผ่านเป็น hash เท่านั้น ไม่เก็บ plain text ลงฐานข้อมูล
  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: 'CAREGIVER',
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.gender ? { gender: data.gender as Gender } : {}),
    },
  });

  // สมัครสำเร็จแล้วออก JWT ให้ client ใช้งานต่อได้ทันที
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: toAppUserRole(user.role),
  };
  const token = generateToken(payload);

  logger.audit('user_registered', { userId: user.id, email: user.email, role: user.role });

  return { user: sanitizeUser(user), token };
};

export const login = async (
  identifier: string,
  password: string,
  allowedRole: 'CAREGIVER' | 'ADMIN' | 'ALL' = 'ALL',
): Promise<{ user: Omit<User, 'password'>; token: string }> => {
  // ค้นหาผู้ใช้จากอีเมลหรือเบอร์โทร โดยให้ controller ไม่ต้องแยกชนิด identifier เอง
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }] },
  });

  if (!user) {
    logger.audit('login_failed', { identifier, reason: 'user_not_found' });
    throw createError.invalidCredentials();
  }

  // เทียบ password กับ hash และตอบ error เดียวกันเพื่อไม่เปิดเผยว่าผิดที่บัญชีหรือรหัสผ่าน
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    logger.audit('login_failed', { identifier, userId: user.id, reason: 'invalid_password' });
    throw createError.invalidCredentials();
  }

  if (allowedRole !== 'ALL' && user.role !== allowedRole) {
    logger.audit('login_failed', {
      identifier,
      userId: user.id,
      reason: 'role_not_allowed',
      requiredRole: allowedRole,
      actualRole: user.role,
    });
    throw createError.roleNotAllowed(user.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ผู้ดูแล');
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: toAppUserRole(user.role),
  };
  const token = generateToken(payload);

  logger.audit('user_login', { userId: user.id, email: user.email });

  return { user: sanitizeUser(user), token };
};

export const requestOtp = async (
  email: string,
  allowedRole: 'CAREGIVER' | 'ADMIN' | 'ALL' = 'CAREGIVER',
): Promise<{ message: string; referenceCode: string; expiresInMinutes: number }> => {
  const user = await findUserByEmailOrThrow(email);

  // บาง flow จำกัด role ได้ เช่น admin reset กับ caregiver reset ไม่ควรใช้ข้ามกัน
  if (allowedRole !== 'ALL' && user.role !== allowedRole) {
    throw createError.roleNotAllowed(user.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ผู้ดูแล');
  }

  const code = generateOtp();
  const referenceCode = generateReferenceCode();
  const expiresAt = addMinutes(OTP_EXPIRY_MINUTES);

  // ให้ user มี OTP ที่ใช้งานได้เพียงชุดเดียว เพื่อลดความสับสนตอนกรอก
  await prisma.authOtp.deleteMany({ where: { userId: user.id } });

  await prisma.authOtp.create({ data: { userId: user.id, code, expiresAt } });

  try {
    // ส่ง OTP ไปทางอีเมล
    // ไฟล์ถัดไป: utils/email.ts
    await sendOtpEmail(email, code, referenceCode);
    log('OTP sent to %s (ref: %s)', email, referenceCode);
  } catch (error) {
    log('Failed to send OTP email: %O', error);
    throw createError.emailFailed();
  }

  return { message: `OTP sent to ${email}`, referenceCode, expiresInMinutes: OTP_EXPIRY_MINUTES };
};

export const verifyOtp = async (
  email: string,
  code: string,
): Promise<{ valid: boolean; message: string }> => {
  const user = await findUserByEmailOrThrow(email);

  // verifyOtp ใช้ตรวจความถูกต้องเท่านั้น ยังไม่ consume OTP
  const otp = await findLatestOtp(user.id, code);

  if (!otp) return { valid: false, message: 'Invalid or expired OTP code' };
  if (otp.expiresAt <= new Date()) {
    return { valid: false, message: 'Invalid or expired OTP code' };
  }

  return { valid: true, message: 'OTP verified successfully' };
};

export const resetPassword = async (
  email: string,
  code: string,
  newPassword: string,
): Promise<{ message: string }> => {
  const user = await findUserByEmailOrThrow(email);

  if (!isPasswordStrong(newPassword)) {
    throw createError.validationError(
      'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข',
    );
  }

  // ต้องตรวจ OTP ซ้ำในขั้น reset จริง เพื่อกันการยิง reset-password ตรงโดยไม่ผ่าน verify
  const otp = await findLatestOtp(user.id, code);

  if (!otp) {
    throw createError.otpInvalid();
  }

  if (otp.expiresAt <= new Date()) {
    throw createError.otpExpired();
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });

  // consume OTP หลัง reset สำเร็จ เพื่อให้รหัสเดียวใช้ได้ครั้งเดียว
  await prisma.authOtp.delete({ where: { id: otp.id } });

  logger.audit('password_reset', { userId: user.id, email: user.email });

  return { message: 'Password reset successfully' };
};

export const getProfile = async (userId: string): Promise<Omit<User, 'password'>> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw createError.userNotFound();

  return sanitizeUser(user);
};

export const logout = async (userId: string): Promise<{ message: string }> => {
  // ล้าง pushToken เพื่อหยุดส่ง notification ไปยัง session หรือเครื่องเดิมหลัง logout
  await prisma.user.update({ where: { id: userId }, data: { pushToken: null } });

  logger.audit('user_logout', { userId });

  return { message: 'Logged out successfully' };
};

export const cleanupExpiredOtps = async (): Promise<number> => {
  // ลบ OTP หมดอายุออกจากฐานข้อมูลในงาน scheduled/background
  const result = await prisma.authOtp.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  if (result.count > 0) log('Cleaned up %d expired OTPs', result.count);

  return result.count;
};
