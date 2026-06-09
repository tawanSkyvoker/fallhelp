/**
 * ToastConfig.tsx
 *
 * Config toast กลางของแอปสำหรับแสดงข้อความสั้นแบบ HUD
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนดหน้าตาของ toast แบบ success, error และ info
 * - เลือก icon และสีตามประเภทของ toast
 * - แสดงข้อความหลักแบบสั้น กระชับ และใช้ฟอนต์ Kanit
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialSymbol } from './MaterialSymbol';

import KanitText from './KanitText';

import type { BaseToastProps } from 'react-native-toast-message';

const ICON_MAP = {
  success: { name: 'check_circle' as const, color: '#4ADE80' },
  error: { name: 'error' as const, color: '#F87171' },
  info: { name: 'info' as const, color: '#60A5FA' },
};

function HudToast({ type, text1 }: BaseToastProps & { type: 'success' | 'error' | 'info' }) {
  // เลือก icon ตามประเภท toast ถ้าไม่ตรงประเภทที่รองรับจะ fallback เป็น info
  const icon = ICON_MAP[type] ?? ICON_MAP.info;

  if (!text1) return null;

  return (
    <View style={styles.container}>
      <MaterialSymbol name={icon.name} size={20} color={icon.color} style={styles.icon} />
      <KanitText weight="medium" style={styles.text} numberOfLines={2}>
        {text1}
      </KanitText>
    </View>
  );
}

export const toastConfig = {
  success: (props: BaseToastProps) => <HudToast {...props} type="success" />,
  error: (props: BaseToastProps) => <HudToast {...props} type="error" />,
  info: (props: BaseToastProps) => <HudToast {...props} type="info" />,
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(28, 28, 30, 0.92)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 280,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 15,
    color: '#FFFFFF',
    flexShrink: 1,
  },
});
