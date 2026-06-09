/**
 * useNavBarInset.ts
 *
 * Hook สำหรับคืนค่า bottom safe-area inset ให้ layout ที่จัดการขอบล่างเอง
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - อ่านค่า bottom inset จาก safe area
 * - คืนค่าให้ screen หรือ component ใช้เพิ่ม padding ด้านล่างเอง
 * - ใช้กับ layout ที่ไม่ได้ให้ SafeAreaView จัดการ bottom edge โดยตรง
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const useNavBarInset = () => {
  // ใช้ในหน้าที่ต้องจัด padding bottom เอง เช่น camera หรือ layout เฉพาะทาง
  const { bottom } = useSafeAreaInsets();

  return bottom;
};
