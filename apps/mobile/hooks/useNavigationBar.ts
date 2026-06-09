/**
 * useNavigationBar.ts
 *
 * Hook และ helper สำหรับจัดการ navigation bar ของ Android ให้เข้ากับหน้าจอของแอป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - โหลด expo-navigation-bar แบบ lazy เฉพาะเมื่อใช้งานได้
 * - ตรวจว่าเครื่องรองรับ native navigation bar หรือไม่
 * - จัดคิวการเปลี่ยน navigation bar เพื่อลด race condition
 * - เปิดให้หน้าจอบางหน้าเปลี่ยนเป็นโหมด dark navigation bar ชั่วคราว
 */

import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';

// โหลด NavigationBar แบบ lazy เพื่อหลีกเลี่ยง crash ตอน native module ไม่มี
let NavigationBar: typeof import('expo-navigation-bar') | null = null;

// ใช้ queue เพื่อให้คำสั่งเปลี่ยน navigation bar ทำงานเรียงลำดับ ไม่ชนกันตอนเปลี่ยนหน้าเร็ว
let navigationBarTaskQueue: Promise<void> = Promise.resolve();

const enqueueNavigationBarTask = (task: () => Promise<void>) => {
  navigationBarTaskQueue = navigationBarTaskQueue.then(task).catch((error) => {
    console.warn('Failed to process navigation bar task:', error);
  });

  return navigationBarTaskQueue;
};

const loadNavigationBar = async () => {
  if (NavigationBar) return NavigationBar;

  try {
    NavigationBar = await import('expo-navigation-bar');
    return NavigationBar;
  } catch {
    NavigationBar = null;
    return null;
  }
};

const isSupported = (
  mod: typeof import('expo-navigation-bar') | null,
): mod is typeof import('expo-navigation-bar') =>
  !!mod &&
  typeof mod.setBackgroundColorAsync === 'function' &&
  typeof mod.setButtonStyleAsync === 'function' &&
  typeof mod.setVisibilityAsync === 'function';

const hasNativeNavigationBar = (): boolean => {
  if (Platform.OS !== 'android') return false;

  const modules = NativeModules as unknown as Record<string, unknown>;

  // เช็ก native module ก่อนเรียกใช้งาน เพื่อกัน crash บนอุปกรณ์หรือ build ที่ไม่มี ExpoNavigationBar
  return typeof modules['ExpoNavigationBar'] !== 'undefined';
};

type NavigationButtonStyle = 'dark' | 'light';

const applyEdgeToEdgeNavigationBar = async (
  mod: typeof import('expo-navigation-bar'),
  buttonStyle: NavigationButtonStyle,
) => {
  const navBarWithOptionalApi = mod as typeof mod & {
    setStyle?: (style: 'light' | 'dark') => Promise<void>;
  };

  // ใช้ API เสริมถ้ามี เพื่อให้เข้ากับ Android edge-to-edge แต่ยัง fallback ได้ใน version ที่ไม่มี
  if (typeof navBarWithOptionalApi.setStyle === 'function') {
    await navBarWithOptionalApi.setStyle(buttonStyle);
  }

  await mod.setButtonStyleAsync(buttonStyle);
  await mod.setVisibilityAsync('visible');
};

export const useNavigationBar = () => {
  useEffect(() => {
    if (!hasNativeNavigationBar()) return;

    // ตั้งค่า navigation bar เริ่มต้นของแอปเป็นโหมดปกติ
    setOpaqueNavigationBar();
  }, []);
};

const setupNavigationBar = async (mod: typeof import('expo-navigation-bar')) => {
  if (!isSupported(mod)) return;

  try {
    await applyEdgeToEdgeNavigationBar(mod, 'dark');
  } catch (error) {
    // customization นี้เป็น optional ถ้าตั้งค่าไม่ได้ให้แอปทำงานต่อได้
    console.warn('Failed to setup navigation bar:', error);
  }
};

export const setOpaqueNavigationBar = async () => {
  if (!hasNativeNavigationBar()) return;

  await enqueueNavigationBarTask(async () => {
    const mod = await loadNavigationBar();

    if (!isSupported(mod)) return;

    await setupNavigationBar(mod);
  });
};

export const setDarkNavigationBar = async () => {
  if (!hasNativeNavigationBar()) return;

  await enqueueNavigationBarTask(async () => {
    const mod = await loadNavigationBar();

    if (!isSupported(mod)) return;

    try {
      // ใช้กับหน้าที่พื้นหลังเข้มหรือ fullscreen เพื่อให้ปุ่ม navigation bar อ่านง่าย
      await applyEdgeToEdgeNavigationBar(mod, 'light');
    } catch (error) {
      console.warn('Failed to set dark navigation bar:', error);
    }
  });
};

export const useDarkNavigationBarWhen = (enabled: boolean) => {
  useEffect(() => {
    if (!hasNativeNavigationBar()) return;

    if (enabled) {
      setDarkNavigationBar();
    } else {
      setOpaqueNavigationBar();
    }

    return () => {
      // เมื่อออกจากหน้าที่ใช้โหมดเข้ม ให้คืนค่า navigation bar กลับเป็นโหมดปกติ
      if (enabled) {
        setOpaqueNavigationBar();
      }
    };
  }, [enabled]);
};
