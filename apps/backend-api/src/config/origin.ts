/**
 * origin.ts
 *
 * กติกา origin กลางของ backend
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ใช้ policy เดียวกันระหว่าง Express CORS และ Socket.io
 * - อนุญาต request ที่ไม่มี Origin สำหรับ mobile native client
 * - development อนุญาต localhost, LAN IP และ Expo scheme
 * - production ใช้ allowlist จาก backendEnv.allowedOrigins
 */

import { backendEnv } from './env';

export const isAllowedClientOrigin = (origin?: string): boolean => {
  // mobile native client บางกรณีไม่ส่ง Origin header
  // ยังอนุญาตได้ เพราะ request จริงยังต้องผ่าน JWT/auth ownership อีกชั้น
  if (!origin) {
    return true;
  }

  if (backendEnv.isDevelopment) {
    if (backendEnv.isKnownDevelopmentOrigin(origin)) {
      return true;
    }
  }

  return backendEnv.allowedOrigins.includes(origin);
};
