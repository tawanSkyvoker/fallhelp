/**
 * Profile Layout
 *
 * ไฟล์นี้ใช้กำหนดหน้าทั้งหมดในกลุ่มฟีเจอร์โปรไฟล์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมหน้าโปรไฟล์หลักของผู้ใช้
 * - รวมหน้าแก้ไขข้อมูลส่วนตัว เบอร์โทร อีเมล และรหัสผ่าน
 * - ซ่อน Header มาตรฐาน เพื่อให้แต่ละหน้าจอใช้ Header/UI ของตัวเอง
 */

import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack
      // ตั้งค่าร่วมให้ทุกหน้าในกลุ่ม Profile
      screenOptions={{
        // ไม่ใช้ Header ของ Stack
        // แต่ละหน้าจะจัดการ Header หรือ UI ของตัวเอง
        headerShown: false,
        animation: 'none',
      }}
    >
      {/* หน้าโปรไฟล์หลัก */}
      <Stack.Screen name="profile-info" />

      {/* หน้าเปลี่ยนอีเมลเข้าสู่ระบบ */}
      <Stack.Screen name="change-email" />

      {/* หน้าเปลี่ยนรหัสผ่าน */}
      <Stack.Screen name="change-password" />

      {/* หน้าแก้ไขชื่อ นามสกุล และเพศ */}
      <Stack.Screen name="edit-info" />

      {/* หน้าแก้ไขเบอร์โทรศัพท์ */}
      <Stack.Screen name="edit-phone" />
    </Stack>
  );
}
