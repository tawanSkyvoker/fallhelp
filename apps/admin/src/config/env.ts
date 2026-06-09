/**
 * env.ts
 *
 * Helper สำหรับอ่านค่า environment ของ Admin Dashboard จาก Vite Env
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - อ่าน API URL จาก VITE_API_URL
 * - fallback เป็น localhost สำหรับ development
 * - เปิด flag บอก environment ปัจจุบันของ Vite
 */

const DEFAULT_API_URL = "http://localhost:3000/api";

const resolveApiUrl = (): string => import.meta.env.VITE_API_URL || DEFAULT_API_URL;

export const adminEnv = {
  get apiUrl(): string {
    return resolveApiUrl();
  },

  get isDev(): boolean {
    return import.meta.env.DEV;
  },

  get isProd(): boolean {
    return import.meta.env.PROD;
  },
};
