/**
 * AppDialog.tsx
 *
 * Dialog มาตรฐานสำหรับแจ้งเตือนและยืนยันการทำงานทั่วทั้งแอป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับข้อมูล dialog จาก DialogContext
 * - แสดงหัวข้อ ข้อความ และปุ่ม action
 * - ส่ง action ที่ผู้ใช้กดกลับไปให้ตัวจัดการ dialog
 * - แจ้งเมื่อ dialog ถูกซ่อนแล้ว เพื่อให้ context จัดคิว dialog ถัดไปได้
 */

import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppModalCard } from './AppModalCard';
import KanitText from './KanitText';

import type { DialogAction } from '../utils/dialogService';

interface AppDialogProps {
  visible: boolean;
  title: string;
  message?: string | undefined;
  actions: DialogAction[];
  dismissible?: boolean | undefined;
  onDismiss: () => void;
  onAction: (action: DialogAction) => void;
  onHidden?: () => void;
}

// กำหนดสีข้อความของปุ่มตามประเภท action
// style มาจาก utils/dialogService.ts
const getTextColor = (style?: DialogAction['style']) => {
  if (style === 'destructive') return '#EF4444';
  if (style === 'cancel') return '#374151';
  if (style === 'confirm') return '#2563EB';
  return '#007AFF';
};

export const AppDialog = ({
  visible,
  title,
  message,
  actions,
  dismissible = false,
  onDismiss,
  onAction,
  onHidden,
}: AppDialogProps) => {
  // ปิด dialog ได้เฉพาะกรณีที่ตั้งค่าให้ dismiss ได้
  const handleDismiss = () => {
    if (dismissible) onDismiss();
  };

  useEffect(() => {
    if (visible) return;

    // รอ animation ปิด dialog จบก่อนแจ้ง context ว่าซ่อนแล้ว
    // ใช้สำหรับเคลียร์ state หรือแสดง dialog ถัดไปในคิว
    const timer = setTimeout(() => {
      onHidden?.();
    }, 180);

    // ออกจาก component แล้วต้องล้าง timer เพื่อกัน callback ทำงานซ้ำ
    return () => clearTimeout(timer);
  }, [visible, onHidden]);

  return (
    <AppModalCard visible={visible} onClose={handleDismiss} dismissible={dismissible}>
      <View style={styles.titleWrap}>
        <KanitText weight="medium" style={styles.title}>
          {title}
        </KanitText>
      </View>
      <View style={styles.contentWrap}>
        {!!message && (
          <View style={styles.messageWrap}>
            <KanitText style={styles.message}>{message}</KanitText>
          </View>
        )}
        <View style={styles.dividerH} />
        <View style={styles.actions}>
          <View style={styles.actionsRow}>
            {actions.map((action, index) => (
              <React.Fragment key={`${action.text}-${index}`}>
                {index > 0 && <View style={styles.dividerV} />}
                <TouchableOpacity
                  activeOpacity={0.65}
                  onPress={() => onAction(action)}
                  style={styles.actionButton}
                >
                  <KanitText style={[styles.actionText, { color: getTextColor(action.style) }]}>
                    {action.text}
                  </KanitText>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>
      </View>
    </AppModalCard>
  );
};

const styles = StyleSheet.create({
  titleWrap: {
    paddingTop: 2,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    color: '#111827',
    textAlign: 'center',
    lineHeight: 25,
  },
  contentWrap: {
    paddingBottom: 0,
  },
  messageWrap: {
    paddingHorizontal: 4,
    paddingBottom: 14,
  },
  message: {
    fontSize: 15,
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
  actions: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  actionButton: {
    minWidth: 88,
    minHeight: 40,
    paddingHorizontal: 12,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerV: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#E5E7EB',
  },
  actionText: {
    fontSize: 15,
  },
});
