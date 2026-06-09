/**
 * LoadingScreen.tsx
 *
 * ตัวแสดงสถานะโหลดที่ใช้ได้ทั้งแบบเต็มหน้าและแบบฝังใน section ย่อย
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง loading indicator พร้อมข้อความ
 * - รองรับข้อความ loading ที่ส่งมาจากหน้าหรือ component อื่น
 * - เลือกได้ว่าจะห่อด้วย ScreenWrapper เพื่อใช้เป็น loading เต็มหน้า
 */

import React from 'react';
import { View } from 'react-native';

import KanitText from './KanitText';
import { ScreenWrapper } from './ScreenWrapper';
import { ModernSpinner } from './ModernSpinner';

interface LoadingScreenProps {
  message?: string;
  useScreenWrapper?: boolean;
}

export function LoadingScreen({
  message = 'กำลังโหลด...',
  useScreenWrapper = false,
}: LoadingScreenProps) {
  // Content กลางใช้ร่วมกันทั้งโหมดเต็มหน้าและโหมดฝังใน layout อื่น
  const Content = (
    <View className="flex-1 items-center justify-center bg-white">
      <ModernSpinner size={52} color="#16AD78" />
      {message && (
        <KanitText className="mt-4 text-gray-500 font-kanit text-base">{message}</KanitText>
      )}
    </View>
  );

  // โหมดเต็มหน้าจะห่อด้วย ScreenWrapper เพื่อคุม safe area ให้เหมือนหน้าจอหลัก
  if (useScreenWrapper) {
    return (
      <ScreenWrapper useScrollView={false} edges={['top', 'left', 'right']}>
        {Content}
      </ScreenWrapper>
    );
  }

  return Content;
}
