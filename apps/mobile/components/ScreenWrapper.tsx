/**
 * ScreenWrapper.tsx
 *
 * Component ฐานของหน้าจอ ใช้รวม safe area, scroll และ keyboard handling ไว้จุดเดียว
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ห่อหน้าจอด้วย SafeAreaView หรือ View ตามที่กำหนด
 * - เลือกได้ว่าจะใช้ scroll view หรือ fixed view
 * - จัดการ keyboard สำหรับหน้าฟอร์ม
 * - รองรับ header, testID และ props เพิ่มเติมของ KeyboardAwareScrollView
 */

import React from 'react';
import { ViewStyle, View, Keyboard, Pressable } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { StatusBar } from 'expo-status-bar';

import { useScreenTestId } from '../utils/testId';

interface ScreenWrapperProps {
  children: React.ReactNode;
  useScrollView?: boolean;
  keyboardAvoiding?: boolean;
  contentContainerStyle?: ViewStyle | undefined;
  edges?: Edge[] | undefined;
  style?: ViewStyle | undefined;
  scrollViewProps?: React.ComponentProps<typeof KeyboardAwareScrollView> | undefined;
  header?: React.ReactNode | undefined;
  scrollViewRef?: React.RefObject<KeyboardAwareScrollView | null>;
  useSafeArea?: boolean;
  className?: string | undefined;
  testID?: string | undefined;
  enableAutomaticScroll?: boolean;
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  useScrollView = true,
  keyboardAvoiding = true,
  contentContainerStyle,
  edges = ['top', 'left', 'right', 'bottom'],
  style,
  scrollViewProps,
  header,
  scrollViewRef,
  className,
  useSafeArea = true,
  testID,
  enableAutomaticScroll = true,
}) => {
  const baseClassName = className || 'flex-1 bg-white';
  const Container = useSafeArea ? SafeAreaView : View;

  // สร้าง testID กลางของหน้าจอ เพื่อให้ test หา screen ได้สม่ำเสมอ
  // ไฟล์ถัดไป: utils/testId.ts
  const screenTestId = useScreenTestId(testID);

  // ถ้ามี header แยกอยู่ด้านบนแล้ว จะไม่ให้ SafeAreaView ดัน top ซ้ำ
  const safeAreaEdges = header ? edges?.filter((e) => e !== 'top') : edges;

  return (
    <Container
      testID={screenTestId}
      accessibilityLabel={screenTestId}
      className={baseClassName}
      {...(useSafeArea ? { edges: safeAreaEdges } : {})}
      style={style}
    >
      <StatusBar style="dark" />
      {useScrollView ? (
        <>
          {header}
          {/* ใช้ KeyboardAwareScrollView เป็นแกนกลางของหน้าฟอร์มเพื่อลดอาการเลื่อนผิดตำแหน่งตอนเปิด keyboard */}
          <KeyboardAwareScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={[
              { paddingHorizontal: 24, paddingBottom: 24, flexGrow: 1 },
              contentContainerStyle,
            ]}
            enableOnAndroid={true}
            enableAutomaticScroll={enableAutomaticScroll}
            enableResetScrollToCoords={true}
            extraHeight={120}
            keyboardOpeningTime={250}
            viewIsInsideTabBar={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            {...scrollViewProps}
          >
            {children}
          </KeyboardAwareScrollView>
        </>
      ) : keyboardAvoiding ? (
        // โหมด fixed view นี้แตะพื้นหลังเพื่อ dismiss keyboard ได้เสถียรกว่าใช้ View ธรรมดา
        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          {header}
          <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
        </Pressable>
      ) : (
        // โหมด fixed view นี้เหมาะกับหน้าที่มี list หรือ interaction เฉพาะทาง
        <>
          {header}
          <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
        </>
      )}
    </Container>
  );
};
