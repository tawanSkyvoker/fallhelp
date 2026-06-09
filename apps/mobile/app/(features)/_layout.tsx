/**
 * Features Layout
 *
 * ไฟล์นี้ใช้กำหนดกลุ่มหน้าทั้งหมดภายใน features
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมกลุ่มฟีเจอร์ย่อย เช่น Elder, Device, Profile, Emergency, Notification และ Report
 * - ซ่อน Header มาตรฐาน เพื่อให้แต่ละหน้าจอใช้ Header/UI ของตัวเอง
 * - ระบุ screen group ตรง ๆ เพื่อไม่ต้องมีหน้า index กลาง
 */

import { Stack } from 'expo-router';

export default function FeaturesLayout() {
  return (
    <Stack
      // ตั้งค่าร่วมให้ทุกหน้าในกลุ่ม features
      screenOptions={{
        // ไม่ใช้ Header ของ Stack
        // แต่ละ feature จะจัดการ Header หรือ UI ของตัวเอง
        headerShown: false,
        animation: 'none',
      }}
    >
      {/* กลุ่มฟีเจอร์ข้อมูลผู้สูงอายุ */}
      <Stack.Screen name="(elder)" />

      {/* กลุ่มฟีเจอร์จัดการอุปกรณ์ */}
      <Stack.Screen name="(device)" />

      {/* กลุ่มฟีเจอร์โปรไฟล์ผู้ใช้ */}
      <Stack.Screen name="(profile)" />

      {/* กลุ่มฟีเจอร์ผู้ติดต่อและการโทรฉุกเฉิน */}
      <Stack.Screen name="(emergency)" />

      {/* กลุ่มฟีเจอร์ประวัติการแจ้งเตือน */}
      <Stack.Screen name="(notification)" />

      {/* กลุ่มฟีเจอร์รายงานสรุป */}
      <Stack.Screen name="(report)" />
    </Stack>
  );
}
