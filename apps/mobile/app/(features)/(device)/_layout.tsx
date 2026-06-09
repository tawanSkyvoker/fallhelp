/**
 * Device Layout
 *
 * ไฟล์นี้ใช้กำหนดหน้าทั้งหมดในกลุ่มฟีเจอร์จัดการอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมหน้าที่เกี่ยวกับการผูกอุปกรณ์
 * - รวมหน้าตั้งค่า WiFi ของอุปกรณ์
 * - รวมหน้ารายละเอียดอุปกรณ์
 * - ซ่อน Header มาตรฐาน เพื่อให้แต่ละหน้าจอใช้ Header/UI ของตัวเอง
 */

import { Stack } from 'expo-router';

export default function DeviceLayout() {
  return (
    <Stack
      // ตั้งค่าร่วมให้ทุกหน้าในกลุ่ม Device
      screenOptions={{
        // ไม่ใช้ Header ของ Stack
        // แต่ละหน้าจะจัดการ Header หรือ UI ของตัวเอง
        headerShown: false,

        // ตั้งค่า animation ตอนเปลี่ยนหน้าในฟีเจอร์อุปกรณ์
        animation: 'none',
      }}
    >
      {/* หน้าผูกอุปกรณ์ใหม่ */}
      <Stack.Screen name="device-pairing" />

      {/* หน้ากลางที่เลือก flow ตั้งค่า WiFi ตามสถานะอุปกรณ์ */}
      <Stack.Screen name="device-wifi-setup" />

      {/* Flow เปลี่ยน WiFi ตอนอุปกรณ์ออนไลน์ */}
      <Stack.Screen name="device-wifi-reconfig" options={{ headerShown: false }} />

      {/* Flow ตั้งค่า WiFi ผ่าน BLE ตอนอุปกรณ์ยังไม่ออนไลน์ */}
      <Stack.Screen name="device-ble-wifi-setup" options={{ headerShown: false }} />

      {/* หน้ารายละเอียดและสถานะของอุปกรณ์ */}
      <Stack.Screen name="device-info" />
    </Stack>
  );
}
