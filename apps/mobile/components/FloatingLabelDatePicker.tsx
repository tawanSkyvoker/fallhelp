/**
 * FloatingLabelDatePicker.tsx
 *
 * ช่องเลือกวันที่แบบ floating label สำหรับฟอร์มทั่วไป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดงช่องวันที่พร้อม label และ error state
 * - เปิด ImprovedDatePicker เมื่อผู้ใช้กดช่องวันที่
 * - กัน modal เปิดซ้อนกับ modal อื่นในแอป
 * - แปลงวันที่เป็นรูปแบบภาษาไทยก่อนแสดงในฟอร์ม
 */

import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { MaterialSymbol } from './MaterialSymbol';
import { useTheme } from 'react-native-paper';

import KanitText from './KanitText';
import { ImprovedDatePicker } from './ImprovedDatePicker';

import { modalGuard } from '../utils/modalGuard';
import { runAfterKeyboardDismiss } from '../utils/keyboard';

interface FloatingLabelDatePickerProps {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  isRequired?: boolean;
  error?: string;
  disabled?: boolean;
  containerStyle?: object;
}

export function FloatingLabelDatePicker({
  label = 'วัน/เดือน/ปีเกิด',
  value,
  onChange,
  isRequired = false,
  error,
  disabled = false,
  containerStyle,
}: FloatingLabelDatePickerProps) {
  const theme = useTheme();

  // ใช้ควบคุมการเปิดปิด date picker ด้านล่าง
  const [showDatePicker, setShowDatePicker] = useState(false);

  const MODAL_KEY = 'date-picker';

  // ออกจาก component แล้วต้อง release modal guard กันสถานะค้าง
  useEffect(() => () => modalGuard.release(MODAL_KEY), []);

  const openPicker = () => {
    if (disabled) return;

    // รอ keyboard ปิดก่อนเปิด picker เพื่อลดอาการ layout กระโดด
    // ไฟล์ถัดไป: utils/keyboard.ts
    runAfterKeyboardDismiss(() => {
      // กัน modal เปิดซ้อนกับ modal อื่นในแอป
      // ไฟล์ถัดไป: utils/modalGuard.ts
      if (modalGuard.acquire(MODAL_KEY)) {
        setShowDatePicker(true);
      }
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return label;

    const day = date.getDate();
    const month = date.toLocaleDateString('th-TH', { month: 'long' });

    let year = date.getFullYear();

    // กันปี พ.ศ. ซ้ำ ถ้าค่าที่เข้ามาเป็น พ.ศ. อยู่แล้ว
    if (year < 2400) {
      year += 543;
    }

    return `${day} ${month} ${year}`;
  };

  // สีขอบและ label เปลี่ยนตาม error หรือสถานะเปิด picker
  const borderColor = error ? theme.colors.error : showDatePicker ? '#16AD78' : '#E5E7EB';

  const labelColor = error ? theme.colors.error : showDatePicker ? '#16AD78' : '#a3a6af';

  return (
    <View style={[{ marginBottom: 16, marginTop: 4 }, containerStyle]}>
      <TouchableOpacity
        onPress={openPicker}
        className="bg-white rounded-xl px-4 justify-center"
        style={{
          height: 56,
          borderWidth: 1,
          borderColor: borderColor,
          backgroundColor: disabled ? '#F3F4F6' : 'white',
        }}
        disabled={disabled}
      >
        {value ? (
          <View
            className={`absolute -top-2.5 left-3 px-1 z-10 ${
              disabled ? 'bg-gray-100' : 'bg-white'
            }`}
          >
            <KanitText className="font-kanit" style={{ fontSize: 12, color: labelColor }}>
              {label} {isRequired && <KanitText style={{ color: '#EF4444' }}>*</KanitText>}
            </KanitText>
          </View>
        ) : null}

        <KanitText
          className="text-[16px]"
          style={{
            color: value ? theme.colors.onSurface : labelColor,
          }}
        >
          {value ? (
            formatDate(value)
          ) : (
            <>
              {label} {isRequired && <KanitText style={{ color: '#EF4444' }}>*</KanitText>}
            </>
          )}
        </KanitText>

        <View className="absolute right-4 top-4">
          <MaterialSymbol name="calendar_today" size={20} color={labelColor} />
        </View>
      </TouchableOpacity>

      {error && (
        <KanitText
          style={{
            fontFamily: 'Kanit-Regular',
            color: theme.colors.error,
            fontSize: 12,
            marginTop: 4,
            marginLeft: 4,
          }}
        >
          {error}
        </KanitText>
      )}

      <ImprovedDatePicker
        isVisible={showDatePicker}
        onClose={() => {
          setShowDatePicker(false);
          modalGuard.release(MODAL_KEY);
        }}
        onConfirm={(selectedDate) => {
          onChange(selectedDate);
        }}
        initialDate={value}
        title={`เลือก${label}`}
        maxDate={new Date()}
        minYearsAgo={120}
      />
    </View>
  );
}
