/**
 * Not Found Screen
 *
 * หน้านี้ใช้แสดงเมื่อผู้ใช้เข้า route ที่ไม่มีอยู่จริง
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - ซ่อน Header มาตรฐานของ Stack
 * - แสดงข้อความว่าไม่พบหน้านี้
 * - มีปุ่มพากลับไปหน้า Dashboard
 */

import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import KanitText from '../components/KanitText';

import { useScreenTestId } from '../utils/testId';

export default function NotFoundScreen() {
  // testID ใช้สำหรับ test และ accessibility
  const screenTestId = useScreenTestId();

  return (
    <>
      {/* ตั้งค่าหน้านี้ใน Stack และซ่อน Header มาตรฐาน */}
      <Stack.Screen options={{ title: 'ไม่พบหน้านี้', headerShown: false }} />

      <View
        testID={screenTestId}
        accessibilityLabel={screenTestId}
        className="flex-1 items-center justify-center bg-white px-5"
      >
        {/* ข้อความแจ้งว่า route นี้ไม่มีอยู่ */}
        <KanitText className="text-xl text-gray-900">ไม่พบหน้านี้</KanitText>

        <KanitText className="text-base text-gray-500 mt-2 text-center">
          หน้าที่คุณต้องการยังไม่มีหรือถูกลบไปแล้ว
        </KanitText>

        {/* กลับไปหน้า Dashboard */}
        <Link href="/(tabs)/dashboard" className="mt-6 py-3 px-6 bg-[#16AD78] rounded-2xl">
          <KanitText weight="medium" className="text-base text-white">
            กลับหน้าหลัก
          </KanitText>
        </Link>
      </View>
    </>
  );
}
