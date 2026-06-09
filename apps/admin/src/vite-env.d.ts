/**
 * vite-env.d.ts
 *
 * Type declaration สำหรับ Vite environment ของ Admin Dashboard
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - โหลด type พื้นฐานของ vite/client
 * - ประกาศ VITE_API_URL ที่ Admin ใช้ชี้ไป backend API
 * - ทำให้ import.meta.env อ่านค่าแบบ type-safe มากขึ้น
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
