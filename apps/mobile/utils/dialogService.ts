/**
 * dialogService.ts
 *
 * Global dialog service สำหรับเรียก dialog จากจุดที่อยู่นอก React component tree
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เก็บ dialog handler ที่ DialogContext ลงทะเบียนไว้
 * - เปิด showDialog() ให้ service, hook หรือ util อื่นเรียกใช้ได้
 * - แปลง config แบบ string หรือ object ให้เป็นรูปแบบเดียวกัน
 * - fallback เป็น Alert.alert ถ้า DialogProvider ยังไม่ mount
 */

import { Alert } from 'react-native';

export type DialogAction = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive' | 'confirm';
};

export type DialogConfig = {
  title: string;
  message?: string | undefined;
  actions?: DialogAction[] | undefined;
  dismissible?: boolean | undefined;
};

type DialogHandler = (config: DialogConfig) => void;

// DialogContext จะ set handler ตอน mount เพื่อเชื่อม service นี้กับ AppDialog
let dialogHandler: DialogHandler | null = null;

export const setDialogHandler = (handler: DialogHandler | null) => {
  dialogHandler = handler;
};

export const showDialog = (
  titleOrConfig: string | DialogConfig,
  message?: string,
  actions?: DialogAction[],
) => {
  // รองรับทั้ง showDialog('title', 'message') และ showDialog({ ...config })
  const config: DialogConfig =
    typeof titleOrConfig === 'string' ? { title: titleOrConfig, message, actions } : titleOrConfig;

  if (dialogHandler) {
    dialogHandler(config);
    return;
  }

  // Fallback: ใช้ native Alert ก่อน DialogProvider mount หรือกรณี provider ยังไม่พร้อม
  const fallbackActions = config.actions?.map((action) => ({
    text: action.text,
    onPress: action.onPress,
    style:
      action.style === 'confirm'
        ? 'default'
        : (action.style as 'default' | 'cancel' | 'destructive' | undefined),
  }));

  Alert.alert(config.title, config.message, fallbackActions);
};
