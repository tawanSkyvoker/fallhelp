/**
 * configValidator.ts
 *
 * ตรวจสอบค่า config ตอน startup ก่อนให้แอปใช้งานจริง
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจรูปแบบ API_URL และ SOCKET_URL
 * - เตือนเมื่อใช้ localhost ใน production
 * - ตรวจค่า timeout ให้เป็นตัวเลขที่ใช้งานได้
 * - log warning หรือ throw error เมื่อ config ไม่ถูกต้อง
 */

import Logger from '../utils/logger';

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // รองรับเฉพาะ http และ https เพราะ API/socket endpoint ของแอปใช้ protocol กลุ่มนี้
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function validateConfig(config: {
  API_URL: string;
  SOCKET_URL: string;
  REQUEST_TIMEOUT: number;
}): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.API_URL) {
    errors.push('API_URL is required');
  } else if (!isValidUrl(config.API_URL)) {
    errors.push(`API_URL has invalid format: ${config.API_URL}`);
  } else if (config.API_URL.includes('localhost') && !__DEV__) {
    warnings.push('API_URL is set to localhost - this may not work in production');
  }

  if (!config.SOCKET_URL) {
    errors.push('SOCKET_URL is required');
  } else if (!isValidUrl(config.SOCKET_URL)) {
    errors.push(`SOCKET_URL has invalid format: ${config.SOCKET_URL}`);
  } else if (config.SOCKET_URL.includes('localhost') && !__DEV__) {
    warnings.push('SOCKET_URL is set to localhost - this may not work in production');
  }

  if (typeof config.REQUEST_TIMEOUT !== 'number' || config.REQUEST_TIMEOUT <= 0) {
    errors.push(`REQUEST_TIMEOUT must be a positive number, got: ${config.REQUEST_TIMEOUT}`);
  } else if (config.REQUEST_TIMEOUT < 5000) {
    warnings.push('REQUEST_TIMEOUT is less than 5 seconds - may cause timeout issues');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export function validateAndLogConfig(config: {
  API_URL: string;
  SOCKET_URL: string;
  REQUEST_TIMEOUT: number;
}): void {
  const result = validateConfig(config);

  // warning ยังให้แอปทำงานต่อได้ แต่ log ไว้เพื่อช่วยตรวจ config ตอน debug
  result.warnings.forEach((warning) => Logger.warn(`[Config] ${warning}`));

  if (!result.isValid) {
    const errorMessage = `[Config] Configuration validation failed:\n${result.errors.join('\n')}`;

    Logger.error(errorMessage);

    // config หลักผิดต้องหยุดทันที เพราะถ้าปล่อยต่อ service call จะล้มตาม
    throw new Error(errorMessage);
  }

  Logger.info('[Config] Configuration validated successfully');
}
