/**
 * safeRouter.ts
 *
 * Wrapper รอบ expo-router สำหรับกัน navigate ก่อน navigation context พร้อม
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับสถานะ navigation ready จาก useRouterGuard
 * - หน่วง router action จนกว่า navigation context จะพร้อม
 * - กัน duplicate navigation ในช่วงเวลาสั้น ๆ
 * - patch global router เพื่อให้ import router ตรงจาก expo-router ทนขึ้น
 */

import { router as expoRouter } from 'expo-router';

import Logger from './logger';

const NAV_RETRY_DELAY_MS = 120;
const NAV_MAX_RETRIES = 4;
const NAV_DUPLICATE_GUARD_WINDOW_MS = 1200;

let isNavigationReady = false;
let lastNavigationAction: { signature: string; at: number } | null = null;

// เก็บ router methods ดั้งเดิมก่อน patch เพื่อให้ safeRouter เรียกตรงโดยไม่ผ่าน guard ซ้ำ
const savedOriginals: Record<string, (...args: unknown[]) => void> = {};

export const setNavigationReady = (ready: boolean) => {
  isNavigationReady = ready;
};

const isIgnorableNavError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  // error กลุ่มนี้มักเกิดตอน navigation context ยังไม่พร้อมหรือถูก unmount ระหว่างเปลี่ยนหน้า
  return (
    message.toLowerCase().includes('navigation context') ||
    message.toLowerCase().includes('unmounted')
  );
};

const canGoBackSafely = () => {
  try {
    return expoRouter.canGoBack();
  } catch (error) {
    if (!isIgnorableNavError(error)) Logger.warn('[safeRouter] canGoBack check failed', error);
    return false;
  }
};

const isSyntheticOrDomEvent = (value: object): boolean => {
  const v = value as Record<string, unknown>;

  // event object stringify ยากและเปลี่ยนทุกครั้ง จึง normalize เป็นค่าเดียว
  return (
    'nativeEvent' in v ||
    '_reactName' in v ||
    'dispatchConfig' in v ||
    'currentTarget' in v ||
    typeof (v as { persist?: unknown }).persist === 'function'
  );
};

const normalizeForSignature = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => normalizeForSignature(item));

  if (value && typeof value === 'object') {
    if (isSyntheticOrDomEvent(value)) return '[Event]';

    const source = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    Object.keys(source)
      .sort()
      .forEach((key) => {
        normalized[key] = normalizeForSignature(source[key]);
      });

    return normalized;
  }

  return value;
};

const buildNavigationSignature = (methodName: keyof typeof expoRouter, args: unknown[]) => {
  try {
    // สร้าง signature เพื่อใช้กันการ navigate ซ้ำด้วย method และ args เดิม
    return `${String(methodName)}:${JSON.stringify(normalizeForSignature(args))}`;
  } catch {
    return `${String(methodName)}:${args.map((arg) => String(arg)).join('|')}`;
  }
};

const isDuplicateGuardedMethod = (methodName: keyof typeof expoRouter) =>
  ['push', 'replace', 'navigate', 'back', 'dismiss', 'dismissTo', 'dismissAll'].includes(
    String(methodName),
  );

const shouldBlockDuplicateNavigation = (methodName: keyof typeof expoRouter, args: unknown[]) => {
  if (!isDuplicateGuardedMethod(methodName)) return false;

  const now = Date.now();
  const signature = buildNavigationSignature(methodName, args);

  if (
    lastNavigationAction &&
    lastNavigationAction.signature === signature &&
    now - lastNavigationAction.at < NAV_DUPLICATE_GUARD_WINDOW_MS
  ) {
    Logger.debug(`[safeRouter] Blocked duplicate ${String(methodName)} call`);
    return true;
  }

  lastNavigationAction = { signature, at: now };
  return false;
};

