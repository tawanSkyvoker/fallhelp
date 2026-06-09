/**
 * Setup Layout
 *
 * ไฟล์นี้ใช้กำหนดหน้าทั้งหมดใน Setup Flow
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมหน้าสำหรับตั้งค่าครั้งแรกของแอป
 * - กำหนดลำดับหน้าใน Setup Wizard
 * - ปิด gesture ย้อนกลับ เพื่อให้ผู้ใช้ทำตามขั้นตอน
 * - ใช้ ErrorBoundary ครอบ flow นี้ไว้ ถ้าเกิด error จะพากลับไปหน้าเริ่มต้น
 */

import { Stack } from 'expo-router';

import { ErrorBoundary } from '../../components/ErrorBoundary';

import { safeRouter as router } from '../../utils/safeRouter';

export default function SetupLayout() {
  return (
    // ครอบ Setup Flow ทั้งหมด
    // ถ้าเกิด error ในหน้าใด จะ reset กลับไปหน้า empty-state
    <ErrorBoundary onReset={() => router.replace('/(setup)/empty-state')}>
      <Stack
        screenOptions={{
          // ไม่ใช้ Header มาตรฐานของ Stack
          headerShown: false,
          headerTitleAlign: 'center',

          // ปิด animation ของ Setup Flow
          // ใช้ลดปัญหาภาพกระพริบ โดยเฉพาะหน้าที่เกี่ยวกับกล้องหรือ QR Scanner
          animation: 'none',

          // ปิดการ swipe back เพื่อกันผู้ใช้ย้อนข้ามขั้นตอน setup
          gestureEnabled: false,

          // ตั้งพื้นหลังเริ่มต้นของทุกหน้าใน flow นี้
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        {/* หน้าเริ่มต้นของ Setup Flow */}
        <Stack.Screen
          name="empty-state"
          options={{
            title: 'เริ่มต้นใช้งาน',
            headerShown: false,
            gestureEnabled: false,
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        />

        {/* Step 1: กรอกข้อมูลผู้สูงอายุ */}
        <Stack.Screen
          name="step1-elder-info"
          options={{
            title: 'ข้อมูลผู้สูงอายุ',
            gestureEnabled: false,
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        />

        {/* Step 2: ผูกอุปกรณ์กับผู้สูงอายุ */}
        <Stack.Screen
          name="step2-device-pairing"
          options={{
            title: 'ผูกเครื่อง',
            gestureEnabled: false,
          }}
        />

        {/* Step 3: ตั้งค่า WiFi ให้อุปกรณ์ผ่าน BLE */}
        <Stack.Screen
          name="step3-wifi-setup"
          options={{
            title: 'ตั้งค่า Wi-Fi',
            gestureEnabled: false,
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        />

        {/* หน้าสรุปหลัง Setup Flow เสร็จ */}
        <Stack.Screen
          name="saved-success"
          options={{
            title: 'เสร็จสิ้น',
            headerShown: false,
            gestureEnabled: false,
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        />
      </Stack>
    </ErrorBoundary>
  );
}
