/**
 * ListItemSkeleton.tsx
 *
 * Skeleton สำหรับรายการแบบการ์ดที่มี avatar/ลำดับ ข้อมูลหลายบรรทัด และ action ด้านขวา
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง placeholder ระหว่างรอโหลด list รายชื่อ
 * - รองรับจำนวนรายการ skeleton ผ่าน prop count
 * - ใช้ opacity animation เพื่อให้ผู้ใช้รู้ว่ายังอยู่ในสถานะ loading
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

interface ListItemSkeletonProps {
  count?: number;
}

export const ListItemSkeleton: React.FC<ListItemSkeletonProps> = ({ count = 3 }) => {
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

  const SkeletonItem = () => (
    <View className="bg-white rounded-2xl p-4 mb-3 flex-row items-center border border-gray-100">
      <SkeletonBlock className="w-11 h-11 rounded-full flex-shrink-0" />

      <View className="flex-1 ml-4">
        <SkeletonBlock className="w-[70%] h-5 rounded-[10px] mb-2" />
        <SkeletonBlock className="w-[56%] h-4 rounded-lg mb-1.5" />
        <SkeletonBlock className="w-[42%] h-[14px] rounded-[7px]" />
      </View>

      <SkeletonBlock className="w-10 h-10 rounded-xl bg-gray-100 ml-3" />
    </View>
  );

  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonItem key={index} />
      ))}
    </View>
  );
};
