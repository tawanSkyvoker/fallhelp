/**
 * Modal Screen
 *
 * หน้านี้เป็น modal route กลางของแอป
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - แสดงหน้าจอ modal แบบซ้อนทับ
 * - ใช้สำหรับเนื้อหาเสริมหรือหน้าที่ต้องการ presentation แบบ modal
 * - ตั้งค่า StatusBar ให้เหมาะกับ platform
 */

import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';

import KanitText from '../components/KanitText';
import { useScreenTestId } from '../utils/testId';

export default function ModalScreen() {
  // testID ใช้สำหรับ test และ accessibility
  const screenTestId = useScreenTestId();

  return (
    <View
      testID={screenTestId}
      accessibilityLabel={screenTestId}
      className="flex-1 items-center justify-center bg-white px-6"
    >
      {/* หัวข้อของ modal */}
      <KanitText className="text-xl-bold text-gray-900">Modal</KanitText>

      {/* เส้นแบ่งระหว่างหัวข้อกับเนื้อหา */}
      <View className="my-8 h-px w-4/5 bg-gray-200" />

      {/* ตั้งค่า StatusBar ตาม platform */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}
