/**
 * ConfirmModal.tsx
 *
 * Dialog ยืนยันมาตรฐานสำหรับ flow ที่ต้องให้ผู้ใช้ตอบกลับ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง modal พร้อมหัวข้อและข้อความยืนยัน
 * - มีปุ่มยกเลิกและปุ่มยืนยันในรูปแบบเดียวกันทั้งแอป
 * - รองรับปุ่มยืนยันแบบปกติและแบบ destructive
 * - ส่งผลการกดกลับไปให้หน้าหรือ component ที่เรียกใช้
 */

import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppModalCard } from './AppModalCard';
import KanitText from './KanitText';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
  confirmStyle = 'default',
  onConfirm,
  onCancel,
}) => {
  // เปลี่ยนสีปุ่มยืนยันเมื่อเป็น action ที่มีผลกระทบ เช่น ลบหรือยกเลิกข้อมูล
  const confirmTextColor = confirmStyle === 'destructive' ? '#EF4444' : '#007AFF';

  return (
    <AppModalCard visible={visible} onClose={onCancel}>
      <View style={styles.titleWrap}>
        <KanitText weight="medium" style={styles.title}>
          {title}
        </KanitText>
      </View>
      <View style={styles.messageWrap}>
        {!!message && <KanitText style={styles.message}>{message}</KanitText>}
      </View>
      <View style={styles.dividerH} />

      <View className="flex-row">
        <TouchableOpacity
          activeOpacity={0.6}
          className="flex-1 py-3.5 items-center justify-center"
          onPress={onCancel}
        >
          <KanitText style={styles.cancelText}>{cancelText}</KanitText>
        </TouchableOpacity>

        <View style={styles.dividerV} />

        <TouchableOpacity
          activeOpacity={0.6}
          className="flex-1 py-3.5 items-center justify-center"
          onPress={onConfirm}
        >
          <KanitText style={[styles.confirmText, { color: confirmTextColor }]}>
            {confirmText}
          </KanitText>
        </TouchableOpacity>
      </View>
    </AppModalCard>
  );
};

const styles = StyleSheet.create({
  titleWrap: {
    paddingTop: 2,
    paddingBottom: 6,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    color: '#111827',
    textAlign: 'center',
    lineHeight: 25,
  },
  messageWrap: {
    paddingBottom: 16,
    alignItems: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 2,
  },
  dividerH: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginBottom: 8,
  },
  dividerV: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#E5E7EB',
  },
  cancelText: {
    fontSize: 16,
    color: '#374151',
  },
  confirmText: {
    fontSize: 16,
  },
});
