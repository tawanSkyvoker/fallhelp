/**
 * configValidator.ts
 *
 * Utility สำหรับตรวจสอบ Environment Variables ตอน backend startup
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจ env ที่จำเป็น เช่น DATABASE_URL และ JWT_SECRET
 * - ตรวจรูปแบบ PORT และ MQTT_BROKER_URL
 * - สร้าง warnings สำหรับ config ที่ไม่ครบแต่ยังรันต่อได้
 * - throw error ทันทีถ้า config สำคัญผิด เพื่อไม่ให้ระบบพังภายหลัง
 */

import createDebug from 'debug';

const log = createDebug('fallhelp:config');

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfig(env: NodeJS.ProcessEnv): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  } else {
    try {
      new URL(env.DATABASE_URL);
    } catch {
      errors.push('DATABASE_URL has invalid format');
    }
  }

  if (!env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  } else if (env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET should be at least 32 characters for security');
  }

  if (env.PORT) {
    const port = parseInt(env.PORT, 10);

    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`PORT must be a number between 1-65535, got: ${env.PORT}`);
    }
  }

  // MQTT_BROKER_URL ตรวจ format เฉพาะตอนเปิดใช้ MQTT
  if (env.MQTT_BROKER_URL && !env.MQTT_DISABLED) {
    try {
      new URL(env.MQTT_BROKER_URL);
    } catch {
      errors.push('MQTT_BROKER_URL has invalid format');
    }
  }

  if (!env.RESEND_API_KEY && env.NODE_ENV === 'production') {
    warnings.push('RESEND_API_KEY is not set - email features will be disabled');
  }

  if (!env.FRONTEND_URL) {
    warnings.push('FRONTEND_URL is not set - CORS may not work correctly');
  }

  if (!env.ADMIN_URL) {
    warnings.push('ADMIN_URL is not set - CORS may not work correctly');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateAndLogConfig(env: NodeJS.ProcessEnv): void {
  const result = validateConfig(env);

  if (result.warnings.length > 0) {
    result.warnings.forEach((warning) => {
      log('[Warn] %s', warning);
    });
  }

  if (!result.isValid) {
    const errorMessage = `Configuration validation failed:\n${result.errors.join('\n')}`;

    log('[Error] %s', errorMessage);

    throw new Error(errorMessage);
  }

  log('Configuration validated successfully');
}
