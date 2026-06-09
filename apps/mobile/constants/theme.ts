/**
 * theme.ts
 *
 * กำหนดธีมหลักของแอปสำหรับ react-native-paper
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตั้งค่าสีหลักของแอปตาม design token ที่ใช้ร่วมกัน
 * - บังคับ font ของ react-native-paper ให้ใช้ Kanit
 * - กำหนด roundness กลางสำหรับ input, card และ dialog
 */

import { MD3LightTheme, configureFonts } from 'react-native-paper';

const colors = {
  ...MD3LightTheme.colors,

  primary: '#16AD78',
  error: '#EF4444',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  onSurface: '#374151',
  onSurfaceVariant: '#a3a6af',
};

// ใช้ Kanit-Regular เป็น font หลักของ Paper ทุก text variant
const baseFont = {
  fontFamily: 'Kanit-Regular',
  fontWeight: '400' as const,
};

const fontConfig = {
  displayLarge: baseFont,
  displayMedium: baseFont,
  displaySmall: baseFont,
  headlineLarge: baseFont,
  headlineMedium: baseFont,
  headlineSmall: baseFont,
  titleLarge: baseFont,
  titleMedium: baseFont,
  titleSmall: baseFont,
  labelLarge: baseFont,
  labelMedium: baseFont,
  labelSmall: baseFont,
  bodyLarge: baseFont,
  bodyMedium: baseFont,
  bodySmall: baseFont,
};

export const AppTheme = {
  ...MD3LightTheme,
  colors: colors,
  fonts: configureFonts({ config: fontConfig }),
  roundness: 12,
};
