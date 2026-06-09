/**
 * KanitText.tsx
 *
 * Wrapper รอบ Text สำหรับบังคับใช้ฟอนต์ Kanit ให้คงที่ทุก platform
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับ props เหมือน Text ปกติ
 * - เลือกใช้ Kanit-Regular หรือ Kanit-Medium ตาม weight และ style
 * - กัน React Native สร้าง fontWeight ปลอมจนฟอนต์ไทยเพี้ยน
 */

import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

interface KanitTextProps extends TextProps {
  weight?: 'regular' | 'medium';
}

export default function KanitText({ weight = 'regular', style, ...props }: KanitTextProps) {
  const flatStyle = StyleSheet.flatten(style);

  // ถ้าขอน้ำหนักหนา ให้ map ไปที่ Kanit-Medium เพราะโปรเจกต์ไม่มี Kanit-Bold
  const isBoldStyle =
    flatStyle?.fontWeight === 'bold' ||
    flatStyle?.fontWeight === '700' ||
    flatStyle?.fontWeight === '600' ||
    flatStyle?.fontWeight === '500' ||
    flatStyle?.fontWeight === '800';

  const shouldUseMedium = weight === 'medium' || isBoldStyle;
  const fontFamily = shouldUseMedium ? 'Kanit-Medium' : 'Kanit-Regular';

  // ลบ fontWeight เดิมออก เพื่อกัน React Native สร้าง bold ปลอมเอง
  // วิธีนี้ช่วยลดโอกาส fallback ไปใช้ system font หรือทำให้น้ำหนักตัวอักษรเพี้ยน
  const { fontWeight: _fontWeight, ...otherStyles } = flatStyle || {};

  return <Text {...props} style={[{ fontFamily }, otherStyles]} />;
}
