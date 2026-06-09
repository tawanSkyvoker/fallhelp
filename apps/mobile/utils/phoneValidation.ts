/**
 * phoneValidation.ts
 *
 * Utilities สำหรับ normalize และตรวจรูปแบบเบอร์โทรศัพท์ไทยใน mobile forms
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดึงเฉพาะตัวเลขจาก input ที่ผู้ใช้กรอก
 * - จำกัดเบอร์โทรศัพท์ไว้ที่ 10 หลัก
 * - ตรวจรูปแบบเบอร์ไทยที่ต้องขึ้นต้นด้วย 0
 * - คืนข้อความ validation ภาษาไทยสำหรับใช้กับ form/dialog
 */

export const THAI_PHONE_INVALID_MESSAGE = 'กรุณากรอกเบอร์โทรศัพท์ 10 หลักและขึ้นต้นด้วย 0';

const THAI_PHONE_PATTERN = /^0\d{9}$/;

export const extractPhoneDigits = (value: string): string => value.replace(/\D/g, '');

export const sanitizePhoneInput = (value: string): string => extractPhoneDigits(value).slice(0, 10);

export const isValidThaiPhoneNumber = (value: string): boolean =>
  THAI_PHONE_PATTERN.test(extractPhoneDigits(value));

export const getThaiPhoneValidationError = (
  value: string,
  options: { required?: boolean } = {},
): string | null => {
  const digits = extractPhoneDigits(value);

  if (!digits) {
    return options.required ? 'กรุณากรอกเบอร์โทรศัพท์' : null;
  }

  return THAI_PHONE_PATTERN.test(digits) ? null : THAI_PHONE_INVALID_MESSAGE;
};
