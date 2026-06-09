/**
 * env.ts
 *
 * อ่านค่า environment ของ mobile และรวม fallback ไว้ที่เดียว
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - อ่านค่า env จาก process.env และ Expo config
 * - กำหนด public API URL เริ่มต้น
 * - เปิด getter ให้ Config.ts ใช้ตัดสิน URL ตอน runtime
 * - รองรับค่า override สำหรับ socket และ force public mode
 */

import Constants from 'expo-constants';

const DEFAULT_PUBLIC_API_URL = 'https://api.tawanlab.site';
const extra = Constants.expoConfig?.extra ?? {};

const getExpoExtraString = (key: string): string | undefined => {
  if (typeof extra !== 'object' || extra === null) {
    return undefined;
  }

  const value = extra[key];

  // คืนค่าเฉพาะ string ที่มีเนื้อหา เพื่อกัน config ว่างถูกนำไปใช้จริง
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export const mobileEnv = {
  get isDevelopment(): boolean {
    return __DEV__;
  },

  get forcePublic(): boolean {
    return process.env.EXPO_PUBLIC_FORCE_PUBLIC === 'true';
  },

  get publicApiUrl(): string {
    return process.env.EXPO_PUBLIC_API_URL || DEFAULT_PUBLIC_API_URL;
  },

  get socketUrlOverride(): string | undefined {
    return process.env.EXPO_PUBLIC_SOCKET_URL || getExpoExtraString('socketUrl');
  },

  get hostUri(): string | null {
    // Expo dev client ใช้ค่านี้เพื่อหา IP เครื่อง dev แล้วต่อ backend local
    return Constants.expoConfig?.hostUri ?? null;
  },
};
