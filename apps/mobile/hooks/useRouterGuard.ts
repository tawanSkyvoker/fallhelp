/**
 * useRouterGuard.ts
 *
 * Hook สำหรับป้องกัน router calls ก่อน root navigation context พร้อม
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจสถานะ root navigation ของ expo-router
 * - แจ้ง safeRouter ว่า navigation พร้อมใช้งานหรือยัง
 * - ครอบ router methods ให้รอ navigation พร้อมก่อนค่อยทำงาน
 * - จัดคิว router action ที่ถูกเรียกเร็วเกินไประหว่าง cold start
 */

import { useEffect, useRef } from 'react';
import { router, useRootNavigationState } from 'expo-router';

import { setNavigationReady } from '../utils/safeRouter';

export const useRouterGuard = () => {
  const rootNavigationState = useRootNavigationState();

  // เก็บ navigation state ล่าสุดไว้ให้ wrapper อ่านได้ แม้ callback จะถูกเรียกทีหลัง
  const rootStateRef = useRef(rootNavigationState);

  // กัน patch router ซ้ำหลายรอบ
  const isPatchedRef = useRef(false);

  // เก็บ router action ที่ถูกเรียกก่อน navigation พร้อม
  const pendingRef = useRef<(() => void)[]>([]);

  // ใช้ polling สั้น ๆ เพื่อ flush queue เมื่อ root navigation พร้อม
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // เก็บ router methods ดั้งเดิมไว้สำหรับ restore ตอน cleanup
  const originalsRef = useRef<Partial<typeof router>>({});

  useEffect(() => {
    rootStateRef.current = rootNavigationState;

    // แจ้ง safeRouter ว่าตอนนี้ navigation พร้อมหรือยัง
    // ไฟล์ถัดไป: utils/safeRouter.ts
    setNavigationReady(rootNavigationState?.key != null);
  }, [rootNavigationState]);

  useEffect(() => {
    if (isPatchedRef.current) return;

    if ((router.replace as unknown as { __safeRouterWrapped?: boolean }).__safeRouterWrapped) {
      return;
    }

    isPatchedRef.current = true;

    originalsRef.current = {
      push: router.push,
      replace: router.replace,
      back: router.back,
      navigate: router.navigate,
      dismiss: router.dismiss,
      dismissTo: router.dismissTo,
      dismissAll: router.dismissAll,
      setParams: router.setParams,
      prefetch: router.prefetch,
      reload: router.reload,
    };

    const isReady = () => rootStateRef.current?.key != null;

    const logQueued = (label: string) => {
      if (!__DEV__) return;

      const stack = new Error().stack;

      console.warn('[RouterGuard] Navigation called before ready', {
        label,
        navKey: rootStateRef.current?.key ?? null,
      });

      console.warn(stack);
    };

    const runWhenReady = (fn: () => void, label?: string) => {
      if (isReady()) {
        try {
          fn();
        } catch (e) {
          console.error('[RouterGuard] Router action failed (ready):', e);
        }

        return;
      }

      if (label) logQueued(label);

      // navigation ยังไม่พร้อม ให้เก็บ action ไว้ก่อน แล้วค่อย flush เมื่อ root พร้อม
      pendingRef.current.push(fn);

      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          if (!isReady()) return;

          const actions = pendingRef.current;
          pendingRef.current = [];

          actions.forEach((a) => {
            try {
              a();
            } catch (e) {
              console.error('[RouterGuard] Router action failed (flush):', e);
            }
          });

          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }, 120);
      }
    };

    const wrap = (label: string) => {
      const mutableRouter = router as Record<string, unknown>;
      const fn = mutableRouter[label];

      if (typeof fn !== 'function') return;

      // ครอบ router method ให้ทำงานผ่าน queue แทนการยิงทันทีตอน cold start
      mutableRouter[label] = (...args: unknown[]) => {
        runWhenReady(() => {
          try {
            (fn as (...args: unknown[]) => void)(...args);
          } catch (e) {
            console.error(`[RouterGuard] Navigation failed (${label}):`, e);
          }
        }, label);
      };
    };

    [
      'push',
      'replace',
      'back',
      'navigate',
      'dismiss',
      'dismissTo',
      'dismissAll',
      'setParams',
      'prefetch',
      'reload',
    ].forEach((method) => wrap(method));

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // คืน router methods ดั้งเดิมเมื่อ unmount
      Object.assign(router, originalsRef.current);

      pendingRef.current = [];
      isPatchedRef.current = false;
    };
  }, []);
};
