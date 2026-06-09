/**
 * password.ts
 *
 * Utility สำหรับจัดการรหัสผ่านและ OTP
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - hash password ด้วย bcrypt ก่อนบันทึกลงฐานข้อมูล
 * - compare password ตอน login หรือ change password
 * - ตรวจความแข็งแรงของรหัสผ่านตามกฎกลาง
 * - สร้าง OTP 6 หลักด้วย crypto.randomInt
 */

import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';

const SALT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

export const isPasswordStrong = (password: string): boolean => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  // กฎกลาง: อย่างน้อย 8 ตัว มีตัวใหญ่ ตัวเล็ก และตัวเลข
  return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumber;
};

export const generateOtp = (): string => {
  // ใช้ secure random แทน Math.random สำหรับรหัส OTP
  return randomInt(100000, 999999).toString();
};
