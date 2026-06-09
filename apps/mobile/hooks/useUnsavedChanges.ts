/**
 * useUnsavedChanges.ts
 *
 * Hook สำหรับป้องกันการ navigate ออกเมื่อฟอร์มมีข้อมูลที่ยังไม่บันทึก
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เก็บสถานะว่าฟอร์มมีการเปลี่ยนแปลงหรือไม่
 * - ดัก Android hardware back button
 * - ดัก navigation back, gesture และ header back ผ่าน beforeRemove
 * - คืน modalProps สำหรับส่งเข้า ConfirmModal เพื่อให้ผู้ใช้ยืนยันก่อนออกจากหน้า
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';

import { BackHandler } from 'react-native';
import { safeRouter as router } from '../utils/safeRouter';

export interface UseUnsavedChangesOptions {
  title?: string;
  message?: string;
  cancelText?: string;
  confirmText?: string;
  onConfirmLeave?: () => void;
}

type PendingAction = {
  type: 'back' | 'navigation';
  action?: unknown;
};

export const useUnsavedChanges = (options?: UseUnsavedChangesOptions) => {
  // hasChanges ใช้บอกว่าฟอร์มมีข้อมูลที่ยังไม่บันทึกหรือไม่
  const [hasChanges, setHasChanges] = useState(false);

  // ใช้ควบคุม ConfirmModal ที่ถามผู้ใช้ก่อนออกจากหน้า
  const [modalVisible, setModalVisible] = useState(false);

  // เก็บ action ที่ถูกกันไว้ รอให้ผู้ใช้กดยืนยันก่อนค่อยทำงานต่อ
  const pendingAction = useRef<PendingAction | null>(null);

  const navigation = useNavigation();

  // ใช้ ref เพื่อให้ listener อ่านค่า hasChanges ล่าสุดได้ทันที ไม่รอ state render รอบใหม่
  const hasChangesRef = useRef(hasChanges);

  const title = options?.title ?? 'ยังไม่ได้บันทึกข้อมูล';
  const message = options?.message ?? 'คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?';
  const cancelText = options?.cancelText ?? 'อยู่ต่อ';
  const confirmText = options?.confirmText ?? 'ออกโดยไม่บันทึก';
  const onConfirmLeave = options?.onConfirmLeave;

  useEffect(() => {
    // sync ref ให้ตรงกับ state เพื่อให้ BackHandler และ beforeRemove ใช้ค่าล่าสุด
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  const handleConfirm = useCallback(() => {
    setModalVisible(false);
    onConfirmLeave?.();

    const action = pendingAction.current;
    pendingAction.current = null;

    if (action?.type === 'back') {
      // ล้าง dirty state ก่อน เพื่อให้ listener รอบถัดไปปล่อย navigation ผ่าน
      setHasChanges(false);
      hasChangesRef.current = false;

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } else if (action?.type === 'navigation' && action.action) {
      // dispatch action เดิมที่ถูก beforeRemove ดักไว้
      setHasChanges(false);
      hasChangesRef.current = false;
      navigation.dispatch(action.action as never);
    }
  }, [navigation, onConfirmLeave]);

  const handleCancel = useCallback(() => {
    // ผู้ใช้เลือกอยู่ต่อ จึงล้าง pending action แล้วปิด modal
    setModalVisible(false);
    pendingAction.current = null;
  }, []);

  const showConfirmModal = useCallback((action: PendingAction) => {
    // เก็บ action ที่กำลังจะออกจากหน้าไว้ก่อน แล้วให้ ConfirmModal ตัดสิน
    pendingAction.current = action;
    setModalVisible(true);
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hasChangesRef.current) {
        showConfirmModal({ type: 'back' });

        // กัน default back behavior จนกว่าผู้ใช้จะยืนยัน
        return true;
      }

      return false;
    });

    return () => backHandler.remove();
  }, [showConfirmModal]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChangesRef.current) {
        return;
      }

      // กัน navigation ออกก่อน แล้วเก็บ action เดิมไว้ทำต่อหลังผู้ใช้ยืนยัน
      e.preventDefault();
      showConfirmModal({ type: 'navigation', action: e.data.action });
    });

    return unsubscribe;
  }, [navigation, showConfirmModal]);

  const resetChanges = useCallback(() => {
    // เรียกหลัง save สำเร็จ ต้อง sync ref ทันทีเพราะ beforeRemove อ่านค่าจาก ref
    hasChangesRef.current = false;
    setHasChanges(false);
  }, []);

  const markAsChanged = useCallback(() => {
    setHasChanges(true);
  }, []);

  // props สำหรับ spread ลงบน ConfirmModal
  const modalProps = {
    visible: modalVisible,
    title,
    message,
    cancelText,
    confirmText,
    confirmStyle: 'destructive' as const,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  };

  return {
    hasChanges,
    setHasChanges,
    markAsChanged,
    resetChanges,
    modalProps,
  };
};
