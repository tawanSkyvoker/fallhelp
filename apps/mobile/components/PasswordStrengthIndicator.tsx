/**
 * PasswordStrengthIndicator.tsx
 *
 * ข้อความแนะนำเงื่อนไขรหัสผ่านขั้นต่ำก่อน submit
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดงหัวข้อคำแนะนำการตั้งรหัสผ่าน
 * - บอกเงื่อนไขพื้นฐานที่ผู้ใช้ต้องทำตาม
 * - ใช้เป็น UI เสริมในหน้าสมัครสมาชิกหรือเปลี่ยนรหัสผ่าน
 */

import React from 'react';
import { View } from 'react-native';

import KanitText from './KanitText';
import { MaterialSymbol } from './MaterialSymbol';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = () => {
  return (
    <View className="mb-4 px-1">
      <KanitText weight="medium" className="font-kanit" style={{ fontSize: 12, color: '#6B7280' }}>
        คำแนะนำการตั้งรหัสผ่าน
      </KanitText>
      <View className="mt-2 gap-1">
        <View className="flex-row items-start">
          <MaterialSymbol
            name="fiber_manual_record"
            size={8}
            color="#9CA3AF"
            style={{ marginTop: 4, marginRight: 8 }}
          />
          <KanitText className="font-kanit flex-1" style={{ fontSize: 12, color: '#9CA3AF' }}>
            ใช้อย่างน้อย 8 ตัวอักษร
          </KanitText>
        </View>
        <View className="flex-row items-start">
          <MaterialSymbol
            name="fiber_manual_record"
            size={8}
            color="#9CA3AF"
            style={{ marginTop: 4, marginRight: 8 }}
          />
          <KanitText className="font-kanit flex-1" style={{ fontSize: 12, color: '#9CA3AF' }}>
            ต้องมีตัวพิมพ์ใหญ่ (A-Z), ตัวพิมพ์เล็ก (a-z) และตัวเลข (0-9)
          </KanitText>
        </View>
      </View>
    </View>
  );
};
