/**
 * Auth Success Screen
 *
 * หน้านี้ใช้แสดงผลหลังทำรายการสำเร็จ
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - รับ type จากหน้าก่อนหน้า เพื่อดูว่าสำเร็จจาก Register หรือ Reset Password
 * - แสดงข้อความตามประเภทของรายการ
 * - เมื่อกดปุ่ม จะพาผู้ใช้ไปหน้าถัดไปตาม type
 */

import React from 'react';
import { View } from 'react-native';
import { MaterialSymbol } from '../../components/MaterialSymbol';

import KanitText from '../../components/KanitText';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { PrimaryButton } from '../../components/PrimaryButton';

import { safeRouter as router } from '../../utils/safeRouter';
import Logger from '../../utils/logger';
import { clearAllSetupForCurrentUser, setLastResolvedRoute } from '../../utils/setupStorage';

import { useAuth } from '../../context/AuthContext';
import { useAppSearchParams } from '../../utils/searchParams';

export default function AuthSuccessScreen() {
  // อ่านข้อมูลที่ถูกส่งมาจากหน้าก่อนหน้า
  const searchParams = useAppSearchParams();

  // ใช้สำหรับบันทึกสถานะผู้ใช้หลังสมัครสมาชิกสำเร็จ
  // ถัดไปจะทำงานผ่าน AuthContext
  const { signIn } = useAuth();

  // type ใช้บอกว่าหน้านี้ถูกเปิดจาก flow ไหน
  // register = สมัครสมาชิกสำเร็จ, reset_password = ตั้งรหัสผ่านใหม่สำเร็จ
  const type = searchParams.getStringOrEmpty('type');

  // token จะมีในกรณีสมัครสมาชิกสำเร็จ
  const token = searchParams.getStringOrEmpty('token');

  // ใช้เช็คว่าเป็น flow ตั้งรหัสผ่านใหม่หรือไม่
  const isReset = type === 'reset_password';

  // ข้อความบนหน้าจอจะเปลี่ยนตามประเภทของความสำเร็จ
  const title = isReset ? 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว' : 'ลงทะเบียนสำเร็จ!';
  const description = isReset
    ? 'กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่ของคุณ'
    : 'ยินดีต้อนรับสู่ FallHelp\nบัญชีของคุณถูกสร้างเรียบร้อยแล้ว';

  const iconColor = '#16AD78';
  const titleColor = '#16AD78';

  const handleContinue = async () => {
    if (type === 'register') {
      try {
        // ถ้าเข้ามาจาก Register ให้ใช้ token ที่ได้รับมา Login ต่อทันที
        // ถัดไปไปที่ AuthContext ผ่าน signIn()
        if (token) {
          await signIn(token);
        }

        // ล้างข้อมูล setup เก่าของผู้ใช้ เพื่อเริ่มการตั้งค่าใหม่
        await clearAllSetupForCurrentUser();

        // บันทึกเส้นทางล่าสุดของ setup เพื่อให้แอปรู้ว่าควรเริ่มที่หน้าไหน
        await setLastResolvedRoute('setup-empty');

        // ไปหน้าเริ่มตั้งค่าแอป
        router.replace('/(setup)/empty-state');
      } catch (error) {
        // ถ้ามี error ระหว่างเตรียมข้อมูล setup ยังให้ผู้ใช้ไปหน้า setup ต่อได้
        Logger.warn('Failed to clear setup data', error);
        router.replace('/(setup)/empty-state');
      }
    } else {
      // ถ้าเข้ามาจาก Reset Password ให้กลับไปหน้า Login
      router.replace('/(auth)/login');
    }
  };

  return (
    <ScreenWrapper useScrollView={false} style={{ backgroundColor: 'white' }}>
      <View className="flex-1 px-8 items-center justify-center" style={{ paddingBottom: 40 }}>
        <View className="items-center">
          {/* ไอคอนแสดงว่าทำรายการสำเร็จ */}
          <View className="mb-8 items-center justify-center">
            <View
              testID="success-icon"
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: iconColor,
                alignItems: 'center',
                justifyContent: 'center',
                elevation: 5,
                shadowColor: iconColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
              }}
            >
              <MaterialSymbol name="check" size={64} color="white" />
            </View>
          </View>

          {/* หัวข้อความสำเร็จ */}
          <KanitText
            weight="medium"
            className="text-2xl text-center mb-4"
            style={{ color: titleColor }}
          >
            {title}
          </KanitText>

          {/* คำอธิบายเพิ่มเติมตาม flow ที่เข้ามา */}
          <KanitText className="text-base text-gray-500 text-center leading-6 px-4">
            {description}
          </KanitText>
        </View>

        {/* ปุ่มไปขั้นตอนถัดไป */}
        <View className="w-full mt-10">
          <PrimaryButton
            title={isReset ? 'เข้าสู่ระบบ' : 'เริ่มต้นใช้งาน'}
            onPress={handleContinue}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}
