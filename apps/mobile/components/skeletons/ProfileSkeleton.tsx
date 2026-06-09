/**
 * ProfileSkeleton.tsx
 *
 * Skeleton สำหรับหน้า profile info ระหว่างโหลดข้อมูล
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง placeholder ระหว่างรอโหลดข้อมูล profile
 * - จำลองตำแหน่ง avatar, การ์ดข้อมูลส่วนตัว และปุ่มออกจากระบบ
 * - ใช้ opacity animation เพื่อให้สถานะ loading ดูต่อเนื่อง
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

export const ProfileSkeleton: React.FC = () => {
  // opacity ใช้ทำ loading pulse ให้ skeleton ดูมีการเคลื่อนไหว
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 1000 }), withTiming(0.3, { duration: 1000 })),
      -1,
      false,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const SkeletonBlock: React.FC<{ className: string }> = ({ className }) => (
    <Animated.View style={animatedStyle} className={`bg-gray-200 ${className}`} />
  );

  return (
    <View>
      {/* รูปโปรไฟล์และปุ่มกล้อง */}
      <View className="items-center mb-8 mt-4">
        <View className="relative w-28 h-28">
          <SkeletonBlock className="w-full h-full rounded-full" />
          <SkeletonBlock className="absolute bottom-0 right-0 w-8 h-8 rounded-full border-2 border-white bg-gray-200" />
        </View>
      </View>

      {/* การ์ดข้อมูลส่วนตัว */}
      <View className="bg-white rounded-[24px] border border-gray-100 mb-4 overflow-hidden">
        <View className="p-5 border-b border-gray-100">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <SkeletonBlock className="w-[92px] h-[14px] rounded-[7px] mb-2" />
              <SkeletonBlock className="w-[132px] h-[20px] rounded-[10px] mb-5" />

              <SkeletonBlock className="w-[34px] h-[14px] rounded-[7px] mb-2" />
              <SkeletonBlock className="w-[54px] h-[20px] rounded-[10px]" />
            </View>
            <SkeletonBlock className="w-[42px] h-[16px] rounded-lg bg-gray-100" />
          </View>
        </View>

        <View className="p-5 border-b border-gray-100 flex-row items-center justify-between">
          <View className="flex-1">
            <SkeletonBlock className="w-[82px] h-[14px] rounded-[7px] mb-2" />
            <SkeletonBlock className="w-[112px] h-[20px] rounded-[10px]" />
          </View>
          <SkeletonBlock className="w-[42px] h-[16px] rounded-lg bg-gray-100" />
        </View>

        <View className="p-5 border-b border-gray-100 flex-row items-center justify-between">
          <View className="flex-1">
            <SkeletonBlock className="w-[42px] h-[14px] rounded-[7px] mb-2" />
            <SkeletonBlock className="w-[170px] h-[20px] rounded-[10px]" />
          </View>
          <SkeletonBlock className="w-[42px] h-[16px] rounded-lg bg-gray-100" />
        </View>

        <View className="p-5 flex-row items-center justify-between">
          <View className="flex-1">
            <SkeletonBlock className="w-[58px] h-[14px] rounded-[7px] mb-2" />
            <SkeletonBlock className="w-[96px] h-[20px] rounded-[10px]" />
          </View>
          <SkeletonBlock className="w-[50px] h-[16px] rounded-lg bg-gray-100" />
        </View>
      </View>

      {/* ปุ่มออกจากระบบ */}
      <View className="bg-white rounded-[24px] border border-gray-100 mb-6 p-5 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <SkeletonBlock className="w-10 h-10 rounded-full bg-gray-100" />
          <SkeletonBlock className="w-[118px] h-[20px] rounded-[10px] ml-3" />
        </View>
        <SkeletonBlock className="w-6 h-6 rounded-full bg-gray-100" />
      </View>
    </View>
  );
};
