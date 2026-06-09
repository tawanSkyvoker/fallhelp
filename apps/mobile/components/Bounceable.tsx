/**
 * Bounceable.tsx
 *
 * Pressable กลางที่เพิ่ม spring-scale animation และ debounce ให้กับการกดปุ่ม
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับ props เหมือน Pressable ปกติ แล้วเพิ่ม option สำหรับ animation
 * - ลดขนาดปุ่มเล็กน้อยตอนกด เพื่อให้รู้สึกตอบสนอง
 * - กันผู้ใช้กดซ้ำเร็วเกินไปด้วย debounce
 * - ส่ง event เดิมกลับไปให้ onPress, onPressIn และ onPressOut
 */

import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface BounceableProps extends PressableProps {
  scale?: number;
  springConfig?: {
    mass?: number;
    stiffness?: number;
    damping?: number;
  };
  style?: StyleProp<ViewStyle>;
  debounceTime?: number;
}

export const Bounceable: React.FC<BounceableProps> = ({
  children,
  style,
  scale = 0.96,
  springConfig = { mass: 0.3, stiffness: 400, damping: 15 },
  debounceTime = 300,
  disabled,
  onPress,
  ...props
}) => {
  // เก็บสถานะการกดสำหรับใช้ขับ animation ฝั่ง reanimated
  const isPressed = useSharedValue(false);

  // จำเวลากดครั้งล่าสุด เพื่อกันผู้ใช้กดปุ่มซ้ำเร็วเกินไป
  const lastPressTime = React.useRef(0);

  // ใช้กับปุ่มที่ไม่ต้อง scale แต่ยังต้องการ feedback ตอนกด
  const [isActive, setIsActive] = React.useState(false);

  // ถ้า disabled เปลี่ยนเป็น true ระหว่างกด ให้ reset isActive เพื่อไม่ให้ background ค้าง
  React.useEffect(() => {
    if (disabled) {
      setIsActive(false);
      isPressed.value = false;
    }
  }, [disabled, isPressed]);

  const handlePress = React.useCallback(
    (event: GestureResponderEvent) => {
      if (!onPress || disabled) return;

      const now = Date.now();
      const timeSinceLastPress = now - lastPressTime.current;

      // กันผู้ใช้กดปุ่มซ้ำแล้ว trigger action เดิมหลายรอบ
      if (timeSinceLastPress > debounceTime) {
        lastPressTime.current = now;
        onPress(event);
      }
    },
    [onPress, debounceTime, disabled],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const targetScale = isPressed.value && !disabled ? scale : 1;

    return {
      transform: [
        {
          scale: withSpring(targetScale, springConfig),
        },
      ],
      opacity: withSpring(isPressed.value && !disabled ? 0.9 : 1, {
        mass: 0.5,
        stiffness: 200,
        damping: 20,
      }),
    };
  });

  return (
    <AnimatedPressable
      {...props}
      onPress={handlePress}
      disabled={disabled}
      onPressIn={(e) => {
        isPressed.value = true;
        if (!disabled && scale === 1) setIsActive(true);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        isPressed.value = false;
        if (!disabled && scale === 1) setIsActive(false);
        props.onPressOut?.(e);
      }}
      style={[style, isActive && { backgroundColor: '#F9FAFB' }, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};
