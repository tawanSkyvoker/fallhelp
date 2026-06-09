/**
 * Elder Layout
 *
 * ไฟล์นี้ใช้กำหนดหน้าทั้งหมดในกลุ่มฟีเจอร์ข้อมูลผู้สูงอายุ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมหน้ารายละเอียดข้อมูลผู้สูงอายุ
 * - รวมหน้าแก้ไขข้อมูลผู้สูงอายุ
 * - ซ่อน Header มาตรฐาน เพื่อให้แต่ละหน้าจอใช้ Header/UI ของตัวเอง
 */

import { Stack } from 'expo-router';

export default function ElderLayout() {
  return (
    <Stack
      // ตั้งค่าร่วมให้ทุกหน้าในกลุ่ม Elder
      screenOptions={{
        // ไม่ใช้ Header ของ Stack
        // แต่ละหน้าจะจัดการ Header หรือ UI ของตัวเอง
        headerShown: false,

        // ตั้งค่า animation ตอนเปลี่ยนหน้าในฟีเจอร์ผู้สูงอายุ
        animation: 'none',
      }}
    >
      {/* หน้ารายละเอียดข้อมูลผู้สูงอายุ */}
      <Stack.Screen name="elder-info" />

      {/* หน้าแก้ไขข้อมูลผู้สูงอายุ */}
      <Stack.Screen name="edit" />
    </Stack>
  );
}
