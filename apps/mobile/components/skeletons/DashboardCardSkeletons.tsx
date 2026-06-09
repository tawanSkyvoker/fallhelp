/**
 * DashboardCardSkeletons.tsx
 *
 * Skeleton รายจุดสำหรับ Dashboard หลังข้อมูลหลักเริ่มพร้อมแล้ว
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ให้ header, การ์ดสถานะเหตุการณ์ และปุ่มฉุกเฉินมี placeholder ของตัวเอง
 * - ใช้ progressive reveal แทนการกลับไป skeleton เต็มหน้าจอระหว่าง refetch
 * - คงขนาดใกล้กับ UI จริงเพื่อลด layout shift ตอนข้อมูลแต่ละส่วนมาถึง
 */

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

const PULSE_DURATION_MS = 900;

interface SkeletonBlockProps {
  readonly className: string;
}

const useSkeletonPulse = () => {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: PULSE_DURATION_MS }),
        withTiming(0.35, { duration: PULSE_DURATION_MS }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.value }));
};

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className }) => {
  const pulse = useSkeletonPulse();

  return <Animated.View style={pulse} className={`bg-gray-200 ${className}`} />;
};

export const DashboardHeaderProfileSkeleton: React.FC = () => (
  <View testID="dashboard-header-profile-skeleton" className="flex-1">
    <SkeletonBlock className="w-[86px] h-4 rounded-lg mb-2" />
    <SkeletonBlock className="w-[142px] h-[26px] rounded-[10px]" />
  </View>
);

export const DashboardAvatarSkeleton: React.FC = () => (
  <SkeletonBlock className="w-12 h-12 rounded-full" />
);

export const DashboardEventCardSkeleton: React.FC = () => (
  <View
    testID="dashboard-event-card-skeleton"
    className="px-4 py-4 rounded-[28px] mb-5 border min-h-[156px] bg-white shadow-sm border-gray-100"
  >
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
);

export const DashboardEmergencyButtonSkeleton: React.FC = () => (
  <View
    testID="dashboard-emergency-button-skeleton"
    className="bg-white rounded-t-[35px] rounded-b-none px-5 py-3.5 flex-row justify-center items-center border border-gray-100 shadow-sm"
  >
    <SkeletonBlock className="w-9 h-9 rounded-full mr-3" />
    <SkeletonBlock className="w-[120px] h-[22px] rounded-[11px]" />
  </View>
);

export const DashboardDeviceCardSkeleton: React.FC = () => (
  <View
    testID="dashboard-device-card-skeleton"
    className="flex-1 min-h-[130px] bg-white pt-4 px-4 pb-2 rounded-[24px] border border-gray-100 shadow-sm mr-1.5"
  >
    {/* ส่วนบนการ์ด: ไอคอนอุปกรณ์และสถานะจุดเชื่อมต่อออนไลน์/ออฟไลน์ */}
    <View className="flex-row justify-between items-start">
      <SkeletonBlock className="w-12 h-12 rounded-2xl" />
      <View className="flex-row items-center gap-2">
        <SkeletonBlock className="w-3 h-3 rounded-full" />
        <SkeletonBlock className="w-[18px] h-7 rounded-[9px] bg-gray-100" />
      </View>
    </View>
    {/* ส่วนล่างการ์ด: ป้ายชื่อและสถานะเชื่อมต่อ (ความสูงปรับให้หนาเท่า text-lg ในดีไซน์จริง) */}
    <View className="mt-2.5">
      <SkeletonBlock className="w-[60px] h-[12px] rounded-[6px] mb-1" />
      <SkeletonBlock className="w-[70px] h-[20px] rounded-md" />
    </View>
  </View>
);

export const DashboardHeartRateCardSkeleton: React.FC = () => (
  <View
    testID="dashboard-heart-rate-card-skeleton"
    className="flex-1 min-h-[130px] bg-white pt-4 px-4 pb-2 rounded-[24px] border border-gray-100 shadow-sm ml-1.5 relative overflow-hidden"
  >
    {/* ส่วนบนการ์ด: ไอคอนชีพจร */}
    <View className="flex-row justify-between items-start">
      <SkeletonBlock className="w-12 h-12 rounded-2xl" />
    </View>
    {/* ส่วนล่างการ์ด: ป้ายชื่อ, อัตราชีพจร (BPM) และแถวสถานะชีพจรด้านล่างสุด */}
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
);
