/**
 * GenderSelect.tsx
 *
 * ตัวเลือกเพศแบบ bottom sheet ที่ใช้หน้าตาเดียวกับ picker อื่นในแอป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดงช่องเลือกเพศด้วย FloatingLabelInput
 * - เปิด bottom sheet ให้ผู้ใช้เลือก ชาย หญิง หรืออื่น ๆ
 * - กัน modal เปิดซ้อน และรอ keyboard ปิดก่อนเปิด picker
 * - ส่งค่าที่เลือกกลับไปยังฟอร์มผ่าน onChange
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Easing,
  BackHandler,
  StyleSheet,
} from 'react-native';
import { TextInput } from 'react-native-paper';

import KanitText from './KanitText';
import { FloatingLabelInput } from './FloatingLabelInput';
import { MaterialSymbol } from './MaterialSymbol';

import { modalGuard } from '../utils/modalGuard';
import { runAfterKeyboardDismiss } from '../utils/keyboard';

interface GenderSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  isRequired?: boolean;
}

const OPTIONS = [
  { label: 'ชาย', value: 'MALE' },
  { label: 'หญิง', value: 'FEMALE' },
  { label: 'อื่นๆ', value: 'OTHER' },
];

const SHEET_HEIGHT = 56 + 56 * 3 + 32;

export function GenderSelect({
  value,
  onChange,
  label = 'เพศ',
  error,
  isRequired = false,
}: GenderSelectProps) {
  const MODAL_KEY = 'gender-select';

  // showPicker ใช้บอกสถานะเปิด ส่วน isMounted ใช้ค้าง Modal ไว้จน animation ปิดจบ
  const [showPicker, setShowPicker] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // animation ใช้ขยับ sheet และ fade backdrop
  const animation = useRef(new Animated.Value(0)).current;

  // ออกจาก component แล้วต้อง release modal guard กันสถานะค้าง
  useEffect(() => () => modalGuard.release(MODAL_KEY), []);

  useEffect(() => {
    if (!showPicker) return;

    // กดปุ่ม back ของ Android แล้วปิด sheet แทนการย้อนหน้า
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });

    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPicker]);

  const animateOpen = () => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const animateClose = (cb?: () => void) => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) cb?.();
    });
  };

  const handleOpen = () => {
    // รอ keyboard ปิดก่อนเปิด sheet เพื่อลดอาการ layout กระโดด
    // ไฟล์ถัดไป: utils/keyboard.ts
    runAfterKeyboardDismiss(() => {
      // กัน modal เปิดซ้อนกับ modal อื่นในแอป
      // ไฟล์ถัดไป: utils/modalGuard.ts
      if (modalGuard.acquire(MODAL_KEY)) {
        setIsMounted(true);
        setShowPicker(true);
        animateOpen();
      }
    });
  };

  const handleClose = () => {
    // ล้างสถานะเปิดทันที แล้วค่อย unmount หลัง animation ปิดจบ
    setShowPicker(false);
    animateClose(() => {
      setIsMounted(false);
      modalGuard.release(MODAL_KEY);
    });
  };

  const handleSelect = (val: string) => {
    // ส่งค่าที่เลือกกลับไปให้ฟอร์ม แล้วปิด sheet
    onChange(val);
    handleClose();
  };

  const getDisplayValue = (val: string) => {
    const opt = OPTIONS.find((o) => o.value === val);
    return opt?.label ?? '';
  };

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_HEIGHT + 100, 0],
  });

  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const isVisible = showPicker || isMounted;

  return (
    <View>
      <TouchableOpacity activeOpacity={1} onPress={handleOpen}>
        <View pointerEvents="none">
          <FloatingLabelInput
            label={label}
            value={getDisplayValue(value)}
            editable={false}
            isRequired={isRequired}
            {...(error !== undefined ? { error } : {})}
            forceActive={showPicker}
            right={
              <TextInput.Icon
                icon={({ size }) => (
                  <MaterialSymbol
                    name="expand_more"
                    size={size}
                    color={showPicker ? '#16AD78' : '#6B7280'}
                  />
                )}
                forceTextInputFocus={false}
              />
            }
          />
        </View>
      </TouchableOpacity>

      <Modal
        transparent
        visible={isVisible}
        animationType="none"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.container}>
            {/* แตะพื้นหลังเพื่อปิด sheet */}
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: '#000', opacity: backdropOpacity },
                ]}
              />
            </Pressable>

            <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
              <View style={styles.header}>
                <Pressable
                  onPress={handleClose}
                  style={[styles.headerBtn, { alignItems: 'flex-start' }]}
                >
                  <KanitText className="text-gray-500 text-lg">ยกเลิก</KanitText>
                </Pressable>

                <KanitText weight="medium" className="text-lg text-gray-800">
                  เลือกเพศ
                </KanitText>

                {/* ช่องว่างด้านขวาใช้ถ่วงให้ title อยู่กลาง header */}
                <View style={[styles.headerBtn, { alignItems: 'flex-end' }]} />
              </View>

              {OPTIONS.map((option, idx) => {
                const isSelected = value === option.value;
                const isLast = idx === OPTIONS.length - 1;

                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => handleSelect(option.value)}
                    style={[styles.optionRow, !isLast && styles.optionBorder]}
                    activeOpacity={0.6}
                  >
                    <KanitText
                      weight={isSelected ? 'medium' : 'regular'}
                      className={`text-center text-lg ${isSelected ? 'text-blue-600' : 'text-gray-800'}`}
                    >
                      {option.label}
                    </KanitText>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerBtn: {
    padding: 8,
    minWidth: 64,
    justifyContent: 'center',
  },
  optionRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  optionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
});
