/**
 * formValidation.ts
 *
 * Utilities สำหรับตรวจและ normalize input จากฟอร์ม mobile
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจ required text, email, login identifier, OTP และ device code
 * - sanitize ค่า input ก่อนนำไปใช้กับ auth, pairing และ WiFi setup flow
 * - รวม validation ที่คืน dialog-friendly error สำหรับหน้าที่ต้องแสดง title/message
 */

import { validatePasswordPolicy } from './passwordPolicy';
import { isValidThaiPhoneNumber } from './phoneValidation';

export interface DialogValidationError {
  readonly title: string;
  readonly message: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const getRequiredTextValidationError = (value: string, message: string): string | null =>
  value.trim().length === 0 ? message : null;

export const containsThaiText = (value: string): boolean => /[ก-๙]/.test(value);

export const sanitizeEmailInput = (value: string): string =>
  value.replace(/[^a-zA-Z0-9@._+\-]/g, '');

export const sanitizeLoginIdentifierInput = (value: string): string => sanitizeEmailInput(value);

export const getEmailValidationError = (
  value: string,
  options: {
    readonly required?: boolean;
    readonly requiredMessage?: string;
    readonly thaiMessage?: string;
    readonly invalidMessage?: string;
  } = {},
): string | null => {
  const email = value.trim();

  if (!email) {
    return options.required ? (options.requiredMessage ?? 'กรุณากรอกอีเมล') : null;
  }

  if (containsThaiText(email)) {
    return options.thaiMessage ?? 'กรุณากรอกอีเมลเป็นภาษาอังกฤษ';
  }

  if (!EMAIL_PATTERN.test(email)) {
    return options.invalidMessage ?? 'กรุณากรอกอีเมลให้ถูกต้อง';
  }

  return null;
};

export const getLoginIdentifierValidationError = (value: string): string | null => {
  const identifier = value.trim();

  if (isValidThaiPhoneNumber(identifier)) {
    return null;
  }

  if (EMAIL_PATTERN.test(identifier) && !containsThaiText(identifier)) {
    return null;
  }

  return 'กรุณากรอกอีเมลหรือเบอร์โทรศัพท์ให้ถูกต้อง';
};

export const sanitizeOtpInput = (value: string, length: number = 6): string =>
  value.replace(/\D/g, '').slice(0, length);

export const getOtpValidationError = (value: string, length: number = 6): string | null =>
  sanitizeOtpInput(value, length).length === length ? null : `กรุณากรอกรหัสให้ครบ ${length} หลัก`;

export const sanitizeDeviceCodeInput = (value: string): string =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);

export const getDeviceCodeValidationError = (value: string): string | null =>
  sanitizeDeviceCodeInput(value).length === 8 ? null : 'กรุณากรอกรหัสอุปกรณ์ให้ครบ 8 หลัก';

export const getPositiveNumberValidationError = (
  value: string,
  message: string,
  options: { readonly integer?: boolean } = {},
): string | null => {
  const numberValue = Number(value);

  if (!value || Number.isNaN(numberValue) || numberValue <= 0) {
    return message;
  }

  if (options.integer && !Number.isInteger(numberValue)) {
    return message;
  }

  return null;
};

export const getPasswordPairValidationError = ({
  currentPassword,
  newPassword,
  confirmPassword,
  requireCurrentPassword = false,
  missingMessage,
}: {
  readonly currentPassword?: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
  readonly requireCurrentPassword?: boolean;
  readonly missingMessage: string;
}): string | null => {
  if ((requireCurrentPassword && !currentPassword) || !newPassword || !confirmPassword) {
    return missingMessage;
  }

  if (newPassword !== confirmPassword) {
    return 'กรุณากรอกรหัสผ่านยืนยันให้ตรงกัน';
  }

  const passwordValidation = validatePasswordPolicy(newPassword);
  return passwordValidation.valid ? null : (passwordValidation.message ?? '');
};

export const getWifiCredentialValidationError = ({
  ssid,
  password,
  requiresPassword,
}: {
  readonly ssid: string;
  readonly password: string;
  readonly requiresPassword: boolean;
}): DialogValidationError | null => {
  if (!ssid.trim()) {
    return {
      title: 'ข้อมูลไม่ครบถ้วน',
      message: 'กรุณากรอกชื่อ WiFi (SSID)',
    };
  }

  if (requiresPassword && !password) {
    return {
      title: 'ต้องระบุรหัสผ่าน',
      message: 'กรุณาระบุรหัสผ่าน WiFi',
    };
  }

  if (password.length > 0 && password.length < 8) {
    return {
      title: 'รหัสผ่านไม่ถูกต้อง',
      message: 'รหัสผ่าน WiFi ต้องมีอย่างน้อย 8 ตัวอักษร',
    };
  }

  return null;
};