const runWhenReady = (fn: () => void, methodName: string, attempt = 0) => {
  if (!isNavigationReady) {
    if (attempt >= NAV_MAX_RETRIES) {
      Logger.warn(`[safeRouter] Navigation not ready for ${methodName}`);
      return;
    }

    setTimeout(() => runWhenReady(fn, methodName, attempt + 1), NAV_RETRY_DELAY_MS);
    return;
  }

  // ใช้ requestAnimationFrame แทน requestIdleCallback เพื่อให้ตอบสนองทันทีใน frame ถัดไป
  // โดยยังลด race กับ interaction ปัจจุบันได้อยู่ (ต่างจาก setTimeout 0 ที่อาจแทรกได้ทันที)
  requestAnimationFrame(() => {
    if (!isNavigationReady) {
      if (attempt >= NAV_MAX_RETRIES) {
        Logger.warn(`[safeRouter] Navigation not ready for ${methodName}`);
        return;
      }

      setTimeout(() => runWhenReady(fn, methodName, attempt + 1), NAV_RETRY_DELAY_MS);
      return;
    }

    try {
      // ตรวจ navigation context ซ้ำ เพราะ Fast Refresh หรือ unmount อาจทำให้ state stale
      expoRouter.canGoBack();
    } catch (_error) {
      setNavigationReady(false);

      if (attempt >= NAV_MAX_RETRIES) {
        Logger.warn(`[safeRouter] Navigation not ready for ${methodName}`);
        return;
      }

      setTimeout(() => runWhenReady(fn, methodName, attempt + 1), NAV_RETRY_DELAY_MS);
      return;
    }

    try {
      fn();
    } catch (error) {
      if (isIgnorableNavError(error)) {
        Logger.warn(`[safeRouter] Swallowed navigation-context error on ${methodName}`);
        return;
      }

      Logger.warn(`[safeRouter] ${methodName} failed`, error);
    }
  });
};

const wrap =
  <TArgs extends unknown[]>(methodName: keyof typeof expoRouter) =>
  (...args: TArgs): void => {
    // ตรวจ duplicate synchronously ก่อน queue เพื่อกันผู้ใช้กดซ้ำเร็วหลายครั้ง
    if (shouldBlockDuplicateNavigation(methodName, args as unknown[])) return;

    runWhenReady(() => {
      if (methodName === 'back' && !canGoBackSafely()) {
        Logger.debug('[safeRouter] Ignored back(): no navigator history');
        return;
      }

      // ใช้ original ที่บันทึกไว้ก่อน patch เพื่อไม่ให้ guard ถูกเรียกซ้ำ
      const fn = (savedOriginals[String(methodName)] ?? expoRouter[methodName]) as unknown;

      if (typeof fn !== 'function') return;

      (fn as (...args: TArgs) => void)(...args);
    }, String(methodName));
  };

const safeRouter = {
  push: wrap('push'),
  replace: wrap('replace'),
  back: wrap('back'),
  navigate: wrap('navigate'),
  dismiss: wrap('dismiss'),
  dismissAll: wrap('dismissAll'),
  dismissTo: wrap('dismissTo'),
  setParams: wrap('setParams'),
  prefetch: wrap('prefetch'),
  reload: wrap('reload'),
  canGoBack: (): boolean => {
    if (!isNavigationReady) return false;

    try {
      return expoRouter.canGoBack();
    } catch (error) {
      if (isIgnorableNavError(error)) return false;

      Logger.warn('[safeRouter] canGoBack failed', error);
      return false;
    }
  },
};

const patchGlobalRouter = () => {
  const methods: (keyof typeof expoRouter)[] = [
    'push',
    'replace',
    'back',
    'setParams',
    'dismiss',
    'dismissAll',
    'dismissTo',
    'navigate',
    'prefetch',
    'reload',
  ];

  methods.forEach((methodName) => {
    const original = (expoRouter as unknown as Record<string, unknown>)[methodName];

    if (typeof original === 'function') {
      if ((original as { __safeRouterWrapped?: boolean }).__safeRouterWrapped) return;

      // บันทึก original ก่อน patch เพื่อให้ wrap() เรียกตรงโดยไม่ผ่าน guard ซ้ำ
      savedOriginals[String(methodName)] = original as (...args: unknown[]) => void;

      // patch router global เพื่อให้จุดที่ import router ตรงจาก expo-router ได้ behavior ที่ปลอดภัยขึ้น
      const wrapped = (...args: unknown[]): void => {
        if (shouldBlockDuplicateNavigation(methodName, args)) return;

        runWhenReady(() => {
          if (methodName === 'back' && !canGoBackSafely()) {
            Logger.debug('[safeRouter] Ignored back(): no navigator history');
            return;
          }

          (original as (...args: unknown[]) => void).apply(expoRouter, args);
        }, String(methodName));
      };

      (wrapped as { __safeRouterWrapped?: boolean }).__safeRouterWrapped = true;
      (expoRouter as unknown as Record<string, unknown>)[methodName] = wrapped;
    }
  });
};

patchGlobalRouter();

export { safeRouter };
