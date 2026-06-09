/**
 * ModernSpinner.tsx
 *
 * สปินเนอร์หมุนสำหรับโหลดข้อมูล ดีไซน์ล้ำสมัยสไตล์ไอทีและเซนเซอร์อัจฉริยะ (Smart Sensor)
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ใช้ Animated API เพื่อหมุนวงแหวนอย่างนุ่มนวล (Linear Loop)
 * - ดีไซน์ด้วยวงแหวนสีหลักไล่กวาดวงกลม (Sweeping Ring)
 * - มีไอคอนเซนเซอร์อัจฉริยะ (motion_photos_on) วางอยู่ตรงกลางเพื่อเสริม affordance ของแบรนด์ FallHelp
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { MaterialSymbol } from './MaterialSymbol';

interface ModernSpinnerProps {
  size?: number; // ขนาดกว้าง-สูงของตัวหมุน
  color?: string; // สีหลักของเส้นวงแหวน
  iconName?: string; // ชื่อไอคอนตรงกลาง (เลือกเปลี่ยนได้)
  testID?: string; // สำหรับทำ Automated Testing
}

export function ModernSpinner({
  size = 48,
  color = '#16AD78',
  iconName = 'motion_photos_on',
  testID,
}: ModernSpinnerProps) {
  // สร้างตัวแปรแอนิเมชันสำหรับการหมุน
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1200, // หมุนหนึ่งรอบในเวลา 1.2 วินาทีเพื่อให้ดูนุ่มนวลและพรีเมียม
        easing: Easing.linear,
        useNativeDriver: process.env.NODE_ENV !== 'test', // ใช้ Native Driver เฉพาะเมื่อไม่ได้รันบน Jest Test Environment เพื่อเลี่ยงโมเดลจำลองที่เข้ากันไม่ได้
      }),
    );

    animation.start();

    return () => animation.stop();
  }, [rotateAnim]);

  // แปลงค่าจาก 0-1 ไปเป็นองศาการหมุน 0-360
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ringThickness = Math.max(2, Math.round(size * 0.075)); // คำนวณความหนาของเส้นตามสัดส่วนขนาด

  return (
    <View testID={testID} style={[styles.container, { width: size, height: size }]}>
      {/* วงแหวนสะท้อนสีจางด้านหลัง ทำหน้าที่เป็นกรอบวงกลมสมบูรณ์ */}
      <View
        style={[
          styles.trackRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ringThickness,
            borderColor: color,
            opacity: 0.12, // ความโปร่งใส 12% ให้ความรู้สึกเทคโนโลยีสะท้อนแสงเบา ๆ
          },
        ]}
      />

      {/* วงแหวนนำสายตาด้านหน้าที่หมุนครึ่งเสี้ยว */}
      <Animated.View
        style={[
          styles.activeRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ringThickness,
            borderColor: 'transparent',
            borderTopColor: color, // แสดงเฉพาะเส้นบนและข้างเพื่อสร้างประกายหมุนไล่กวาด
            borderRightColor: color,
            transform: [{ rotate: spin }],
          },
        ]}
      />

      {/* ไอคอนสัญญาณ/เซนเซอร์อัจฉริยะกึ่งกลาง ให้ดีไซน์เรียบหรูสไตล์ IoT */}
      {iconName && (
        <View style={styles.iconContainer}>
          <MaterialSymbol
            name={iconName}
            size={Math.round(size * 0.44)} // ขนาดไอคอนพอดีกับสัดส่วนวงแหวนกึ่งกลาง
            color={color}
            style={{ opacity: 0.85 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  trackRing: {
    position: 'absolute',
  },
  activeRing: {
    position: 'absolute',
  },
  iconContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
