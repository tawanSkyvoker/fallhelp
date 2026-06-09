/**
 * testId.ts
 *
 * Helper สำหรับสร้าง testID มาตรฐานจาก Expo Router segments
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ประกอบ route segments ให้เป็น path ของหน้าจอ
 * - สร้าง testID กลางในรูปแบบ screen:/path
 * - เปิดให้ caller override testID ได้เมื่อบางหน้าต้องใช้ค่าคงที่เฉพาะ
 */

import { useSegments } from 'expo-router';

const buildPathFromSegments = (segments: string[]): string => {
  const filtered = segments.filter(Boolean);

  // ถ้าไม่มี segment ให้ถือว่าเป็น root path
  return filtered.length === 0 ? '/' : `/${filtered.join('/')}`;
};

export const buildScreenTestId = (segments: string[]): string => {
  return `screen:${buildPathFromSegments(segments)}`;
};

export const useScreenTestId = (override?: string): string => {
  const segments = useSegments();

  // ถ้ามี override ให้ใช้ค่าที่ caller ระบุ เพื่อรองรับหน้าที่ต้องการ testID คงที่กว่าตาม route จริง
  if (override) return override;

  return buildScreenTestId(segments as string[]);
};
