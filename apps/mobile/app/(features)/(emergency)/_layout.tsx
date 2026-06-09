/**
 * Emergency Layout
 *
 * ไฟล์นี้ใช้กำหนดหน้าทั้งหมดในกลุ่มฟีเจอร์ผู้ติดต่อฉุกเฉิน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมหน้ารายชื่อผู้ติดต่อฉุกเฉิน
 * - รวมหน้าเพิ่มผู้ติดต่อฉุกเฉิน
 * - รวมหน้าแก้ไขผู้ติดต่อฉุกเฉิน
 * - รวมหน้าการโทรฉุกเฉิน
 * - ซ่อน Header มาตรฐาน เพื่อให้แต่ละหน้าจอใช้ Header/UI ของตัวเอง
 */

import { Stack } from 'expo-router';

export default function EmergencyLayout() {
  return (
    <Stack
      // ตั้งค่าร่วมให้ทุกหน้าในกลุ่ม Emergency
      screenOptions={{
        // ไม่ใช้ Header ของ Stack
        // แต่ละหน้าจะจัดการ Header หรือ UI ของตัวเอง
        headerShown: false,
        animation: 'none',
      }}
    >
      {/* หน้ารายชื่อผู้ติดต่อฉุกเฉิน */}
      <Stack.Screen name="contacts" />

      {/* หน้าเพิ่มผู้ติดต่อฉุกเฉิน */}
      <Stack.Screen name="add" />

      {/* หน้าแก้ไขผู้ติดต่อฉุกเฉิน */}
      <Stack.Screen name="edit" />

      {/* หน้าโทรฉุกเฉิน */}
      <Stack.Screen name="call" />
    </Stack>
  );
}
