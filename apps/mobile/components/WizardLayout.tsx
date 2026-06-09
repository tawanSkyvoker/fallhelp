/**
 * WizardLayout.tsx
 *
 * Layout กลางของ onboarding 3 ขั้นตอน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง header, progress bar และ content ของแต่ละ step
 * - รองรับทั้งโหมดหน้าปกติและโหมดโปร่งใส เช่น หน้ากล้อง
 * - ใช้ ScreenWrapper เพื่อจัดการ safe area, scroll และ keyboard
 * - เปิดให้แต่ละ step ส่ง headerExtra และ scrollView props เพิ่มเติมได้
 */

import React from 'react';
import { View, type ViewStyle, StyleSheet } from 'react-native';
import { MaterialSymbol } from './MaterialSymbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';

import KanitText from './KanitText';
import { ScreenWrapper } from './ScreenWrapper';
import { AppScreenHeader } from './AppScreenHeader';

import { useScreenTestId } from '../utils/testId';

// label ของแต่ละขั้นถูกตรึงไว้ เพื่อให้ progress bar ใช้คำเดียวกันทั้ง flow
const STEP_LABELS = ['กรอกข้อมูล\nผู้สูงอายุ', 'ติดตั้งอุปกรณ์', 'ตั้งค่า WiFi'];

interface WizardLayoutProps {
  currentStep: 1 | 2 | 3;
  title: string;
  onBack?: (() => void) | undefined;
  children: React.ReactNode;
  transparent?: boolean;
  contentContainerStyle?: ViewStyle | undefined;
  scrollViewProps?: React.ComponentProps<typeof KeyboardAwareScrollView> | undefined;
  headerExtra?: React.ReactNode | undefined;
  keyboardAvoiding?: boolean;
  useScrollView?: boolean;
  scrollViewRef?: React.RefObject<KeyboardAwareScrollView | null>;
  rightHeaderElement?: React.ReactNode;
}

interface StepIndicatorProps {
  stepNumber: number;
  currentStep: number;
  label: string;
  transparent?: boolean;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  stepNumber,
  currentStep,
  label,
  transparent = false,
}) => {
  const isCompleted = stepNumber < currentStep;
  const isActive = stepNumber === currentStep;

  // สีของวงกลมและ label เปลี่ยนตามสถานะ completed, active หรือ pending
  let circleClass = '';
  let textClass = '';
  let labelClass = '';

  if (isCompleted) {
    circleClass = 'bg-[#16AD78] border-[#16AD78]';
    textClass = 'text-white';
    labelClass = transparent ? 'text-emerald-400 font-medium' : 'text-green-600 font-medium';
  } else if (isActive) {
    circleClass = transparent ? 'bg-blue-500 border-blue-400' : 'bg-blue-600 border-blue-600';
    textClass = 'text-white';
    labelClass = transparent ? 'text-blue-300 font-semibold' : 'text-blue-600 font-semibold';
  } else {
    circleClass = transparent ? 'bg-gray-700 border-white/30' : 'bg-white border-gray-200';
    textClass = transparent ? 'text-white' : 'text-gray-400';
    labelClass = transparent ? 'text-white' : 'text-gray-400';
  }

  return (
    <View className="flex-1 items-center">
      <View
        className={`w-8 h-8 rounded-full items-center justify-center z-10 mb-2 shadow-sm border ${circleClass}`}
      >
        {isCompleted ? (
          <MaterialSymbol name="check" size={20} color="white" />
        ) : (
          <KanitText className={`text-sm weight="medium" ${textClass}`}>{stepNumber}</KanitText>
        )}
      </View>
      <KanitText className={`text-xs text-center ${labelClass}`}>{label}</KanitText>
    </View>
  );
};

