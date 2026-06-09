/**
 * CascadingAddressPicker.tsx
 *
 * ตัวเลือกที่อยู่ไทยแบบล้อเลื่อน 3 ขั้นตอน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดงช่องเลือกที่อยู่ในฟอร์ม
 * - เปิด bottom sheet สำหรับเลือกจังหวัด อำเภอ และตำบลตามลำดับ
 * - เก็บค่าที่กำลังเลือกไว้ชั่วคราวก่อนกดยืนยัน
 * - คืนค่าที่อยู่พร้อมรหัสไปรษณีย์กลับไปให้ฟอร์มผ่าน onChange
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Animated,
  Pressable,
  Modal,
  StyleSheet,
  BackHandler,
  TouchableOpacity,
  Easing,
} from 'react-native';
import { MaterialSymbol } from './MaterialSymbol';

import KanitText from './KanitText';
import { WheelSelectColumn, WHEEL_PICKER_HEIGHT } from './WheelSelectColumn';

import { modalGuard } from '../utils/modalGuard';
import { runAfterKeyboardDismiss } from '../utils/keyboard';
import { getProvinces, getAmphoes, getDistricts, getZipcode } from '../utils/thailandAddress';

const SHEET_OFFSET = WHEEL_PICKER_HEIGHT + 200;

const MODAL_KEY = 'cascading-address-picker';

const BLUE = '#2563EB';

export interface AddressData {
  district: string;
  amphoe: string;
  province: string;
  zipcode: string;
}

type PickerStep = 'province' | 'amphoe' | 'district';

interface CascadingAddressPickerProps {
  value: AddressData | null;
  onChange: (address: AddressData) => void;
  placeholder?: string;
  isRequired?: boolean;
  error?: string;
}

export function CascadingAddressPicker({
  value,
  onChange,
  placeholder = 'เลือกที่อยู่ (จังหวัด / อำเภอ / ตำบล)',
  isRequired = false,
  error,
}: CascadingAddressPickerProps) {
  // showModal ใช้บอกว่าควรเปิด modal ส่วน isMounted ใช้ค้างไว้ระหว่าง animation ปิด
  const [showModal, setShowModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  // step ใช้ควบคุมว่าตอนนี้กำลังเลือกจังหวัด อำเภอ หรือตำบล
  const [step, setStep] = useState<PickerStep>('province');

  // draft เก็บค่าที่เลือกชั่วคราวก่อนกดตกลง
  const [draftProvince, setDraftProvince] = useState('');
  const [draftAmphoe, setDraftAmphoe] = useState('');
  const [draftDistrict, setDraftDistrict] = useState('');

  // โหลดชุดข้อมูลที่อยู่จาก util และค่อยกรองตามค่าที่เลือกไว้
  // ไฟล์ถัดไป: utils/thailandAddress.ts
  const provinces = useMemo(() => getProvinces(), []);

  const amphoes = useMemo(() => {
    return draftProvince ? getAmphoes(draftProvince) : [];
  }, [draftProvince]);

  const districts = useMemo(() => {
    return draftProvince && draftAmphoe ? getDistricts(draftProvince, draftAmphoe) : [];
  }, [draftProvince, draftAmphoe]);

  // currentList คือรายการที่ส่งเข้า wheel ตาม step ปัจจุบัน
  const currentList = useMemo(() => {
    if (step === 'province') return provinces;
    if (step === 'amphoe') return amphoes;
    return districts;
  }, [step, provinces, amphoes, districts]);

  const selectedIndex = useMemo(() => {
    const activeValue =
      step === 'province'
        ? draftProvince || provinces[0] || ''
        : step === 'amphoe'
          ? draftAmphoe || amphoes[0] || ''
          : draftDistrict || districts[0] || '';
    const index = currentList.indexOf(activeValue);
    return index >= 0 ? index : 0;
  }, [step, draftProvince, draftAmphoe, draftDistrict, provinces, amphoes, districts, currentList]);

  const handleWheelChange = useCallback(
    (index: number) => {
      const nextValue = currentList[index] || '';
      if (step === 'province') {
        setDraftProvince(nextValue);
      } else if (step === 'amphoe') {
        setDraftAmphoe(nextValue);
      } else {
        setDraftDistrict(nextValue);
      }
    },
    [currentList, step],
  );

  const getAddressLabel = useCallback((item: string) => item, []);

  const stepTitle: Record<PickerStep, string> = {
    province: 'เลือกจังหวัด',
    amphoe: 'เลือกอำเภอ / เขต',
    district: 'เลือกตำบล / แขวง',
  };

  const animateOpen = useCallback(() => {
    setIsMounted(true);
    Animated.timing(animation, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animation]);

  const animateClose = useCallback(
    (onDone: () => void) => {
      Animated.timing(animation, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsMounted(false);
          onDone();
        }
      });
    },
    [animation],
  );

  const handleClose = useCallback(() => {
    animateClose(() => {
      setShowModal(false);
      modalGuard.release(MODAL_KEY);
    });
  }, [animateClose]);

  useEffect(() => () => modalGuard.release(MODAL_KEY), []);

  useEffect(() => {
    if (!showModal) return;

    // กดปุ่ม back ของ Android แล้วปิด sheet แทนการย้อนหน้า
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });

    return () => sub.remove();
  }, [showModal, handleClose]);

  const handleOpen = () => {
    // กัน modal เปิดซ้อนกับ modal อื่นในแอป
    // ไฟล์ถัดไป: utils/modalGuard.ts
    if (!modalGuard.acquire(MODAL_KEY)) return;

    // รอ keyboard ปิดก่อนเปิด sheet เพื่อลดอาการ layout กระโดด
    // ไฟล์ถัดไป: utils/keyboard.ts
    runAfterKeyboardDismiss(() => {
      const initialProvince = value?.province || provinces[0] || '';

      setStep('province');
      setDraftProvince(initialProvince);
      setDraftAmphoe(value?.amphoe || '');
      setDraftDistrict(value?.district || '');

      setShowModal(true);
      animateOpen();
    });
  };

  const handleNext = () => {
    if (step === 'province') {
      const selectedProvince = draftProvince || provinces[0] || '';
      setDraftProvince(selectedProvince);

      // ดึงรายชื่ออำเภอทั้งหมดในจังหวัดที่เลือก
      const nextAmphoes = getAmphoes(selectedProvince);

      // ตรวจสอบว่าดราฟต์อำเภอที่มีอยู่เดิมเป็นของจังหวัดนี้หรือไม่
      if (draftAmphoe && nextAmphoes.includes(draftAmphoe)) {
        // มีอำเภอนี้ในจังหวัดใหม่ ให้ใช้อำเภอเดิม ไม่ต้องรีเซ็ต
        // และตรวจสอบด้วยว่าตำบลเดิมใช้ได้กับอำเภอนี้หรือไม่
        const nextDistricts = getDistricts(selectedProvince, draftAmphoe);
        if (draftDistrict && nextDistricts.includes(draftDistrict)) {
          // ตำบลเดิมมีอยู่ในอำเภอเดิม ใช้ค่าเดิมต่อไป
        } else {
          // ตำบลเดิมไม่มีอยู่ ให้รีเซ็ตตำบลเป็นตัวแรกของอำเภอ
          setDraftDistrict(nextDistricts[0] || '');
        }
      } else {
        // ไม่มีอำเภอนี้ ให้รีเซ็ตเป็นอำเภอแรกของจังหวัดนั้น และรีเซ็ตตำบลเป็นตัวแรกของอำเภอใหม่
        const nextAmphoe = nextAmphoes[0] || '';
        setDraftAmphoe(nextAmphoe);
        const nextDistricts = nextAmphoe ? getDistricts(selectedProvince, nextAmphoe) : [];
        setDraftDistrict(nextDistricts[0] || '');
      }

      setStep('amphoe');
    } else if (step === 'amphoe') {
      const selectedAmphoe = draftAmphoe || amphoes[0] || '';
      setDraftAmphoe(selectedAmphoe);

      // ดึงรายชื่อตำบลทั้งหมดในอำเภอที่เลือก
      const nextDistricts = getDistricts(draftProvince, selectedAmphoe);

      // ตรวจสอบว่าดราฟต์ตำบลเดิมอยู่ในรายชื่อตำบลของอำเภอนี้หรือไม่
      if (draftDistrict && nextDistricts.includes(draftDistrict)) {
        // ตำบลเดิมมีอยู่ในอำเภอนี้ ใช้ค่าเดิม ไม่ต้องรีเซ็ต
      } else {
        // ถ้าไม่มีตำบลเดิม ให้ใช้ตำบลแรกในรายการ
        const nextDistrict = nextDistricts[0] || '';
        setDraftDistrict(nextDistrict);
      }

      setStep('district');
    }
  };

  const handleConfirm = () => {
    const finalDistrict = draftDistrict || districts[0] || '';
    const zipcode = getZipcode(draftProvince, draftAmphoe, finalDistrict);

    setDraftDistrict(finalDistrict);

    // ส่งค่าที่อยู่สุดท้ายกลับไปให้ฟอร์มที่เรียก component นี้
    onChange({
      province: draftProvince,
      amphoe: draftAmphoe,
      district: finalDistrict,
      zipcode: zipcode ? String(zipcode) : '',
    });

    handleClose();
  };

  const displayValue = value?.district
    ? `${value.province} · ${value.amphoe} · ${value.district}`
    : null;

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_OFFSET, 0],
  });

  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const isActive = showModal || isMounted;
  const isLastStep = step === 'district';

  const borderColor = error ? '#EF4444' : '#E5E7EB';

  return (
    <View style={{ marginBottom: 16, marginTop: 4 }}>
      {/* ปุ่มหลักของฟอร์ม ใช้แสดงค่าปัจจุบันและเปิดตัวเลือกที่อยู่ */}
      <TouchableOpacity
        onPress={handleOpen}
        activeOpacity={0.7}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          paddingHorizontal: 16,
          justifyContent: 'center',
          borderWidth: 1,
          borderColor,
          height: 56,
        }}
      >
        {displayValue && (
          <View style={styles.floatingLabel}>
            <KanitText style={{ fontSize: 12, color: error ? '#EF4444' : '#9CA3AF' }}>
              ที่อยู่{isRequired && <KanitText style={{ color: '#EF4444' }}> *</KanitText>}
            </KanitText>
          </View>
        )}

        <View style={styles.row}>
          <KanitText
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 16,
              marginRight: 8,
              color: displayValue ? '#111827' : '#9CA3AF',
            }}
          >
            {displayValue ?? (
              <>
                {placeholder}
                {isRequired && <KanitText style={{ color: '#EF4444' }}> *</KanitText>}
              </>
            )}
          </KanitText>
          <MaterialSymbol name="expand_more" size={24} color="#9CA3AF" />
        </View>
      </TouchableOpacity>

      {error && (
        <KanitText style={{ fontSize: 12, color: '#EF4444', marginTop: 4, marginLeft: 4 }}>
          {error}
        </KanitText>
      )}

      {/* bottom sheet แยกอยู่ใน Modal เพื่อไม่ให้ layout ของฟอร์มด้านหลังถูกรบกวน */}
      <Modal
        visible={isActive}
        transparent
        animationType="none"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.modalContainer}>
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
                <Pressable onPress={handleClose} style={styles.headerBtn}>
                  <KanitText className="text-gray-500 text-lg">ยกเลิก</KanitText>
                </Pressable>

                <KanitText weight="medium" className="text-lg text-gray-800">
                  {stepTitle[step]}
                </KanitText>

                <Pressable
                  onPress={isLastStep ? handleConfirm : handleNext}
                  style={[styles.headerBtn, { alignItems: 'flex-end' }]}
                >
                  <KanitText weight="medium" className="text-blue-600 text-lg">
                    {isLastStep ? 'ตกลง' : 'ต่อไป'}
                  </KanitText>
                </Pressable>
              </View>

              {/* จุดบอกขั้นตอน ช่วยให้ผู้ใช้รู้ว่ากำลังเลือกชั้นไหนของที่อยู่ */}
              <View style={styles.stepDots}>
                {(['province', 'amphoe', 'district'] as PickerStep[]).map((s) => (
                  <View
                    key={s}
                    style={{
                      width: step === s ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: step === s ? BLUE : '#E5E7EB',
                      marginHorizontal: 3,
                    }}
                  />
                ))}
              </View>

              <View style={styles.wheelFrame}>
                <WheelSelectColumn
                  key={step}
                  items={currentList}
                  selectedIndex={selectedIndex}
                  onIndexChange={handleWheelChange}
                  getLabel={getAddressLabel}
                  isVisible={showModal}
                />
              </View>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  floatingLabel: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  modalContainer: {
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
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  wheelFrame: {
    height: WHEEL_PICKER_HEIGHT,
    marginTop: 4,
  },
});
