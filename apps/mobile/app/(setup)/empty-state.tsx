/**
 * Setup Welcome Screen
 *
 * หน้านี้เป็นหน้าเริ่มต้นของ Setup Flow
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - ตรวจว่าบัญชีนี้มีข้อมูลผู้สูงอายุอยู่แล้วหรือไม่
 * - ถ้ามีข้อมูลแล้ว จะข้ามไปหน้า Dashboard
 * - ถ้ายังไม่มี จะแสดงขั้นตอนการตั้งค่า 3 ขั้นตอน
 * - ผู้ใช้สามารถเริ่มลงทะเบียน หรือออกจากระบบได้
 */

import React, { useEffect, useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { MaterialSymbol } from '../../components/MaterialSymbol';
import Animated, { useSharedValue, withTiming, FadeInDown } from 'react-native-reanimated';

import KanitText from '../../components/KanitText';
import { ScreenWrapper } from '../../components/ScreenWrapper';

import { safeRouter as router } from '../../utils/safeRouter';
import Logger from '../../utils/logger';
import { getCurrentElder } from '../../services/elderService';
import { showSuccessToast } from '../../utils/toast';

import { useAuth } from '../../context/AuthContext';
import {
  setSetupElderId,
  setSetupStep,
  clearSetupElderId,
  clearSetupStep,
} from '../../utils/setupStorage';

// รายการขั้นตอนที่แสดงบนหน้า Setup Welcome
const SETUP_STEPS = [
  {
    num: '1',
    title: 'กรอกข้อมูลผู้สูงอายุ',
    desc: 'ระบุชื่อผู้สูงอายุที่ต้องการดูแล',
  },
  {
    num: '2',
    title: 'เชื่อมต่ออุปกรณ์',
    desc: 'เปิดสวิตช์อุปกรณ์ และสแกน QR Code',
  },
  {
    num: '3',
    title: 'ตั้งค่า WiFi',
    desc: 'ระบุอินเทอร์เน็ตบ้านให้อุปกรณ์เชื่อมต่อ',
  },
];

export default function SetupEmptyStateScreen() {
  // ใช้สำหรับออกจากระบบ
  // ถัดไปจะทำงานผ่าน AuthContext
  const { signOut } = useAuth();

  const handleElderFound = useCallback(async (elderId: string, manual: boolean) => {
    // บันทึกว่า setup ของผู้ใช้นี้มี elder แล้ว
    await setSetupElderId(String(elderId));
    await setSetupStep('complete');

    if (manual) {
      showSuccessToast('เข้าสู่ระบบสำเร็จ');
      router.navigate('/(tabs)/dashboard');
    } else {
      router.navigate('/(tabs)/dashboard');
    }
  }, []);

  const checkAccess = useCallback(
    async (manual = false) => {
      try {
        // ตรวจว่าบัญชีนี้มีข้อมูลผู้สูงอายุแล้วหรือยัง
        // ไฟล์ถัดไป: services/elderService.ts
        const currentElder = await getCurrentElder();

        if (currentElder) {
          Logger.info('Elder found, redirecting to tabs');

          // ถ้ามี elder แล้ว ให้บันทึกสถานะ setup และไปหน้า Dashboard
          await handleElderFound(currentElder.id, manual);
          return true;
        }

        return false;
      } catch (error) {
        Logger.error('Error checking access:', error);
        return false;
      }
    },
    [handleElderFound],
  );

  const handleCreateNew = () => {
    // เริ่ม Setup Flow
    // ถัดไปไปหน้า step1-elder-info
    router.push('/(setup)/step1-elder-info');
  };

  const handleLogout = async () => {
    try {
      // ล้างข้อมูล setup ที่อาจค้างอยู่ในเครื่องก่อนออกจากระบบ
      await clearSetupElderId();
      await clearSetupStep();

      // ออกจากระบบ
      // ถัดไปจะทำงานผ่าน AuthContext
      await signOut();

      router.replace('/(auth)/login');
    } catch (e) {
      Logger.error('Logout error', e);
      router.replace('/(auth)/login');
    }
  };

  useEffect(() => {
    // เมื่อเข้าหน้านี้ ให้ตรวจสิทธิ์ทันที
    // ถ้ามี elder อยู่แล้ว จะข้ามไป Dashboard
    checkAccess(false);
  }, [checkAccess]);

  // ค่าเริ่มต้นสำหรับ animation ตอนเปิดหน้า
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    // เริ่ม animation ให้เนื้อหาค่อย ๆ แสดงขึ้นมา
    opacity.value = withTiming(1, { duration: 800 });
    translateY.value = withTiming(0, { duration: 800 });
  }, [opacity, translateY]);

  return (
    <ScreenWrapper
      className="flex-1 bg-white"
      edges={['top', 'left', 'right', 'bottom']}
      useScrollView={false}
      keyboardAvoiding={false}
    >
      <View className="flex-1 px-6 pt-8 pb-8">
        <View>
          {/* หัวข้อของหน้า Setup Welcome */}
          <Animated.View entering={FadeInDown.delay(150).duration(600)}>
            <KanitText weight="medium" className="text-2xl text-gray-900 text-center mb-1">
              เริ่มต้นใช้งาน FallHelp
            </KanitText>
            <KanitText
              className="text-base text-gray-500 text-center px-1 mb-8"
              style={{ lineHeight: 20 }}
            >
              ติดตั้งอุปกรณ์ 3 ขั้นตอนง่ายๆ เพื่อเริ่มดูแลผู้สูงอายุอย่างอุ่นใจ
            </KanitText>
          </Animated.View>

          {/* การ์ดแสดงขั้นตอนการตั้งค่า */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(600)}
            style={{
              marginTop: 24,
              backgroundColor: '#fff',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              paddingVertical: 8,
              paddingHorizontal: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            {SETUP_STEPS.map((step, idx) => (
              <View key={idx} style={{ flexDirection: 'row', paddingVertical: 16 }}>
                {/* วงกลมตัวเลขของแต่ละขั้นตอน */}
                <View style={{ width: 36, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: '#F9FAFB',
                      borderWidth: 1.5,
                      borderColor: '#D1D5DB',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <KanitText weight="medium" style={{ color: '#6B7280', fontSize: 14 }}>
                      {step.num}
                    </KanitText>
                  </View>

                  {/* เส้นเชื่อมระหว่างขั้นตอน */}
                  {idx < SETUP_STEPS.length - 1 && (
                    <View
                      style={{
                        width: 1.5,
                        flex: 1,
                        marginTop: 4,
                        backgroundColor: '#E5E7EB',
                        minHeight: 16,
                      }}
                    />
                  )}
                </View>

                {/* ชื่อและคำอธิบายของขั้นตอน */}
                <View
                  style={{ flex: 1, paddingLeft: 14, justifyContent: 'flex-start', paddingTop: 4 }}
                >
                  <KanitText
                    weight="medium"
                    style={{ fontSize: 15, color: '#111827', marginBottom: 2 }}
                  >
                    {step.title}
                  </KanitText>
                  <KanitText style={{ fontSize: 13, color: '#6B7280', lineHeight: 18 }}>
                    {step.desc}
                  </KanitText>
                </View>
              </View>
            ))}

            {/* เป้าหมายสุดท้ายหลังตั้งค่าเสร็จ */}
            <View style={{ flexDirection: 'row', paddingVertical: 16 }}>
              <View style={{ width: 36, alignItems: 'center' }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#D1FAE5',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialSymbol name="check" size={18} color="#059669" />
                </View>
              </View>
              <View
                style={{ flex: 1, paddingLeft: 14, justifyContent: 'flex-start', paddingTop: 4 }}
              >
                <KanitText
                  weight="medium"
                  style={{ fontSize: 15, color: '#059669', marginBottom: 2 }}
                >
                  เสร็จสมบูรณ์
                </KanitText>
                <KanitText style={{ fontSize: 13, color: '#6B7280', lineHeight: 18 }}>
                  พร้อมรับแจ้งเตือนเมื่อเกิดเหตุฉุกเฉิน
                </KanitText>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* ปุ่มเริ่ม Setup และปุ่มออกจากระบบ */}
        <Animated.View entering={FadeInDown.delay(700).duration(600)} className="pt-10">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCreateNew}
            className="bg-[#16AD78] rounded-[14px] py-3.5 items-center justify-center"
          >
            <KanitText weight="medium" className="text-lg text-white">
              เริ่มลงทะเบียน
            </KanitText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            className="items-center justify-center py-4 mt-1"
          >
            <KanitText className="text-sm text-gray-400 underline">ออกจากระบบ</KanitText>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </ScreenWrapper>
  );
}
