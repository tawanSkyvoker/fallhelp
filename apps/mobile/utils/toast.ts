/**
 * toast.ts
 *
 * Wrapper กลางสำหรับแสดง toast ด้วย config เดียวกันทั้งแอป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวม config การแสดง toast ไว้จุดเดียว
 * - กำหนดตำแหน่งและระยะเวลาแสดงผลให้สม่ำเสมอ
 * - เปิด helper สำหรับ toast แต่ละประเภทให้หน้าจอเรียกใช้สั้นลง
 */

import Toast from 'react-native-toast-message';

type ToastType = 'success' | 'error' | 'info';

function show(type: ToastType, message: string): void {
  Toast.show({
    type,
    text1: message,
    position: 'top',
    topOffset: 60,
    visibilityTime: 2000,
  });
}

export function showSuccessToast(message: string): void {
  show('success', message);
}
