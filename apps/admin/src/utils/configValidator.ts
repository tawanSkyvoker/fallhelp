/**
 * configValidator.ts
 *
 * Utility สำหรับตรวจสอบ config ของ Admin Panel ตอนเริ่มแอป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจว่า API_URL มีค่าและเป็น URL ที่ถูกต้อง
 * - เตือนเมื่อ production ยังชี้ไป localhost
 * - throw error ทันทีถ้า config สำคัญผิด
 * - ใช้โดย services/api.ts ก่อนสร้าง Axios client
 */

import Logger from "./logger";

interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function validateConfig(
  config: { API_URL: string },
  options: { isProd?: boolean } = {}
): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = options.isProd === true;

  if (!config.API_URL) {
    errors.push("API_URL is required");
  } else if (!isValidUrl(config.API_URL)) {
    errors.push(`API_URL has invalid format: ${config.API_URL}`);
  } else if (config.API_URL.includes("localhost") && isProd) {
    warnings.push("API_URL is set to localhost - this may not work in production");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateAndLogConfig(
  config: { API_URL: string },
  options: { isProd?: boolean } = {}
): void {
  const result = validateConfig(config, options);

  if (!result.isValid) {
    const errorMessage = `[Config] Configuration validation failed:\n${result.errors.join("\n")}`;
    Logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}
