/**
 * FormLayout.tsx
 *
 * คอมโพเนนต์เลย์เอาต์สำเร็จรูปสำหรับหน้าฟอร์มกรอกข้อมูล
 * ใช้เป็นมาตรฐานกลางทั่วทั้งแอปเพื่อให้พฤติกรรมหลบคีย์บอร์ดเสถียรและเหมือนกัน 100%
 */

import React from 'react';
import { type ViewStyle } from 'react-native';
import { type KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from './ScreenWrapper';

interface FormLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  paddingBottom?: number;
  extraScrollHeight?: number;
  contentContainerStyle?: ViewStyle;
  scrollViewProps?: React.ComponentProps<typeof KeyboardAwareScrollView>;
  scrollViewRef?: React.RefObject<KeyboardAwareScrollView | null>;
}

export const FormLayout: React.FC<FormLayoutProps> = ({
  children,
  header,
  paddingBottom,
  extraScrollHeight = 80,
  contentContainerStyle,
  scrollViewProps,
  scrollViewRef,
}) => {
  const insets = useSafeAreaInsets();

  /**
   * คำนวณระยะห่างด้านล่างแบบอัตโนมัติ (Adaptive Padding)
   * - ถ้าเครื่องมี Home Indicator (insets.bottom > 0) เช่น iPhone รุ่นใหม่ เราจะใช้ระยะห่างที่น้อยลงเพราะระบบมีช่องว่างให้อยู่แล้ว
   * - ถ้าเครื่องไม่มี (insets.bottom === 0) เช่น Android หรือ iPhone รุ่นเก่า เราจะใช้ระยะห่างที่มากขึ้นเพื่อให้ปุ่มไม่ติดขอบจอ
   */
  const defaultPaddingBottom = insets.bottom > 0 ? insets.bottom + 8 : 32;
  const finalPaddingBottom = paddingBottom ?? defaultPaddingBottom;

  return (
    <ScreenWrapper
      useSafeArea={true}
      useScrollView={true}
      // เราจัดการระยะห่างด้านล่างเองผ่าน padding เพื่อความแม่นยำในทุกขนาดหน้าจอ
      edges={['top', 'left', 'right']}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingBottom: finalPaddingBottom,
        flexGrow: 1, // ช่วยให้เนื้อหาในหน้าจอที่ยาวสามารถกระจายตัวได้สวยงาม (เช่น ใช้ justify-between)
        ...contentContainerStyle,
      }}
      scrollViewProps={{
        bounces: false,
        overScrollMode: 'never',
        showsVerticalScrollIndicator: true,
        keyboardShouldPersistTaps: 'handled',
        enableOnAndroid: true,
        enableAutomaticScroll: true,
        extraScrollHeight: extraScrollHeight,
        ...scrollViewProps,
      }}
      {...(scrollViewRef !== undefined ? { scrollViewRef } : {})}
      header={header}
    >
      {children}
    </ScreenWrapper>
  );
};
