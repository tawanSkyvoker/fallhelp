/**
 * WheelSelectColumn.tsx
 *
 * Custom Wheel Picker ที่สร้างด้วย FlatList
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - สร้างตัวเลือกวงล้อหมุนที่สวยงาม (Wheel Spinner) บน iOS และ Android
 * - ใช้ FlatList พร้อม snapToInterval เพื่อให้เลื่อนแล้วหยุดกึ่งกลางรายการพอดี
 * - ใช้ font Kanit-Regular และสไตล์ของโครงการ 100% ไม่ใช้ฟอนต์หรือ UI dropdown ของระบบ
 * - ซ่อนลูกศรและป๊อปอัปภายนอก แสดงผลสวยงามกะทัดรัดอยู่ภายใน Modal
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import KanitText from './KanitText';

export const WHEEL_ITEM_HEIGHT = 44;
export const WHEEL_VISIBLE_ITEMS = 3;
export const WHEEL_PICKER_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS; // 132

interface WheelSelectColumnProps<T> {
  items: readonly T[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
  getLabel: (item: T) => string;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  isVisible?: boolean;
}

function WheelSelectColumnInner<T>({
  items,
  selectedIndex,
  onIndexChange,
  getLabel,
  scrollEnabled = true,
  style,
  isVisible,
}: WheelSelectColumnProps<T>) {
  const flatListRef = useRef<FlatList<T | null>>(null);

  // ใช้ Ref บันทึกตำแหน่งล่าสุดที่ผู้ใช้ลากเลื่อนเอง
  // เพื่อป้องกันการย้อนกลับไปจุดตั้งต้นหรือขัดจังหวะการเลื่อนของนิ้วผู้ใช้ขณะกำลังมี Momentum
  const lastScrolledIndexRef = useRef<number>(selectedIndex);

  const maxIndex = Math.max(items.length - 1, 0);
  const safeSelectedIndex = Math.max(0, Math.min(selectedIndex, maxIndex));

  // สถานะเลือกดัชนีแบบท้องถิ่น เพื่อแสดงผลไฮไลท์สีน้ำเงินทันทีโดยไม่หน่วงเวลา
  const [localSelectedIndex, setLocalSelectedIndex] = useState(safeSelectedIndex);

  // ล็อกค่าเริ่มต้นของ selectedIndex เพื่อส่งให้ initialScrollIndex เพียงครั้งเดียวตอนเมาท์
  const initialScrollIndexRef = useRef<number>(safeSelectedIndex);

  // ติดตามว่าตอนนี้นิ้วผู้ใช้กำลังลากหรือ FlatList กำลังเลื่อนหมุนอยู่หรือไม่
  const isDraggingRef = useRef<boolean>(false);
  const isMomentumActiveRef = useRef<boolean>(false);

  // ตัวแปรเก็บ Timeout สำหรับหน่วงเวลาการส่งอัปเดตเฉพาะกรณีลากและปล่อยที่มีแรงเฉื่อยตามมา
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ตัวแปรติดตามว่ามีคำขออัปเดตสถานะไปยัง Parent ค้างอยู่หรือไม่ เพื่อป้องกันการซิงก์ค่าเก่ากลับมาบดบัง UI
  const hasPendingUpdateRef = useRef<boolean>(false);

  // ติดตามว่า Modal ได้รับการแสดงผลไปแล้วหรือยัง
  const wasVisibleRef = useRef<boolean>(false);

  // ref อ่านค่า safeSelectedIndex ล่าสุดเสมอ เพื่อแก้ปัญหา stale closure ใน setTimeout
  // อัปเดตทุก render เพื่อให้ callback ที่หน่วงเวลา 80ms ได้ค่าที่ถูกต้องหลัง parent setState ตั้งค่าเสร็จ
  const safeSelectedIndexRef = useRef<number>(safeSelectedIndex);
  safeSelectedIndexRef.current = safeSelectedIndex;

  // ตัวแปรจับความเร็วและเวลาในการเลื่อน
  const lastScrollOffsetRef = useRef<number>(0);
  const lastScrollTimeRef = useRef<number>(0);

  // บันทึกขนาดข้อมูลรายการตัวเลือกของรอบเรนเดอร์ก่อนหน้า เพื่อจับการเปลี่ยนแปลงของโครงสร้างข้อมูล
  const prevItemsLengthRef = useRef<number>(items.length);

  // เพิ่มไอเทม null ที่หัวและท้าย เพื่อให้รายการแรกและรายการสุดท้ายเลื่อนมาอยู่ตรงกลางวิวได้พอดี
  const data = useMemo(() => {
    return [null, ...items, null];
  }, [items]);

  // เคลียร์ timeout เมื่อ Component unmount หรือมีการเปลี่ยนแปลง
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // เมื่อเปลี่ยนสถานะการมองเห็นของ Modal (เช่น กดเปิดใหม่) ให้ทำการรีเซ็ตค่ากลับจุดเดิมทันที (Snap Reset)
  //
  // ปัญหา Race Condition ที่แก้ไขในนี้:
  // ตอน isVisible เปลี่ยนเป็น true นั้น ImprovedDatePicker ยังไม่ได้ flush setState ใหม่
  // ดังนั้น safeSelectedIndex ณ เวลานั้นยังเป็นค่าเก่าจากตอนที่ผู้ใช้รูดเล่น (เช่น 2554)
  // การแก้ไข: อ่านค่าจาก safeSelectedIndexRef แทน closure เพื่อให้ได้ค่าที่ settle แล้วหลัง 80ms
  useEffect(() => {
    if (isVisible) {
      if (!wasVisibleRef.current) {
        // ล้างสถานะการโต้ตอบทางนิ้วมือทันที
        isDraggingRef.current = false;
        isMomentumActiveRef.current = false;
        hasPendingUpdateRef.current = false;

        wasVisibleRef.current = true;

        // หน่วงเวลา 80ms เพื่อให้ parent (ImprovedDatePicker) flush setState เสร็จสมบูรณ์ก่อน
        // จากนั้นอ่านค่า safeSelectedIndexRef.current ซึ่งจะเป็นค่าที่ถูกต้อง (เช่น 2569)
        const timer = setTimeout(() => {
          const idx = safeSelectedIndexRef.current;
          lastScrolledIndexRef.current = idx;
          setLocalSelectedIndex(idx);
          if (flatListRef.current) {
            flatListRef.current.scrollToOffset({
              offset: idx * WHEEL_ITEM_HEIGHT,
              animated: false,
            });
          }
        }, 80);

        return () => clearTimeout(timer);
      }
    } else {
      wasVisibleRef.current = false;
    }
  }, [isVisible]);

  // ซิงก์ค่า selectedIndex และตำแหน่ง Scroll จาก Parent เสมอเมื่อไม่ได้โต้ตอบกับวงล้อ (Atomic Unified Effect)
  useEffect(() => {
    const isInteracting = isDraggingRef.current || isMomentumActiveRef.current;

    if (!isInteracting) {
      // เคลียร์สถานะค้างส่งอัปเดต เนื่องจากล้อหยุดนิ่งแล้ว
      hasPendingUpdateRef.current = false;

      // ตรวจสอบว่าความยาวของไอเทมมีการเปลี่ยนแปลงหรือไม่ (เช่น เปลี่ยนปีแล้วจำนวนเดือนเปลี่ยน)
      const itemsLengthChanged = prevItemsLengthRef.current !== items.length;
      prevItemsLengthRef.current = items.length;

      // หากดัชนีที่เลือกไม่ตรงกับตำแหน่งล่าสุด หรือรายการตัวเลือกเปลี่ยนขนาด ให้บังคับจัดตำแหน่ง
      if (safeSelectedIndex !== lastScrolledIndexRef.current || itemsLengthChanged) {
        lastScrolledIndexRef.current = safeSelectedIndex;
        setLocalSelectedIndex(safeSelectedIndex);
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({
            offset: safeSelectedIndex * WHEEL_ITEM_HEIGHT,
            animated: !itemsLengthChanged, // ซิงก์ทันทีโดยไม่มีอนิเมชันถ้าจำนวนไอเทมเปลี่ยน เพื่อลดการดีด
          });
        }
      } else {
        // หากตำแหน่งตรงกันอยู่แล้ว แต่สีไฮไลท์ค้างในดัชนีอื่น ให้ซิงก์สีไฮไลท์ให้ถูกต้อง
        setLocalSelectedIndex(safeSelectedIndex);
      }
    } else {
      // หากอยู่ในระหว่างลากเลื่อน ให้เคลียร์สถานะค้างเฉพาะเมื่อดัชนีของ parent ซิงก์ตรงกับตำแหน่งเลื่อนล่าสุด
      if (safeSelectedIndex === lastScrolledIndexRef.current) {
        hasPendingUpdateRef.current = false;
      }
    }
  }, [safeSelectedIndex, items]);

  // อัปเดต highlight น้ำเงินแบบเรียลไทม์ตลอดการ scroll โดยมีการกรองความเร็ว (Velocity Throttling)
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // อัปเดตเฉพาะเมื่อผู้ใช้กำลังลากนิ้วเลื่อนอยู่เท่านั้น (isDraggingRef.current เป็น true)
      // เพื่อป้องกันไม่ให้ไฮไลท์เปลี่ยนไปยังรายการกลางทางในขณะที่ปล่อยมือแล้วและกำลังเลื่อนด้วยแรงเฉื่อย (Deceleration)
      if (!isDraggingRef.current) {
        return;
      }

      const yOffset = event.nativeEvent.contentOffset.y;
      const now = Date.now();

      // ตรวจสอบและบันทึกค่าเวลา/ตำแหน่งเริ่มต้นหากเป็นอีเวนต์แรกหลังการแตะเลื่อน
      if (lastScrollTimeRef.current === 0) {
        lastScrollTimeRef.current = now;
        lastScrollOffsetRef.current = yOffset;

        const index = Math.round(yOffset / WHEEL_ITEM_HEIGHT);
        const safeIndex = Math.max(0, Math.min(index, maxIndex));
        setLocalSelectedIndex((prev) => (prev !== safeIndex ? safeIndex : prev));
        return;
      }

      const timeDiff = now - lastScrollTimeRef.current;
      const offsetDiff = Math.abs(yOffset - lastScrollOffsetRef.current);

      lastScrollOffsetRef.current = yOffset;
      lastScrollTimeRef.current = now;

      const velocity = timeDiff > 0 ? offsetDiff / timeDiff : 0;

      // หากความเร็วในการรูดสูงมาก (Velocity > 0.8) ให้ข้ามการอัปเดตสีไฮไลท์ชั่วคราว
      // เพื่อไม่ให้ React re-render ถี่ๆ จนขัดจังหวะการหมุนของ FlatList (ช่วยประหยัด CPU/UI thread)
      if (velocity > 0.8) {
        return;
      }

      const index = Math.round(yOffset / WHEEL_ITEM_HEIGHT);
      const safeIndex = Math.max(0, Math.min(index, maxIndex));
      setLocalSelectedIndex((prev) => (prev !== safeIndex ? safeIndex : prev));
    },
    [maxIndex],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const yOffset = event.nativeEvent.contentOffset.y;
      const index = Math.round(yOffset / WHEEL_ITEM_HEIGHT);
      const safeIndex = Math.max(0, Math.min(index, maxIndex));

      // บันทึกตำแหน่งและซิงก์ดัชนีท้องถิ่นทันทีเมื่อหยุดเลื่อน
      lastScrolledIndexRef.current = safeIndex;
      setLocalSelectedIndex(safeIndex);

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }

      // แจ้ง Parent ทันที (0ms) เพื่อความเร็วและประสิทธิภาพสูงสุด
      if (safeIndex !== selectedIndex) {
        hasPendingUpdateRef.current = true;
        onIndexChange(safeIndex);
      }
    },
    [maxIndex, onIndexChange, selectedIndex],
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isDraggingRef.current = false;
      const yOffset = event.nativeEvent.contentOffset.y;
      const index = Math.round(yOffset / WHEEL_ITEM_HEIGHT);
      const safeIndex = Math.max(0, Math.min(index, maxIndex));

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }

      // เมื่อใช้ decelerationRate={0} ล้อจะไม่มีแรงเฉื่อย (Momentum) เลื่อนต่อหลังจากปล่อยนิ้ว
      // ทำให้ล้อหยุดหมุนทันทีที่ผู้ใช้ยกนิ้วออก และ snap เข้ากึ่งกลางรายการที่ใกล้ที่สุด
      // ดังนั้นเราสามารถล็อกค่าและแจ้ง Parent ได้ทันทีแบบ 0ms โดยไม่ต้องรออีเวนต์ Momentum
      lastScrolledIndexRef.current = safeIndex;
      setLocalSelectedIndex(safeIndex);
      if (safeIndex !== selectedIndex) {
        hasPendingUpdateRef.current = true;
        onIndexChange(safeIndex);
      }
    },
    [maxIndex, onIndexChange, selectedIndex],
  );

  const handleScrollBeginDrag = useCallback(() => {
    isDraggingRef.current = true;
    hasPendingUpdateRef.current = false;

    // รีเซ็ตตัวแปรคำนวณความเร็ว
    lastScrollTimeRef.current = 0;
    lastScrollOffsetRef.current = 0;

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  }, []);

  const handleMomentumScrollBegin = useCallback(() => {
    isMomentumActiveRef.current = true;
    hasPendingUpdateRef.current = false;

    // รีเซ็ตตัวแปรคำนวณความเร็ว
    lastScrollTimeRef.current = 0;
    lastScrollOffsetRef.current = 0;

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  }, []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<T | null>) => {
      if (item === null) {
        return <View style={{ height: WHEEL_ITEM_HEIGHT }} />;
      }

      // ตรวจสอบว่าคือไอเทมกึ่งกลางที่เลือกอยู่หรือไม่ โดยเปรียบเทียบกับดัชนีท้องถิ่น
      const isSelected = index - 1 === localSelectedIndex;

      return (
        <View style={styles.itemContainer}>
          <KanitText
            weight={isSelected ? 'medium' : 'regular'}
            style={[
              styles.itemText,
              isSelected ? styles.itemSelectedText : styles.itemUnselectedText,
            ]}
          >
            {getLabel(item)}
          </KanitText>
        </View>
      );
    },
    [getLabel, localSelectedIndex],
  );

  if (items.length === 0) {
    return <View style={[styles.column, style]} />;
  }

  return (
    <View style={[styles.column, style]}>
      {/* เส้นแบ่งขอบกึ่งกลางสำหรับเน้นตัวเลือกที่กำลังถูกเลือก */}
      <View style={styles.selectionIndicator} pointerEvents="none" />

      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(_item, index) => String(index)}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        snapToAlignment="center"
        // กำหนด decelerationRate เป็น 0 เพื่อยกเลิกแรงเฉื่อย (Momentum) ทั้งหมด
        // เมื่อผู้ใช้ปล่อยนิ้ว ล้อจะหยุดหมุนทันทีและ Snap เข้ากึ่งกลางรายการที่ใกล้ที่สุด ณ จุดที่ปล่อยมือ
        decelerationRate={0}
        // เพิ่มการปรับแต่งประสิทธิภาพ FlatList เพื่อให้รองรับการรูดเร็วได้อย่างลื่นไหลไร้การหน่วง
        windowSize={5}
        maxToRenderPerBatch={5}
        initialNumToRender={5}
        removeClippedSubviews={true}
        scrollEnabled={scrollEnabled}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={(event) => {
          isMomentumActiveRef.current = false;
          handleMomentumScrollEnd(event);
        }}
        getItemLayout={(_data, index) => ({
          length: WHEEL_ITEM_HEIGHT,
          offset: WHEEL_ITEM_HEIGHT * index,
          index,
        })}
        initialScrollIndex={initialScrollIndexRef.current}
      />
    </View>
  );
}

export const WheelSelectColumn = memo(WheelSelectColumnInner) as typeof WheelSelectColumnInner;

const styles = StyleSheet.create({
  column: {
    flex: 1,
    height: WHEEL_PICKER_HEIGHT,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    position: 'relative',
  },
  selectionIndicator: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: WHEEL_ITEM_HEIGHT,
    height: WHEEL_ITEM_HEIGHT,
    borderColor: '#2563EB',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  itemContainer: {
    height: WHEEL_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  itemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  itemSelectedText: {
    color: '#2563EB',
  },
  itemUnselectedText: {
    color: '#9CA3AF',
  },
});
