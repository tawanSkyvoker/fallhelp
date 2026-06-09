/**
 * Notification Layout
 *
 * ไฟล์นี้ใช้กำหนดหน้าทั้งหมดในกลุ่มฟีเจอร์ Notification
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมหน้าประวัติการแจ้งเตือน
 * - ซ่อน Header มาตรฐาน เพื่อให้หน้าจอใช้ Header/UI ของตัวเอง
 */

import { Stack } from 'expo-router';

export default function NotificationLayout() {
  return (
    <Stack
      // ตั้งค่าร่วมให้ทุกหน้าในกลุ่ม Notification
      screenOptions={{
        // ไม่ใช้ Header ของ Stack
        // แต่ละหน้าจะจัดการ Header หรือ UI ของตัวเอง
        headerShown: false,
        animation: 'none',
      }}
    >
      {/* หน้าประวัติการแจ้งเตือน */}
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
