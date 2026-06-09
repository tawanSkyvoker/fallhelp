/**
 * ImprovedDatePicker.tsx
 *
 * ตัวเลือกวันที่แบบ iOS style พร้อม validation วันที่
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง bottom sheet สำหรับเลือกวัน เดือน และปี
 * - จำกัดวันที่ไม่ให้เกิน maxDate และย้อนหลังตาม minYearsAgo
 * - ปรับวันและเดือนให้ถูกต้องเมื่อปีหรือเดือนเปลี่ยน
 * - ส่ง Date ที่เลือกกลับไปยัง component ที่เรียกใช้ผ่าน onConfirm
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  BackHandler,
  Modal,
  Platform,
} from 'react-native';

import KanitText from './KanitText';
import { WheelSelectColumn, WHEEL_PICKER_HEIGHT } from './WheelSelectColumn';

const MONTHS_TH = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

interface ImprovedDatePickerProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  initialDate?: Date | null;
  title?: string;
  maxDate?: Date;
  minYearsAgo?: number;
}

export const ImprovedDatePicker: React.FC<ImprovedDatePickerProps> = ({
  isVisible,
  onClose,
  onConfirm,
  initialDate,
  title = 'เลือกวันที่',
  maxDate = new Date(),
  minYearsAgo = 120,
}) => {
  // กัน maxDate ที่ไม่ใช่ Date หรือเป็น invalid date
  const safeMaxDate = useMemo(() => {
    return maxDate instanceof Date && !isNaN(maxDate.getTime()) ? maxDate : new Date();
  }, [maxDate]);

  // กัน initialDate ที่ไม่ใช่ Date หรือเป็น invalid date
  const safeInitialDate = useMemo(() => {
    return initialDate instanceof Date && !isNaN(initialDate.getTime()) ? initialDate : null;
  }, [initialDate]);

  const fallbackDate = safeInitialDate || safeMaxDate;

  // เก็บค่าที่เลือกอยู่ในแต่ละคอลัมน์ โดยปีแสดงเป็น พ.ศ.
  const [selectedDay, setSelectedDay] = useState(fallbackDate.getDate());
  const [selectedMonth, setSelectedMonth] = useState(fallbackDate.getMonth());
  const [selectedYearBE, setSelectedYearBE] = useState(fallbackDate.getFullYear() + 543);

  // isMounted ใช้ค้าง Modal ไว้ระหว่าง animation ปิด
  const [isMounted, setIsMounted] = useState(false);
  const [isAdjustingDependentColumns, _setIsAdjustingDependentColumns] = useState(false);

  // animation ใช้ขยับ sheet และ fade backdrop
  const animation = useRef(new Animated.Value(0)).current;
  const SHEET_OFFSET = WHEEL_PICKER_HEIGHT + 160;

  const maxYearBE = safeMaxDate.getFullYear() + 543;
  const minYearBE = maxYearBE - minYearsAgo;

  // สร้างรายการปีจากปีล่าสุดย้อนกลับไปตาม minYearsAgo
  const years = useMemo(() => {
    const yearList: number[] = [];
    for (let y = maxYearBE; y >= minYearBE; y--) {
      yearList.push(y);
    }
    return yearList;
  }, [maxYearBE, minYearBE]);

  const currentYearBE = safeMaxDate.getFullYear() + 543;
  const currentMonth = safeMaxDate.getMonth();
  const currentDay = safeMaxDate.getDate();

  // ถ้าเลือกปีปัจจุบัน ให้แสดงเดือนได้ไม่เกินเดือนของ maxDate
  const months = useMemo(() => {
    if (selectedYearBE === currentYearBE) {
      return Array.from({ length: currentMonth + 1 }, (_, i) => i);
    }

    return Array.from({ length: 12 }, (_, i) => i);
  }, [currentMonth, currentYearBE, selectedYearBE]);

  const getDaysInMonth = useCallback((month: number, yearBE: number) => {
    const yearAD = yearBE - 543;
    return new Date(yearAD, month + 1, 0).getDate();
  }, []);

  // จำนวนวันเปลี่ยนตามเดือนและปี เช่น กุมภาพันธ์ หรือปีอธิกสุรทิน
  // หากเลือกปีและเดือนปัจจุบัน จะไม่แสดงวันในอนาคตที่เกินกว่าวันปัจจุบัน (maxDate)
  const days = useMemo(() => {
    if (selectedYearBE === currentYearBE && selectedMonth === currentMonth) {
      return Array.from({ length: currentDay }, (_, i) => i + 1);
    }
    const count = getDaysInMonth(selectedMonth, selectedYearBE);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [selectedMonth, selectedYearBE, getDaysInMonth, currentYearBE, currentMonth, currentDay]);

  const normalizeSelection = useCallback(
    (yearBE: number, month: number, day: number) => {
      // ถ้าเลือกปีปัจจุบัน ต้องไม่ให้เดือนเกิน maxDate
      const clampedMonth = yearBE === currentYearBE ? Math.min(month, currentMonth) : month;

      // ถ้าเดือนใหม่มีจำนวนวันน้อยกว่าเดิม ให้ลดวันลงมาให้อยู่ในเดือนนั้น
      const maxDays = getDaysInMonth(clampedMonth, yearBE);
      let clampedDay = Math.min(day, maxDays);

      // ถ้าเลือกปีปัจจุบันและเดือนปัจจุบัน ต้องไม่ให้วันเกินวันของ maxDate
      if (yearBE === currentYearBE && clampedMonth === currentMonth) {
        clampedDay = Math.min(clampedDay, currentDay);
      }

      return {
        yearBE,
        month: clampedMonth,
        day: clampedDay,
      };
    },
    [currentMonth, currentYearBE, getDaysInMonth, currentDay],
  );

  const applySelection = useCallback(
    (yearBE: number, month: number, day: number) => {
      const normalized = normalizeSelection(yearBE, month, day);

      setSelectedYearBE(normalized.yearBE);
      setSelectedMonth(normalized.month);
      setSelectedDay(normalized.day);
    },
    [normalizeSelection],
  );

  useEffect(() => {
    if (isVisible) {
      const d = safeInitialDate || safeMaxDate;
      const normalized = normalizeSelection(d.getFullYear() + 543, d.getMonth(), d.getDate());

      // ทุกครั้งที่เปิด picker ให้ sync ค่ากลับไปที่ initialDate หรือ maxDate
      setSelectedDay(normalized.day);
      setSelectedMonth(normalized.month);
      setSelectedYearBE(normalized.yearBE);
      setIsMounted(true);

      Animated.timing(animation, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      // กดปุ่ม back ของ Android แล้วปิด picker แทนการย้อนหน้า
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
        onClose();
        return true;
      });

      return () => backSub.remove();
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsMounted(false);
        }
      });
    }
  }, [isVisible, animation, normalizeSelection, onClose, safeInitialDate, safeMaxDate]);

  const handleConfirm = () => {
    // แปลงปี พ.ศ. กลับเป็น ค.ศ. ก่อนสร้าง Date จริง
    const yearAD = selectedYearBE - 543;
    const newDate = new Date(yearAD, selectedMonth, selectedDay);

    onConfirm(newDate);
    onClose();
  };

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_OFFSET, 0],
  });

  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const isActive = isVisible || isMounted;

  const selectedYearIndex = useMemo(() => {
    const index = years.findIndex((y) => y === selectedYearBE);
    return index >= 0 ? index : 0;
  }, [years, selectedYearBE]);

  const handleYearChange = useCallback(
    (index: number) => {
      const nextYearBE = years[index] ?? selectedYearBE;

      // เปลี่ยนปีแล้วต้อง normalize เดือนและวันให้ไม่เกิน maxDate หรือจำนวนวันของเดือน
      applySelection(nextYearBE, selectedMonth, selectedDay);
    },
    [applySelection, selectedDay, selectedMonth, selectedYearBE, years],
  );

  const handleMonthChange = useCallback(
    (index: number) => {
      const nextMonth = months[index] ?? selectedMonth;

      // เปลี่ยนเดือนแล้วต้อง normalize วัน เช่น 31 ไปเดือนที่มี 30 วัน
      applySelection(selectedYearBE, nextMonth, selectedDay);
    },
    [applySelection, months, selectedDay, selectedMonth, selectedYearBE],
  );

  const handleDayChange = useCallback(
    (index: number) => {
      const nextDay = days[index] ?? selectedDay;
      setSelectedDay(nextDay);
    },
    [days, selectedDay],
  );

  const getDayLabel = useCallback((day: number) => String(day), []);
  const getMonthLabel = useCallback((month: number) => MONTHS_TH[month] ?? '', []);
  const getYearLabel = useCallback((yearBE: number) => String(yearBE), []);

  return (
    <Modal
      transparent={true}
      visible={isActive}
      animationType="none"
      hardwareAccelerated
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.modalContainer}>
          {/* แตะพื้นหลังเพื่อปิด picker */}
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: '#000', opacity: backdropOpacity },
              ]}
            />
          </Pressable>

          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            <View style={styles.header}>
              <Pressable onPress={onClose} style={[styles.headerBtn, { alignItems: 'flex-start' }]}>
                <KanitText className="text-gray-500 text-lg">ยกเลิก</KanitText>
              </Pressable>

              <KanitText weight="medium" className="text-lg text-gray-800">
                {title}
              </KanitText>

              <Pressable
                onPress={handleConfirm}
                style={[styles.headerBtn, { alignItems: 'flex-end' }]}
              >
                <KanitText weight="medium" className="text-blue-600 text-lg">
                  ตกลง
                </KanitText>
              </Pressable>
            </View>

            {/* แสดงป้ายบอกประเภทข้อมูลเหนือแต่ละช่องเลือก เพื่อเพิ่มความเข้าใจและบาลานซ์ของฟอร์ม */}
            <View style={styles.labelRow}>
              <KanitText
                style={[
                  styles.columnLabel,
                  Platform.OS === 'android' ? { flex: 1.0 } : { flex: 1.0 },
                ]}
              >
                วัน
              </KanitText>
              <KanitText
                style={[
                  styles.columnLabel,
                  Platform.OS === 'android' ? { flex: 2.2 } : { flex: 1.8 },
                ]}
              >
                เดือน
              </KanitText>
              <KanitText
                style={[
                  styles.columnLabel,
                  Platform.OS === 'android' ? { flex: 1.4 } : { flex: 1.2 },
                ]}
              >
                ปี พ.ศ.
              </KanitText>
            </View>

            <View style={styles.wheelRow}>
              <WheelSelectColumn
                items={days}
                selectedIndex={selectedDay - 1}
                onIndexChange={handleDayChange}
                getLabel={getDayLabel}
                style={Platform.OS === 'android' ? { flex: 1.0 } : { flex: 1.0 }}
                scrollEnabled={!isAdjustingDependentColumns}
                isVisible={isVisible}
              />

              <WheelSelectColumn
                items={months}
                selectedIndex={selectedMonth}
                onIndexChange={handleMonthChange}
                getLabel={getMonthLabel}
                style={Platform.OS === 'android' ? { flex: 2.2 } : { flex: 1.8 }}
                scrollEnabled={!isAdjustingDependentColumns}
                isVisible={isVisible}
              />

              <WheelSelectColumn
                items={years}
                selectedIndex={selectedYearIndex}
                onIndexChange={handleYearChange}
                getLabel={getYearLabel}
                style={Platform.OS === 'android' ? { flex: 1.4 } : { flex: 1.2 }}
                isVisible={isVisible}
              />
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 4,
  },
  columnLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Kanit-Regular',
  },
  wheelRow: {
    flexDirection: 'row',
    height: WHEEL_PICKER_HEIGHT,
    marginTop: 4,
    columnGap: 8,
  },
});
