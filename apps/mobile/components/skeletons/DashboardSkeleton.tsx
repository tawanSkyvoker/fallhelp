/**
 * DashboardSkeleton.tsx
 *
 * Skeleton โครงร่างภาพรวมสำหรับ Dashboard ที่แสดงระหว่างรอข้อมูล initial load
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง placeholder header และ content กลางเพื่อกัน UI Flash ระหว่างรอ elder และ contacts settle
 * - ไม่จำลอง tab bar เพราะถูกควบคุมจาก layout ชั้นนอก
 * - ใช้ opacity animation pulse เดียวกับ skeleton อื่นในโปรเจกต์
 */

import React, { useEffect } from 'react';
import {
  Dimensions,
  Platform,
  StatusBar,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

const PULSE_DURATION_MS = 900;
const EMERGENCY_BUTTON_HEIGHT = 68;

interface SkeletonBlockProps {
  readonly className: string;
  readonly style?: StyleProp<ViewStyle>;
}

export const DashboardSkeleton: React.FC = () => {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    // pulse ระหว่าง 0.4–1.0 เพื่อให้ผู้ใช้รู้ว่ายังอยู่ในสถานะ loading ไม่ใช่ content ว่างเปล่า
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: PULSE_DURATION_MS }),
        withTiming(0.4, { duration: PULSE_DURATION_MS }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const { top, bottom } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const androidNavBarHeight =
    Platform.OS === 'android' ? Math.max(0, screenHeight - windowHeight - statusBarHeight) : 0;
  const hasSystemNavBar = bottom > 0 || androidNavBarHeight > 0;
  const emergencyGap = hasSystemNavBar ? 0 : 16;

  // คำนวณความสูงและดีไซน์แบบ Dynamic สำหรับการ์ดผู้สูงอายุ เพื่อให้เท่ากับหน้าจอแสดงผลจริง
  const elderCardSpacingClass = hasSystemNavBar ? 'mt-0 mb-6' : 'mt-0 mb-4';
  const elderCardPaddingClass = hasSystemNavBar ? 'p-4' : 'p-6';
  const elderAvatarSizeClass = hasSystemNavBar ? 'w-14 h-14' : 'w-16 h-16';
  const elderNameSizeHeight = hasSystemNavBar ? 'h-[22px]' : 'h-5';

  const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className, style }) => (
    <Animated.View style={[pulse, style]} className={`bg-gray-200 ${className}`} />
  );

  return (
    <View testID="dashboard-skeleton" className="flex-1 bg-white">
      {/* Header dashboard — จำลองกรอบบนจริงเพื่อให้ layout ไม่กระโดดตอนข้อมูลโหลดเสร็จ */}
      <View
        style={{
          paddingTop: top + 12,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
        }}
        className="flex-row items-center justify-between pb-6 bg-white px-6 rounded-b-[32px] shadow-sm z-10 mb-2"
      >
        <View className="flex-1 mr-4">
          <SkeletonBlock className="w-[86px] h-4 rounded-lg mb-2" />
          <SkeletonBlock className="w-[142px] h-[26px] rounded-[10px]" />
        </View>

        <View className="flex-row items-center gap-5">
          <SkeletonBlock className="w-7 h-7 rounded-full bg-gray-100" />
          <SkeletonBlock className="w-12 h-12 rounded-full" />
        </View>
      </View>

      {/* กรอบ content ภาพรวม — padding ด้านล่างเพื่อไม่ให้การ์ดซ้อนทับปุ่มฉุกเฉิน */}
      <View
        className="flex-1 px-4 pt-5"
        style={{
          paddingBottom: EMERGENCY_BUTTON_HEIGHT + emergencyGap,
        }}
      >
        <SkeletonBlock className="w-[78px] h-[22px] rounded-[10px] mb-4" />

        {/* Event status card — จัดวางขนาด สัดส่วน Flex และระยะขอบให้ตรงกับการ์ดจริง */}
        <View className="px-4 py-4 rounded-[28px] mb-5 border min-h-[156px] bg-white shadow-sm border-gray-100">
          <View className="flex-row items-start mb-4">
            <View className="flex-row items-center gap-4 flex-1">
              <SkeletonBlock className="w-14 h-14 rounded-full" />
              <View className="flex-1">
                <SkeletonBlock className="w-[112px] h-[14px] rounded-[7px] mb-2.5" />
                <SkeletonBlock className="w-[92px] h-[26px] rounded-[10px]" />
              </View>
            </View>
          </View>

          <View className="h-[1px] bg-gray-100 mb-3" />

          <View className="flex-row justify-between items-end min-h-[44px]">
            <View className="flex-1">
              <SkeletonBlock className="w-[220px] h-[14px] rounded-[7px]" />
            </View>
          </View>
        </View>

        {/* Device card + Heart rate card — ปรับปรุงเงา ระยะ Spacing และความหนาให้ตรงแบบ 1-to-1 ที่ความสูง 130px */}
        <View className="flex-row items-stretch mb-5">
          <View className="flex-1 min-h-[130px] bg-white pt-4 px-4 pb-2 rounded-[24px] border border-gray-100 shadow-sm mr-1.5">
            <View className="flex-row justify-between items-start">
              <SkeletonBlock className="w-12 h-12 rounded-2xl" />
              <View className="flex-row items-center gap-2">
                <SkeletonBlock className="w-3 h-3 rounded-full" />
                <SkeletonBlock className="w-[18px] h-7 rounded-[9px] bg-gray-100" />
              </View>
            </View>
            <View className="mt-2.5">
              <SkeletonBlock className="w-[60px] h-[12px] rounded-[6px] mb-1" />
              <SkeletonBlock className="w-[70px] h-[20px] rounded-md" />
            </View>
          </View>

          <View className="flex-1 min-h-[130px] bg-white pt-4 px-4 pb-2 rounded-[24px] border border-gray-100 shadow-sm ml-1.5 relative overflow-hidden">
            <View className="flex-row justify-between items-start">
              <SkeletonBlock className="w-12 h-12 rounded-2xl" />
            </View>
            <View className="mt-2.5">
              <SkeletonBlock className="w-[70px] h-[12px] rounded-[6px] mb-1" />
              <View className="flex-row items-baseline gap-1">
                <SkeletonBlock className="w-[44px] h-[32px] rounded-[6px]" />
                <SkeletonBlock className="w-[30px] h-[12px] rounded-[5px] bg-gray-100" />
              </View>
              {/* แถวสถานะชีพจรแถวที่ 3 ปล่อยเป็นแถวโปร่งใสไว้เพื่อให้เท่ากับการ์ดจริง ป้องกัน Layout Shift */}
              <View className="min-h-[18px] mt-1" />
            </View>
          </View>
        </View>

        {/* Elder info card — คำนวณความสูงและระยะเว้นวรรคแบบยืดหยุ่น เพื่อป้องกันรอยต่อขยายเมื่อข้อมูลจริงมาแสดง */}
        <View
          className={`bg-white ${elderCardPaddingClass} rounded-[28px] border border-gray-100 shadow-sm flex-row items-center justify-between ${elderCardSpacingClass}`}
        >
          <View className="flex-row items-center gap-5 flex-1">
            <SkeletonBlock className={`${elderAvatarSizeClass} rounded-full`} />
            <View className="flex-1">
              <SkeletonBlock className="w-[118px] h-[14px] rounded-[7px] mb-1.5" />
              <SkeletonBlock className={`w-[104px] ${elderNameSizeHeight} rounded-lg mb-2`} />
              <View className="flex-row gap-2">
                <SkeletonBlock className="w-[46px] h-[26px] rounded-[13px]" />
                <SkeletonBlock className="w-[76px] h-[26px] rounded-[13px]" />
              </View>
            </View>
          </View>
          <SkeletonBlock className="w-[22px] h-8 rounded-[11px] bg-gray-100" />
        </View>
      </View>

      {/* Emergency button placeholder — ใช้ตำแหน่ง เงา และขนาดตรงกับปุ่มจริง */}
      <View className="absolute left-0 right-0 bottom-0 h-[68px] bg-white rounded-t-[35px] border border-gray-100 shadow-sm shadow-gray-100">
        <View className="flex-1 flex-row items-center justify-center px-5">
          <SkeletonBlock className="w-9 h-9 rounded-full mr-3" />
          <SkeletonBlock className="w-[120px] h-[22px] rounded-[11px]" />
        </View>
      </View>
    </View>
  );
};
