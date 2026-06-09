/**
 * Report Layout
 *
 * ไฟล์นี้ใช้กำหนดหน้าทั้งหมดในกลุ่มฟีเจอร์รายงาน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมหน้าสรุปรายงานประจำเดือน
 * - ซ่อน Header มาตรฐาน เพื่อให้หน้าจอใช้ Header/UI ของตัวเอง
 */

import { Stack } from 'expo-router';

export default function ReportLayout() {
  return (
    <Stack
      // ตั้งค่าร่วมให้ทุกหน้าในกลุ่ม Report
      screenOptions={{
        // ไม่ใช้ Header ของ Stack
        // แต่ละหน้าจะจัดการ Header หรือ UI ของตัวเอง
        headerShown: false,
        animation: 'none',
      }}
    >
      {/* หน้าสรุปสถิติเหตุล้มและชีพจรรายเดือน */}
      <Stack.Screen name="report-summary" />
    </Stack>
  );
}
