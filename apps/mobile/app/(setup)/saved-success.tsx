/**
 * Setup Saved Success Screen
 *
 * หน้านี้เป็นหน้าสุดท้ายของ Setup Flow
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - บันทึกว่า setup เสร็จสมบูรณ์แล้ว
 * - ล้างข้อมูลชั่วคราวที่ใช้ระหว่าง setup
 * - เตรียมให้ Dashboard โหลดข้อมูลผู้สูงอายุใหม่
 * - รอสั้น ๆ แล้วพาผู้ใช้ไปหน้า Dashboard
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { MaterialIconSolid } from '../../components/MaterialIconSolid';
import { useQueryClient } from '@tanstack/react-query';

import KanitText from '../../components/KanitText';
import { ScreenWrapper } from '../../components/ScreenWrapper';

import { safeRouter as router } from '../../utils/safeRouter';
import Logger from '../../utils/logger';

import { queryKeys } from '../../hooks/queryKeys';
import {
  clearBootCache,
  clearSetupSerialNumber,
  setLastResolvedRoute,
  setSetupStep,
  readBootData,
} from '../../utils/setupStorage';

const AUTO_REDIRECT_DELAY_MS = 1500;

export default function SetupSavedSuccessScreen() {
  // ใช้จัดการ cache ของ React Query
  const queryClient = useQueryClient();

  // เก็บ timer สำหรับ auto redirect
  // ใช้ล้าง timer ได้ตอนออกจากหน้าก่อนครบเวลา
  const autoRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSetupCompletion = useCallback(async () => {
    // บันทึกว่า setup เสร็จแล้ว
    await setSetupStep('complete');

    // บอก route guard ว่าครั้งต่อไปควรเข้า main app
    await setLastResolvedRoute('main');

    // ล้าง serial number ที่ใช้เฉพาะระหว่าง Step 3
    await clearSetupSerialNumber();

    // ล้าง boot cache ก่อนอ่านค่าใหม่
    // เพื่อกัน route guard อ่านค่าเก่าแล้วพากลับไป setup
    clearBootCache();

    // อ่าน boot data ใหม่หลัง setup complete
    await readBootData();
  }, []);

  const goToHome = useCallback(async () => {
    try {
      // ก่อนเข้า Dashboard ให้ยืนยันอีกครั้งว่า setup ถูกบันทึกครบแล้ว
      await syncSetupCompletion();
    } catch (error) {
      // ถ้าบันทึกบางอย่างไม่สำเร็จ ยังไม่ควรค้างหน้านี้
      Logger.warn('Failed to sync setup completion before going home', error);
    }

    // ไปหน้า Dashboard
    router.replace('/(tabs)/dashboard');
  }, [syncSetupCompletion]);

  useEffect(() => {
    const persistSetupCompletion = async () => {
      try {
        // เมื่อเข้าหน้านี้ ให้บันทึกสถานะ setup complete ทันที
        await syncSetupCompletion();
      } catch (error) {
        Logger.warn('Failed to persist setup completion', error);
      }
    };

    persistSetupCompletion();

    // บังคับให้ Dashboard โหลดข้อมูลผู้สูงอายุใหม่เมื่อเข้าไป
    queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });
  }, [queryClient, syncSetupCompletion]);

  useEffect(() => {
    // รอให้ผู้ใช้เห็นหน้าสำเร็จสั้น ๆ แล้วค่อยไป Dashboard
    autoRedirectTimerRef.current = setTimeout(() => {
      autoRedirectTimerRef.current = null;

      // ถัดไปไปที่ goToHome()
      goToHome();
    }, AUTO_REDIRECT_DELAY_MS);

    return () => {
      // ออกจากหน้าก่อนครบเวลา ต้องล้าง timer เพื่อกัน callback ทำงานซ้ำ
      if (autoRedirectTimerRef.current) {
        clearTimeout(autoRedirectTimerRef.current);
        autoRedirectTimerRef.current = null;
      }
    };
  }, [goToHome]);

  return (
    <ScreenWrapper
      style={{ backgroundColor: '#FFFFFF' }}
      edges={['top', 'left', 'right', 'bottom']}
      useScrollView={false}
    >
      <View className="flex-1 items-center justify-center px-6">
        {/* ไอคอนแสดงว่า setup สำเร็จ */}
        <View className="mb-8">
          <MaterialIconSolid name="check_circle" size={120} color="#10B981" />
        </View>

        {/* ข้อความสรุปผลหลัง setup เสร็จ */}
        <View className="items-center mb-12 w-full">
          <KanitText weight="medium" className="text-gray-900 text-3xl mb-3 text-center">
            สำเร็จ!
          </KanitText>
          <KanitText className="text-gray-500 text-lg text-center mb-2">
            ตั้งค่าเรียบร้อยแล้ว
          </KanitText>
          <KanitText className="text-gray-400 text-base text-center max-w-[280px]">
            ระบบพร้อมใช้งานแล้ว คุณสามารถเริ่มดูแลผู้สูงอายุได้ทันที
          </KanitText>
        </View>

        {/* แจ้งผู้ใช้ว่าระบบจะพาไปหน้าหลักอัตโนมัติ */}
        <KanitText className="text-gray-400 text-sm text-center">กำลังเข้าสู่หน้าหลัก...</KanitText>
      </View>
    </ScreenWrapper>
  );
}
