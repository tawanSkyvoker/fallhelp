/**
 * AppModalCard.tsx
 *
 * การ์ด modal กลางสำหรับหน้าหรือ component ที่ต้องวางเนื้อหาเอง
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ครอบ Dialog ของ react-native-paper ให้ใช้รูปแบบเดียวกันทั้งแอป
 * - รองรับ title, children และ style ที่ส่งมาจาก component ภายนอก
 * - รอให้ keyboard ปิดก่อนค่อยแสดง modal เพื่อลดปัญหา layout กระโดด
 * - ควบคุมการปิด modal ผ่าน onClose และ dismissible
 */

import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';

import KanitText from './KanitText';
import { runAfterKeyboardDismiss } from '../utils/keyboard';

interface AppModalCardProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  dismissible?: boolean;
  children: React.ReactNode;
  dialogStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export const AppModalCard = ({
  visible,
  title,
  onClose,
  dismissible = true,
  children,
  dialogStyle,
  contentStyle,
}: AppModalCardProps) => {
  // ใช้ actualVisible แยกจาก visible เพื่อรอให้ keyboard ปิดก่อนเปิด Dialog จริง
  const [actualVisible, setActualVisible] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setActualVisible(false);

      // รอ keyboard dismiss ก่อนแสดง modal เพื่อกัน Dialog ชนกับ keyboard
      // ไฟล์ถัดไป: utils/keyboard.ts
      return runAfterKeyboardDismiss(() => {
        setActualVisible(true);
      });
    } else {
      setActualVisible(false);
    }
  }, [visible]);

  return (
    <Portal>
      <Dialog
        visible={actualVisible}
        dismissable={dismissible}
        dismissableBackButton={dismissible}
        onDismiss={onClose}
        style={[styles.dialog, dialogStyle]}
      >
        {title ? (
          <View style={styles.titleWrap}>
            <KanitText weight="medium" className="text-gray-900 text-xl text-center">
              {title}
            </KanitText>
          </View>
        ) : null}
        <View style={[title ? styles.contentWithTitle : styles.content, contentStyle]}>
          {children}
        </View>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    alignSelf: 'center',
    width: '88%',
    maxWidth: 340,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  titleWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  content: {
    padding: 16,
  },
  contentWithTitle: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
