/**
 * PrimaryButton.tsx
 *
 * ปุ่ม CTA หลักของแอป ใช้กับ action สำคัญในแต่ละหน้า
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดงปุ่มหลักพร้อมข้อความ
 * - รองรับ variant แบบ primary, danger และ outline
 * - แสดง loading แทนข้อความระหว่างกำลังทำงาน
 * - รองรับ icon ด้านหน้าข้อความ
 */

import React from 'react';
import { TouchableOpacityProps, View } from 'react-native';

import { Bounceable } from './Bounceable';
import KanitText from './KanitText';
import { ModernSpinner } from './ModernSpinner';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'outline';
  testID?: string;
  icon?: React.ReactNode;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  loading = false,
  variant = 'primary',
  style,
  disabled,
  icon,
  ...props
}) => {
  const baseStyle = 'rounded-2xl py-4 items-center justify-center';

  let bgStyle = 'bg-[#16AD78]';
  let textStyle = 'text-white';

  // เลือกสีและเส้นขอบของปุ่มตาม variant ที่หน้าจอส่งเข้ามา
  if (variant === 'danger') {
    bgStyle = 'bg-red-500';
  } else if (variant === 'outline') {
    bgStyle = 'bg-transparent border border-gray-300';
    textStyle = 'text-gray-700';
  }

  return (
    <Bounceable
      testID={props.testID || 'primary-button'}
      className={`${baseStyle} ${bgStyle} ${disabled || loading ? 'opacity-70' : ''}`}
      disabled={disabled || loading}
      scale={0.96}
      style={style}
      {...props}
    >
      {loading ? (
        <ModernSpinner
          testID="button-loading-indicator"
          size={20}
          color={variant === 'outline' ? '#374151' : '#FFFFFF'}
        />
      ) : (
        <View className="flex-row items-center justify-center">
          {icon && <View className="mr-2">{icon}</View>}
          <KanitText className={`text-[16px] ${textStyle}`}>{title}</KanitText>
        </View>
      )}
    </Bounceable>
  );
};