interface ProgressBarProps {
  currentStep: number;
  transparent?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, transparent = false }) => {
  const lineColorBase = transparent ? 'bg-white/20' : 'bg-gray-200';
  const lineColorActive = 'bg-[#16AD78]';

  // เส้น progress แบ่งเป็น 2 ช่วง เพื่อไฮไลต์ตาม step ปัจจุบัน
  const firstSegmentActive = currentStep >= 2;
  const secondSegmentActive = currentStep >= 3;

  return (
    <View className="px-6 pb-2">
      <View className="relative">
        {/* เส้นพื้นหลังของ progress bar */}
        <View
          className={`absolute top-4 left-[16%] right-[16%] h-[2px] ${lineColorBase}`}
          style={{ zIndex: 0 }}
        />

        {/* เส้น active ช่วง Step 1 ไป Step 2 */}
        {firstSegmentActive && (
          <View
            className={`absolute top-4 left-[16%] right-[50%] h-[2px] ${lineColorActive}`}
            style={{ zIndex: 1 }}
          />
        )}

        {/* เส้น active ช่วง Step 2 ไป Step 3 */}
        {secondSegmentActive && (
          <View
            className={`absolute top-4 left-[50%] right-[16%] h-[2px] ${lineColorActive}`}
            style={{ zIndex: 1 }}
          />
        )}

        <View className="flex-row justify-between">
          {STEP_LABELS.map((label, index) => (
            <StepIndicator
              key={index}
              stepNumber={index + 1}
              currentStep={currentStep}
              label={label}
              transparent={transparent}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

export const WizardLayout: React.FC<WizardLayoutProps> = ({
  currentStep,
  title,
  onBack,
  children,
  transparent = false,
  contentContainerStyle,
  scrollViewProps,
  headerExtra,
  keyboardAvoiding = false,
  useScrollView = true,
  scrollViewRef,
  rightHeaderElement,
}) => {
  const insets = useSafeAreaInsets();

  // สร้าง testID กลางของหน้าจอ onboarding
  // ไฟล์ถัดไป: utils/testId.ts
  const screenTestId = useScreenTestId();

  // คำนวณระยะห่างด้านล่างแบบอัตโนมัติ (Adaptive Padding)
  // เพื่อให้ปุ่มกดยืนยันในแต่ละ Step อยู่ในตำแหน่งที่สมดุลที่สุด
  const adaptivePaddingBottom = insets.bottom > 0 ? insets.bottom + 8 : 32;

  // โหมดโปร่งใสใช้กับ step ที่ต้องให้ content ด้านหลังเต็มจอ เช่น camera overlay
  if (transparent) {
    return (
      <View testID={screenTestId} accessibilityLabel={screenTestId} className="flex-1">
        {/* header และ progress bar ยังอยู่ด้านบนเหมือนเดิม แต่ใช้พื้นหลังโปร่งใส */}
        {/* header และ progress bar ยังอยู่ด้านบนเหมือนเดิม แต่ใช้พื้นหลังเป็นไล่เฉดสีดำด้วย View ซ้อนกันเพื่อเลี่ยงการพึ่งพาโมดูล Native */}
        <View style={{ paddingTop: insets.top, paddingBottom: 16, position: 'relative' }}>
          {/* ใช้ LinearGradient จาก expo-linear-gradient เพื่อให้กราฟิกสมูทที่สุด */}
          <LinearGradient
            colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.75)', 'transparent']}
            locations={[0, 0.65, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          <AppScreenHeader
            title={title}
            onBack={onBack}
            transparent={true}
            noSafeArea={true}
            rightElement={rightHeaderElement}
          />
          <ProgressBar currentStep={currentStep} transparent={true} />
          {headerExtra}
        </View>

        {/* ปล่อย content เต็มพื้นที่ที่เหลือ เช่น camera preview หรือ custom overlay */}
        {children}
      </View>
    );
  }

  // headerContent ถูกส่งเข้า ScreenWrapper เพื่อให้ header อยู่เหนือ scroll content
  const headerContent = (
    <View className="bg-white z-10">
      <AppScreenHeader title={title} onBack={onBack} rightElement={rightHeaderElement} />
      <ProgressBar currentStep={currentStep} />
      {headerExtra && <View className="px-6 pb-2 mt-4">{headerExtra}</View>}
    </View>
  );

  return (
    <ScreenWrapper
      useSafeArea={true}
      // เราจัดการระยะห่างด้านล่างเองผ่าน padding เพื่อความแม่นยำและสม่ำเสมอในทุกขนาดหน้าจอ
      edges={['top', 'left', 'right']}
      useScrollView={useScrollView}
      contentContainerStyle={{
        paddingBottom: adaptivePaddingBottom,
        flexGrow: 1,
        ...contentContainerStyle,
      }}
      {...(scrollViewProps !== undefined ? { scrollViewProps } : {})}
      keyboardAvoiding={keyboardAvoiding}
      {...(scrollViewRef !== undefined ? { scrollViewRef } : {})}
      header={headerContent}
    >
      {children}
    </ScreenWrapper>
  );
};
