/**
 * Auth Layout
 *
 * ไฟล์นี้ใช้กำหนดหน้าทั้งหมดในกลุ่ม Auth
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมหน้าที่เกี่ยวกับ Login, Register และ Forgot Password
 * - กำหนดการเปลี่ยนหน้าของ Auth Flow
 * - ซ่อน Header มาตรฐานของ Stack
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      // ตั้งค่าร่วมให้ทุกหน้าในกลุ่ม Auth
      screenOptions={{
        // ไม่ใช้ Header ของ Stack
        // แต่ละหน้าจะจัดการ Header หรือ UI ของตัวเอง
        headerShown: false,

        // ตั้งค่า animation ตอนเปลี่ยนหน้า
        animation: 'none',
      }}
    >
      {/* หน้าเข้าสู่ระบบ */}
      <Stack.Screen name="login" />

      {/* หน้าสมัครสมาชิก */}
      <Stack.Screen name="register" />

      {/* หน้าขอ OTP เมื่อลืมรหัสผ่าน */}
      <Stack.Screen name="forgot-password" />

      {/* หน้ายืนยัน OTP */}
      <Stack.Screen name="verify-otp" />

      {/* หน้าตั้งรหัสผ่านใหม่ */}
      <Stack.Screen name="reset-password" />

      {/* หน้าสรุปผลหลังสมัครสมาชิกหรือรีเซ็ตรหัสผ่านสำเร็จ */}
      <Stack.Screen name="success" />
    </Stack>
  );
}
