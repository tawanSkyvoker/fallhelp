/**
 * keyboard.ts
 *
 * Helper สำหรับรอให้คีย์บอร์ดปิดก่อนค่อยทำงานต่อ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจว่าคีย์บอร์ดกำลังเปิดอยู่หรือไม่
 * - รอ keyboardDidHide ก่อนเรียก callback
 * - มี fallback timer กันกรณี event ไม่ถูกยิง
 * - คืน cleanup function เพื่อยกเลิก callback ได้เมื่อ component unmount
 */

import { Keyboard, TextInput, type EmitterSubscription } from 'react-native';

interface RunAfterKeyboardDismissOptions {
  waitAfterHideMs?: number;
  noKeyboardDelayMs?: number;
  maxWaitMs?: number;
}

export function runAfterKeyboardDismiss(
  callback: () => void,
  options: RunAfterKeyboardDismissOptions = {},
): () => void {
  const waitAfterHideMs = options.waitAfterHideMs ?? 40;
  const noKeyboardDelayMs = options.noKeyboardDelayMs ?? 0;
  const maxWaitMs = options.maxWaitMs ?? 320;

  const keyboardApi = Keyboard as typeof Keyboard & {
    isVisible?: () => boolean;
  };

  let isCancelled = false;
  let hasScheduled = false;
  let hideSub: EmitterSubscription | null = null;
  let delayTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    hideSub?.remove();
    hideSub = null;

    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }

    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  };

  const scheduleOnce = (delayMs: number) => {
    if (hasScheduled || isCancelled) return;

    hasScheduled = true;
    cleanup();

    // รอ interaction ปัจจุบันจบก่อน เพื่อให้ modal/bottom sheet เปิดหลัง layout นิ่งขึ้น
    requestIdleCallback(() => {
      if (isCancelled) return;

      delayTimer = setTimeout(() => {
        if (isCancelled) return;
        callback();
      }, delayMs);
    });
  };

  // ตรวจสอบว่ามี TextInput ใดกำลังโฟกัสอยู่จริงหรือไม่
  let currentlyFocused = null;
  if (TextInput.State.currentlyFocusedInput) {
    currentlyFocused = TextInput.State.currentlyFocusedInput();
  } else if (TextInput.State.currentlyFocusedField) {
    currentlyFocused = TextInput.State.currentlyFocusedField();
  }
  const hasFocusedInput = currentlyFocused !== null;

  // คีย์บอร์ดจะถือว่าเปิดอยู่จริงก็ต่อเมื่อมีอินพุตกำลังโฟกัสอยู่ และตัวแสดงสถานะคีย์บอร์ดของ React Native บ่งชี้ว่าคีย์บอร์ดเปิดอยู่
  const isKeyboardVisible =
    hasFocusedInput &&
    ((keyboardApi.isVisible && keyboardApi.isVisible()) || Boolean(Keyboard.metrics()?.height));

  if (isKeyboardVisible) {
    // หากคีย์บอร์ดเปิดอยู่ ให้รอจนกว่าคีย์บอร์ดจะหุบลงเสร็จสมบูรณ์ก่อนทำงานต่อ
    hideSub = Keyboard.addListener('keyboardDidHide', () => {
      scheduleOnce(waitAfterHideMs);
    });

    // มีตัวจับเวลาสำรอง (Fallback) หากเหตุการณ์แป้นพิมพ์ของระบบมีปัญหาหรือไม่ยิงตามรอบ
    fallbackTimer = setTimeout(() => {
      scheduleOnce(waitAfterHideMs);
    }, maxWaitMs);

    Keyboard.dismiss();
  } else {
    // หากแป้นพิมพ์ไม่ได้ลอยขึ้นมาอยู่
    if (noKeyboardDelayMs === 0) {
      // ทำงานต่อทันทีแบบ Synchronous เพื่อแก้ปัญหาการหน่วงเวลา (Lag/Freeze) เมื่อกดปุ่มหรือการ์ด
      callback();
      return () => {};
    } else {
      scheduleOnce(noKeyboardDelayMs);
    }
  }

  return () => {
    // ใช้เพื่อยกเลิกการทำงานหากคอมโพเนนต์ถูก Unmount ก่อนถึงเวลาเป้าหมาย
    isCancelled = true;
    cleanup();
  };
}
