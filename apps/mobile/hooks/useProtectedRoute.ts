/**
 * useProtectedRoute.ts
 *
 * Auth guard หลักของแอป สำหรับตัดสินว่า user ควรถูกพาไป auth, setup หรือ main
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รอ auth และ navigation พร้อมก่อนเริ่ม resolve route
 * - ใช้ boot cache เป็น fast path เพื่อลดการเรียก API ตอนเปิดแอป
 * - fallback ไปเรียก current elder จาก API เมื่อ cache ไม่พอหรือไม่น่าเชื่อถือ
 * - redirect ไปหน้าที่ถูกต้องด้วย safeRouter เพื่อลด navigation-context error
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSegments, useRootNavigationState } from 'expo-router';

import { useAuth } from '../context/AuthContext';

import Logger from '../utils/logger';
import { getCurrentElder } from '../services/elderService';
import { safeRouter as router } from '../utils/safeRouter';
import {
  setSetupElderId,
  setSetupDeviceId,
  clearSetupStep,
  setLastResolvedRoute,
  getBootDataSync,
  readBootData,
  type BootData,
} from '../utils/setupStorage';

import type { Elder } from '../services/types';

type AppState = 'LOADING' | 'RESOLVING' | 'READY';
type ResolvedRoute = 'auth' | 'setup-empty' | 'setup-step' | 'main' | null;
type SetupStepRoute = '1' | '2' | '3';

export interface CachedRouteDecision {
  route: Exclude<ResolvedRoute, 'auth' | null>;
  setupStep: SetupStepRoute | null;
  reason:
    | 'setup-complete'
    | 'setup-step-valid-cache'
    | 'setup-fragments-recovered'
    | 'cached-last-route';
}

interface RouteValidationResult {
  isLoading: boolean;
  resolvedRoute: ResolvedRoute;
  setupStep: string | null;
}

export const inferSetupStepFromElder = (elder: Elder | null): '2' | '3' | null => {
  if (!elder) return null;

  // ผู้ใช้มี elder แล้วให้เข้าหน้าหลักได้ แม้ยังไม่ผูกอุปกรณ์
  // Dashboard จะจัดการกรณีไม่มีอุปกรณ์เอง
  return null;
};

const isSetupInProgressStep = (value: string | null): value is SetupStepRoute =>
  value === '1' || value === '2' || value === '3';

export function resolveCachedRouteFromBootData(bootData: BootData): CachedRouteDecision | null {
  const currentSetupStep = bootData.setupStep;
  const cachedElderId = bootData.elderId;
  const cachedDeviceId = bootData.deviceId;
  const cachedSerialNumber = bootData.serialNumber;
  const lastRoute = bootData.lastRoute;

  if (currentSetupStep === 'complete') {
    return { route: 'main', setupStep: null, reason: 'setup-complete' };
  }

  if (isSetupInProgressStep(currentSetupStep)) {
    const isValidSetupCache =
      currentSetupStep === '1' ||
      (currentSetupStep === '2' && !!cachedElderId) ||
      (currentSetupStep === '3' && !!cachedElderId && !!cachedDeviceId);

    if (isValidSetupCache) {
      return {
        route: 'setup-step',
        setupStep: currentSetupStep,
        reason: 'setup-step-valid-cache',
      };
    }
  }

  if (!currentSetupStep && (cachedElderId || cachedDeviceId || cachedSerialNumber)) {
    if (lastRoute === 'main') {
      // main อาจ stale หลังเปลี่ยนบัญชีหรือ setup state เปลี่ยน จึงบังคับให้ไป API validation
      return null;
    }

    // มี cache บางส่วนค้างอยู่ ให้กู้ step ที่น่าจะทำค้างไว้
    const inferredFromCache: SetupStepRoute = cachedDeviceId || cachedSerialNumber ? '3' : '2';

    return {
      route: 'setup-step',
      setupStep: inferredFromCache,
      reason: 'setup-fragments-recovered',
    };
  }

  if (lastRoute === 'setup-empty') {
    return {
      route: lastRoute,
      setupStep: null,
      reason: 'cached-last-route',
    };
  }

  return null;
}

export function useProtectedRoute(): RouteValidationResult {
  const { isSignedIn, isLoading: isAuthLoading, signOut } = useAuth();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  // ต้องรอ root navigation พร้อมก่อน replace route
  const isNavigationReady = rootNavigationState?.key != null;

  const [appState, setAppState] = useState<AppState>('LOADING');
  const [resolvedRoute, setResolvedRoute] = useState<ResolvedRoute>(null);
  const [setupStep, setSetupStep] = useState<string | null>(null);
  const [hasResolved, setHasResolved] = useState(false);
  const [hasRecheckedFromTabs, setHasRecheckedFromTabs] = useState(false);
  const [resolvedAt, setResolvedAt] = useState<number>(0);
  const [navigationComplete, setNavigationComplete] = useState(false);

  // ref กลุ่มนี้ใช้กัน race ระหว่าง auth, route resolve และ navigation effect
  const isInitialNavigationRef = useRef(true);
  const isSignedInMountRef = useRef(true);
  const isResolvingRef = useRef(false);
  const isAuthRecoveryRef = useRef(false);
  const segmentsRef = useRef(segments);

  useEffect(() => {
    // เก็บ segments ล่าสุดไว้ให้ async resolver อ่านได้ แม้ effect เดิมยังทำงานอยู่
    segmentsRef.current = segments;
  }, [segments]);

  const commitRoute = useCallback((route: ResolvedRoute, step?: string | null) => {
    if (step !== undefined) setSetupStep(step);

    setResolvedRoute(route);
    setResolvedAt(Date.now());
    setAppState('READY');
    setHasResolved(true);

    // บันทึก route ล่าสุดไว้เป็น boot cache สำหรับเปิดแอปรอบถัดไป
    // ไฟล์ถัดไป: utils/setupStorage.ts
    if (route) setLastResolvedRoute(route).catch(() => {});
  }, []);

  const resolveRoute = useCallback(async () => {
    if (isResolvingRef.current) {
      Logger.debug('Route resolution skipped: resolve already in progress');
      return;
    }

    isResolvingRef.current = true;
    Logger.info('Route Resolution Started', { isSignedIn, segment: segments[0] });
    setAppState('RESOLVING');

    try {
      if (!isSignedIn) {
        Logger.info('Route resolved: auth (not signed in)');
        commitRoute('auth');
        return;
      }

      // Fast path: อ่าน boot cache ก่อน เพื่อให้ cold start ไม่ต้องรอ API ถ้าข้อมูลครบ
      // ไฟล์ถัดไป: utils/setupStorage.ts
      const bootData = getBootDataSync() ?? (await readBootData());
      const currentSetupStep = bootData.setupStep;
      const cachedElderId = bootData.elderId;
      const cachedDeviceId = bootData.deviceId;
      const cachedDecision = resolveCachedRouteFromBootData(bootData);

      if (cachedDecision) {
        if (cachedDecision.reason === 'setup-step-valid-cache') {
          Logger.info('Route resolved: setup-step (fast path)', { step: cachedDecision.setupStep });
        } else if (cachedDecision.reason === 'setup-fragments-recovered') {
          Logger.info('Route resolved: setup-step (fast path, recovered from cache fragments)', {
            step: cachedDecision.setupStep,
          });
        } else if (cachedDecision.reason === 'setup-complete') {
          Logger.info('Route resolved: main (fast path, setup already completed)');
        } else {
          Logger.info('Route resolved from cached lastRoute (fast path)', {
            lastRoute: cachedDecision.route,
          });
        }

        commitRoute(cachedDecision.route, cachedDecision.setupStep);
        return;
      }

      // Slow path: cache ไม่พอหรือไม่น่าเชื่อถือ จึงถาม backend เพื่อยืนยันสถานะจริง
      // ไฟล์ถัดไป: services/elderService.ts
      const currentElder = await getCurrentElder();

      if (!currentElder) {
        Logger.info('Route resolved: setup-empty (no elder data)');
        commitRoute('setup-empty');
        return;
      }

      let setupElderId = cachedElderId;
      let setupDeviceId = cachedDeviceId;

      // self-heal cache ที่ขาดหาย โดยเติม elderId/deviceId จาก backend state
      if (
        !setupElderId &&
        currentElder.id &&
        currentSetupStep &&
        ['2', '3'].includes(currentSetupStep)
      ) {
        setupElderId = String(currentElder.id);
        await setSetupElderId(setupElderId);
      }

      if (!setupDeviceId && currentElder.device?.id && currentSetupStep === '3') {
        setupDeviceId = String(currentElder.device.id);
        await setSetupDeviceId(setupDeviceId);
      }

      if (currentSetupStep && ['1', '2', '3'].includes(currentSetupStep)) {
        let isValidSetupCache =
          currentSetupStep === '1' ||
          (currentSetupStep === '2' && !!setupElderId) ||
          (currentSetupStep === '3' &&
            !!setupElderId &&
            (!!setupDeviceId || !!currentElder.device));

        if (currentElder.device) {
          if (currentSetupStep === '2') {
            // มีอุปกรณ์แล้ว แปลว่า cache step 2 น่าจะเก่า
            isValidSetupCache = false;
          } else if (currentSetupStep === '3') {
            // ถ้าอุปกรณ์ออนไลน์แล้ว ให้ถือว่า setup เสร็จ ไม่ต้องค้างที่ step 3
            if (
              currentElder.device.isOnline === true ||
              currentElder.device.onlineStatus === 'ONLINE'
            ) {
              isValidSetupCache = false;
            }
          }
        }

        if (!isValidSetupCache) {
          Logger.warn('Ignoring stale setup_step cache', {
            currentSetupStep,
            hasSetupElderId: !!setupElderId,
            hasSetupDeviceId: !!setupDeviceId,
          });

          await clearSetupStep();
        } else {
          Logger.info('Route resolved: setup-step (slow path)', { step: currentSetupStep });
          commitRoute('setup-step', currentSetupStep);
          return;
        }
      }

      if (currentSetupStep === 'complete') {
        Logger.info('Route resolved: main (setup already completed)');
        commitRoute('main');
        return;
      }

      // กรณีไม่มี setupStep ให้ลองอนุมานจาก elder ที่ backend ส่งกลับมา
      const inferredStep = inferSetupStepFromElder(currentElder);

      if (inferredStep) {
        Logger.info('Route resolved: setup-step (inferred - first time)', { step: inferredStep });
        commitRoute('setup-step', inferredStep);
        return;
      }

      Logger.info('Route resolved: main');
      commitRoute('main');
    } catch (error) {
      if (isNetworkError(error)) {
        Logger.warn('Route resolution failed (network error), trying cached route');
      } else {
        Logger.error('Route resolution error:', error);
      }

      const status = getErrorStatus(error);

      if (status === 401 || status === 403) {
        Logger.warn('Auth error - routing to login');

        if (!isAuthRecoveryRef.current) {
          isAuthRecoveryRef.current = true;

          try {
            // auth error ให้ signOut เพื่อเคลียร์ token, store และ cache ก่อนกลับ login
            // ไฟล์ถัดไป: context/AuthContext.tsx
            await signOut();
          } catch (signOutError) {
            Logger.warn('Auth recovery signOut failed', signOutError);
          } finally {
            isAuthRecoveryRef.current = false;
          }
        }

        // บังคับ route เป็น auth หลัง signOut เพื่อ override transient reset effect
        commitRoute('auth');
      } else {
        const bootFallback = getBootDataSync();

        if (bootFallback?.lastRoute && isSignedIn) {
          Logger.info('Using cached route as fallback', { cachedRoute: bootFallback.lastRoute });
          commitRoute(bootFallback.lastRoute as ResolvedRoute);
          return;
        }

        // error อื่น ๆ ให้พาผู้ใช้ที่ login อยู่เข้าหน้าหลักแทนการค้างบน splash
        commitRoute(isSignedIn ? 'main' : 'auth');
      }
    } finally {
      isResolvingRef.current = false;
    }
  }, [isSignedIn, segments, commitRoute, signOut]);

  useEffect(() => {
    if (isAuthLoading) {
      setAppState('LOADING');
      return;
    }

    if (!isNavigationReady) {
      return;
    }

    // HMR/reload อาจทำให้ segments ว่างชั่วคราว ถ้าเคย resolve แล้วให้ข้าม
    if ((segments as string[]).length === 0 && hasResolved) {
      return;
    }

    // resolve ครั้งเดียวต่อ auth state
    if (!hasResolved) {
      resolveRoute();
    }
  }, [isAuthLoading, isNavigationReady, segments, hasResolved, resolveRoute]);

  useEffect(() => {
    if (isSignedInMountRef.current) {
      isSignedInMountRef.current = false;
      return;
    }

    // auth state เปลี่ยนหลัง mount ต้องเริ่ม resolve route ใหม่
    setHasResolved(false);
    setResolvedRoute(null);
    setHasRecheckedFromTabs(false);
    setResolvedAt(0);
    isInitialNavigationRef.current = true;

    const currentSegment = (segmentsRef.current as string[])[0];

    const alreadyOnCorrectSegment =
      (isSignedIn && (currentSegment === '(setup)' || currentSegment === '(tabs)')) ||
      (!isSignedIn && currentSegment === '(auth)');

    if (alreadyOnCorrectSegment) {
      // อยู่ group ที่ถูกต้องแล้ว ไม่ต้องบัง UI ระหว่าง re-resolve
      setNavigationComplete(true);
      setAppState('LOADING');
    } else {
      setNavigationComplete(false);
      setAppState('LOADING');
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (appState !== 'READY' || resolvedRoute !== 'setup-empty') return;

    const currentSegment = segments[0] as string;
    if (currentSegment !== '(tabs)') return;
    if (hasRecheckedFromTabs) return;

    setHasRecheckedFromTabs(true);

    const recheck = async () => {
      try {
        // ถ้าผู้ใช้เข้า tabs เอง แต่ route state ยังเป็น setup-empty ให้ถาม backend ซ้ำหนึ่งครั้ง
        // ไฟล์ถัดไป: services/elderService.ts
        const currentElder = await getCurrentElder();

        if (currentElder) {
          Logger.info('Recheck: elder found, routing to main');
          setResolvedRoute('main');
          setSetupStep(null);
        }
      } catch (error) {
        Logger.warn('Recheck failed, keeping setup-empty', error);
      }
    };

    recheck();
  }, [appState, resolvedRoute, segments, hasRecheckedFromTabs]);

  useEffect(() => {
    if (appState !== 'READY' || !resolvedRoute) return;
    if (!isNavigationReady) return;

    const currentSegment = segments[0] as string;

    const bootFallback = getBootDataSync();

    if (
      bootFallback?.setupStep === 'complete' &&
      (resolvedRoute === 'setup-step' || resolvedRoute === 'setup-empty')
    ) {
      Logger.info('Catching up to local storage: setup is complete. Mutating route state to main.');
      setResolvedRoute('main');
      return;
    }

    if (resolvedRoute === 'setup-empty' && currentSegment === '(tabs)' && !hasRecheckedFromTabs) {
      Logger.info('Delay redirect to allow recheck from tabs');
      return;
    }

    if (!isInitialNavigationRef.current) {
      const redirectAgeMs = Date.now() - resolvedAt;

      // กัน forced redirect จาก tabs ไป setup ระหว่าง state race หลัง setup หรือ auth เปลี่ยน
      if (
        currentSegment === '(tabs)' &&
        (resolvedRoute === 'setup-empty' || resolvedRoute === 'setup-step') &&
        redirectAgeMs < 1200
      ) {
        return;
      }
    }

    const needsRedirect = (() => {
      switch (resolvedRoute) {
        case 'auth':
          return currentSegment !== '(auth)';

        case 'setup-empty':
          return currentSegment !== '(setup)';

        case 'setup-step':
          return currentSegment !== '(setup)';

        case 'main':
          return currentSegment !== '(tabs)' && currentSegment !== '(features)';

        default:
          return false;
      }
    })();

    if (!needsRedirect) {
      Logger.info('No redirect needed', { resolvedRoute, currentSegment });
      isInitialNavigationRef.current = false;
      setNavigationComplete(true);
      return;
    }

    Logger.info('Redirecting', { from: currentSegment, to: resolvedRoute });
    setNavigationComplete(false);

    const safeReplace = (href: Parameters<typeof router.replace>[0]) => {
      if (!isNavigationReady) {
        Logger.warn('Navigation not ready, skipping redirect', {
          href,
          resolvedRoute,
          currentSegment,
        });
        return;
      }

      // ใช้ safeRouter เพื่อกัน navigation-context error ตอน replace เร็วเกินไป
      // ไฟล์ถัดไป: utils/safeRouter.ts
      router.replace(href);
    };

    switch (resolvedRoute) {
      case 'auth':
        safeReplace('/(auth)/login');
        break;

      case 'setup-empty':
        safeReplace('/(setup)/empty-state');
        break;

      case 'setup-step':
        if (setupStep === '1') {
          safeReplace('/(setup)/step1-elder-info');
        } else if (setupStep === '2') {
          safeReplace('/(setup)/step2-device-pairing');
        } else if (setupStep === '3') {
          safeReplace('/(setup)/step3-wifi-setup');
        } else {
          safeReplace('/(setup)/empty-state');
        }
        break;

      case 'main':
        safeReplace('/(tabs)/dashboard');
        break;
    }

    // ยังไม่ mark ว่า navigation เสร็จ ต้องรอ segments เปลี่ยนเข้าปลายทางจริงก่อน
    isInitialNavigationRef.current = false;
  }, [
    appState,
    resolvedRoute,
    segments,
    setupStep,
    isNavigationReady,
    hasRecheckedFromTabs,
    resolvedAt,
  ]);

  // คง overlay ไว้จน route resolve แล้ว และ redirect เสร็จหรือยืนยันแล้วว่าไม่ต้อง redirect
  const isLoading = appState !== 'READY' || !navigationComplete;

  return { isLoading, resolvedRoute, setupStep };
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as { response?: { status?: number }; status?: number };
    return errorObj.response?.status ?? errorObj.status;
  }

  return undefined;
}

function isNetworkError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const err = error as { message?: string; code?: string };
  const message = typeof err.message === 'string' ? err.message : '';

  return err.code === 'ERR_NETWORK' || message.includes('Network Error');
}
