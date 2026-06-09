/**
 * DialogContext.tsx
 *
 * ระบบ dialog/alert กลางสำหรับทุก screen
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง AppDialog จาก provider กลาง โดยไม่ต้องส่ง props ผ่าน component tree
 * - เปิดให้ component เรียกใช้ dialog ผ่าน useDialog()
 * - เชื่อมกับ dialogService เพื่อให้ module นอก React tree เรียก showDialog() ได้
 * - หน่วง callback ของ action จนกว่า dialog จะปิดเสร็จ เพื่อลดปัญหา navigation ชนกับ animation
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AppDialog } from '../components/AppDialog';

import { setDialogHandler } from '../utils/dialogService';

import type { DialogAction, DialogConfig } from '../utils/dialogService';

type DialogContextValue = {
  showDialog: (config: DialogConfig) => void;
  hideDialog: () => void;
};

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

// action สำรอง ใช้เมื่อ caller ไม่ได้ส่งปุ่มเข้ามา
const DEFAULT_ACTION: DialogAction = { text: 'ตกลง', style: 'default' };

export const DialogProvider = ({ children }: { children: React.ReactNode }) => {
  // dialog เก็บ config ล่าสุด ส่วน isDialogVisible ใช้ควบคุม animation เปิดปิด
  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const [isDialogVisible, setIsDialogVisible] = useState(false);

  // เก็บ callback ของปุ่มไว้ก่อน แล้วค่อยเรียกหลัง dialog ปิดเสร็จ
  const pendingActionRef = useRef<(() => void) | null>(null);

  const showDialog = useCallback((config: DialogConfig) => {
    setDialog(config);
    setIsDialogVisible(true);
  }, []);

  const hideDialog = useCallback(() => {
    setIsDialogVisible(false);
  }, []);

  const actions = useMemo(() => {
    // ต้องมีปุ่มให้ผู้ใช้กดเสมอ แม้ caller ไม่ส่ง actions มา
    if (!dialog?.actions || dialog.actions.length === 0) {
      return [DEFAULT_ACTION];
    }

    return dialog.actions;
  }, [dialog]);

  const handleAction = useCallback(
    (action: DialogAction) => {
      // ปิด dialog ก่อน แล้วค่อยยิง callback หลัง animation ปิดเสร็จ
      // กัน race ระหว่าง dialog unmount กับ navigation หรือ state transition
      pendingActionRef.current = action.onPress ?? null;
      hideDialog();
    },
    [hideDialog],
  );

  useEffect(() => {
    // ลงทะเบียน showDialog ให้ dialogService เพื่อให้ module นอก React tree เรียก dialog ได้
    // ไฟล์ถัดไป: utils/dialogService.ts
    setDialogHandler(showDialog);

    // ถอด handler ตอน provider unmount เพื่อกัน stale reference
    return () => setDialogHandler(null);
  }, [showDialog]);

  const handleHidden = useCallback(() => {
    // ล้าง config หลัง dialog ซ่อนแล้ว เพื่อไม่ให้เนื้อหาเปลี่ยนกลาง animation ปิด
    setDialog(null);

    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;

    if (pendingAction) {
      // รอ 1 frame ให้ Dialog unmount เสร็จก่อนยิง callback
      requestAnimationFrame(() => {
        pendingAction();
      });
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      showDialog,
      hideDialog,
    }),
    [showDialog, hideDialog],
  );

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      {dialog ? (
        <AppDialog
          visible={isDialogVisible}
          title={dialog.title}
          actions={actions}
          {...(dialog.message !== undefined ? { message: dialog.message } : {})}
          {...(dialog.dismissible !== undefined ? { dismissible: dialog.dismissible } : {})}
          onDismiss={hideDialog}
          onAction={handleAction}
          onHidden={handleHidden}
        />
      ) : null}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const ctx = useContext(DialogContext);

  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider');
  }

  return ctx;
};
