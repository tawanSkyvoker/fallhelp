/**
 * useHomeDisplayState.ts
 *
 * Hook สำหรับรวมกติกาคำนวณสถานะหน้า Home ให้อยู่จุดเดียว
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวมข้อมูล elder และ realtime signal ที่ใช้แสดงบนหน้า Home
 * - คำนวณสถานะ online, connecting, heart rate และ fall event
 * - ใช้ snapshot เพื่อลดอาการการ์ดกระพริบระหว่าง refetch หรือ transition
 * - คืนค่า display state ให้หน้า Home นำไป render โดยไม่ต้องกระจาย logic หลายจุด
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import type { RealtimeHeartConfidence } from '../store/useSensorStore';
import type { RealtimeFallStatus } from '../store/useFallAlertStore';
import type { Elder, Event } from '../services/types';
import {
  getDeviceLastOnlineAt,
  getOptimisticOnlineFromApi,
  hasFreshDeviceLastOnline,
  hasRealtimeDeviceSignal,
  isDeviceMarkedOnlineByApi,
} from '../utils/deviceConnectivity';

// defer setState ไปท้าย event loop เพื่อลด cascading renders ระหว่างคำนวณ derived state
const deferStateUpdate = (updater: () => void): void => {
  setTimeout(updater, 0);
};

const HEART_FRESHNESS_MS = 60 * 1000;
const FALL_FRESHNESS_MS = 10 * 60 * 1000;
const OFFLINE_DISPLAY_GRACE_MS = 12 * 1000;
const SOCKET_CONNECT_GRACE_MS = 8 * 1000;
const FIRST_REALTIME_SIGNAL_GRACE_MS = 8 * 1000;
const CONNECTING_DISPLAY_MAX_MS = 15 * 1000;

type DisplaySignals = {
  isConnected: boolean;
  socketConnected: boolean;
  fallStatus: RealtimeFallStatus;
  lastFallUpdate: Date | null;
  heartRate: number | null;
  heartConfidence: RealtimeHeartConfidence;
  lastHeartUpdate: Date | null;
  lastStatusUpdate: Date | null;
};

type UseHomeDisplayStateParams = {
  now: number;
  isTransitioning: boolean;
  elderInfo: Elder | null;
  stableElderInfo: Elder | null;
  stableSignals: DisplaySignals | null;
  isConnected: boolean;
  socketConnected: boolean;
  fallStatus: RealtimeFallStatus;
  lastFallUpdate: Date | null;
  heartRate: number | null;
  heartConfidence: RealtimeHeartConfidence;
  lastHeartUpdate: Date | null;
  lastStatusUpdate: Date | null;
  manualAcknowledgedAt: Date | null;
  activeFallEventId: string | null;
  initialEvents: Event[] | null | undefined;
  hasFetchedInitialEvents: boolean;
  firstSocketConnectedAt: number | null;
  screenEnterAt: number;
};

export function useHomeDisplayState({
  now,
  isTransitioning,
  elderInfo,
  stableElderInfo,
  stableSignals,
  isConnected,
  socketConnected,
  fallStatus,
  lastFallUpdate,
  heartRate,
  heartConfidence,
  lastHeartUpdate,
  lastStatusUpdate,
  manualAcknowledgedAt,
  activeFallEventId,
  initialEvents,
  hasFetchedInitialEvents,
  firstSocketConnectedAt,
  screenEnterAt,
}: UseHomeDisplayStateParams) {
  // snapshot ของการ์ดเหตุการณ์ ใช้ตรึงผลล่าสุดระหว่าง dashboard sync หรือ refetch
  const [fallCardSnapshot, setFallCardSnapshot] = useState<{
    shouldShowFallAlert: boolean;
    shouldShowFallSuspected: boolean;
    shouldShowStaleFall: boolean;
    shouldShowFallDetailAction: boolean;
    fallDisplayLabel: string;
    lastUpdatedAt: Date | null;
  } | null>(null);

  // timestamp ที่ใช้แสดง “สถานะล่าสุด” โดยไม่ผูกกับ now ทุกครั้งจน UI กระพริบ
  const [stableStatusTimestamp, setStableStatusTimestamp] = useState<Date | null>(null);

  // จำสถานะ online รอบก่อน เพื่ออัปเดตเวลาเฉพาะตอนมีการเปลี่ยนสถานะจริง
  const [prevOnlineStatus, setPrevOnlineStatus] = useState<boolean | null>(null);

  // ใช้ระบุว่า snapshot ปัจจุบันเป็นของ elder/device ไหน
  const snapshotOwnerKeyRef = useRef<string | null>(null);

  const displayElder = useMemo(() => {
    // ถ้ารู้แน่ชัดว่าอุปกรณ์ใน elderInfo กับ stableElderInfo ไม่ตรงกัน (เพิ่งผูก หรือ เพิ่งยกเลิก)
    // ไม่ควรใช้ stableElderInfo มาบังข้อมูลใหม่
    const hasDeviceChanged =
      elderInfo && stableElderInfo && elderInfo.device?.id !== stableElderInfo.device?.id;

    // ระหว่าง transition ให้ใช้ stableElderInfo ก่อน เพื่อกันชื่อ/อุปกรณ์วูบหาย
    const primary =
      isTransitioning && !hasDeviceChanged
        ? (stableElderInfo ?? elderInfo)
        : (elderInfo ?? stableElderInfo);

    if (!primary) return null;
    if (!stableElderInfo || primary.id !== stableElderInfo.id) {
      return primary;
    }

    // รวมข้อมูลสดกับ snapshot เดิม เพื่อเติม field ที่อาจหายระหว่าง refetch
    return {
      ...primary,
      firstName: primary.firstName?.trim() ? primary.firstName : stableElderInfo.firstName,
      lastName: primary.lastName?.trim() ? primary.lastName : stableElderInfo.lastName,
      gender: primary.gender ?? stableElderInfo.gender,
      dateOfBirth: primary.dateOfBirth ?? stableElderInfo.dateOfBirth,
      device: hasDeviceChanged ? elderInfo.device : (primary.device ?? stableElderInfo.device),
    };
  }, [isTransitioning, stableElderInfo, elderInfo]);

  const displaySignals = useMemo<DisplaySignals>(
    () =>
      // ระหว่าง transition ให้ใช้สัญญาณชุดเดิมก่อน เพื่อลดการกระพริบของการ์ด realtime
      isTransitioning && stableSignals
        ? stableSignals
        : {
            isConnected,
            socketConnected,
            fallStatus,
            lastFallUpdate,
            heartRate,
            heartConfidence,
            lastHeartUpdate,
            lastStatusUpdate,
          },
    [
      isTransitioning,
      stableSignals,
      isConnected,
      socketConnected,
      fallStatus,
      lastFallUpdate,
      heartRate,
      heartConfidence,
      lastHeartUpdate,
      lastStatusUpdate,
    ],
  );

  useEffect(() => {
    const ownerKey = `${displayElder?.id ?? 'no-elder'}:${displayElder?.device?.id ?? 'no-device'}`;

    if (snapshotOwnerKeyRef.current === null) {
      snapshotOwnerKeyRef.current = ownerKey;
      return;
    }

    if (snapshotOwnerKeyRef.current !== ownerKey) {
      snapshotOwnerKeyRef.current = ownerKey;

      // เปลี่ยน elder/device จริงแล้วต้องล้าง snapshot เพื่อไม่ให้สถานะของคนเดิมค้างบนหน้าใหม่
      deferStateUpdate(() => {
        setFallCardSnapshot(null);
        setStableStatusTimestamp(null);
        setPrevOnlineStatus(null);
      });
    }
  }, [displayElder?.id, displayElder?.device?.id]);

  const hasDevice = !!displayElder?.device;

  // ถ้า caregiver กด “รับทราบแล้ว” และไม่มี active fall event ให้ถือว่าสถานะ fall เก่ากลับเป็นปกติ
  const shouldOverrideFallAsNormal =
    manualAcknowledgedAt &&
    displaySignals.fallStatus === 'FALL' &&
    !activeFallEventId &&
    !!displaySignals.lastFallUpdate &&
    displaySignals.lastFallUpdate <= manualAcknowledgedAt;

  const effectiveFallStatus = shouldOverrideFallAsNormal ? 'NORMAL' : displaySignals.fallStatus;

  // fallback จาก initialEvents ใช้กรณียังไม่มี realtime fall state ในเครื่อง
  const latestFallEventFromApi =
    initialEvents?.find((event) => event.fallStage === 'CONFIRMED') ?? null;

  const latestFallEventTimestampFromApi = latestFallEventFromApi
    ? new Date(latestFallEventFromApi.timestamp)
    : null;

  const hasLocalFallState =
    hasDevice && (effectiveFallStatus === 'FALL' || !!displaySignals.lastFallUpdate);

  const shouldUseApiFallFallback = hasDevice && !hasLocalFallState && !!latestFallEventFromApi;

  const hasStaleLocalFallSignal =
    !!displaySignals.lastFallUpdate &&
    now - displaySignals.lastFallUpdate.getTime() > FALL_FRESHNESS_MS;

  // ถ้าโหลด event จาก API แล้วไม่พบเหตุล้ม และ local signal ก็เก่าแล้ว ให้บังคับกลับเป็น normal
  const shouldForceNoEventFromApi =
    hasFetchedInitialEvents &&
    !latestFallEventFromApi &&
    !activeFallEventId &&
    (!displaySignals.lastFallUpdate || hasStaleLocalFallSignal);

  const effectiveFallStatusForDisplay = shouldForceNoEventFromApi
    ? 'NORMAL'
    : shouldUseApiFallFallback
      ? latestFallEventFromApi.cancelledAt
        ? 'NORMAL'
        : 'FALL'
      : effectiveFallStatus;

  const fallTimestampForDisplay = shouldForceNoEventFromApi
    ? null
    : shouldUseApiFallFallback && latestFallEventFromApi
      ? new Date(latestFallEventFromApi.timestamp)
      : displaySignals.lastFallUpdate;

  // อ่าน snapshot สถานะอุปกรณ์จาก API เพื่อใช้ร่วมกับ realtime signal
  // ไฟล์ถัดไป: utils/deviceConnectivity.ts
  const apiReportsOnline = isDeviceMarkedOnlineByApi(displayElder?.device);
  const deviceLastOnlineAt = getDeviceLastOnlineAt(displayElder?.device);

  const hasRealtimeSignal = hasRealtimeDeviceSignal({
    lastHeartUpdate: displaySignals.lastHeartUpdate,
    lastStatusUpdate: displaySignals.lastStatusUpdate,
  });

  const hasApiConnectivitySnapshot =
    hasDevice &&
    (typeof displayElder?.device?.isOnline === 'boolean' ||
      displayElder?.device?.onlineStatus === 'ONLINE' ||
      displayElder?.device?.onlineStatus === 'OFFLINE' ||
      !!deviceLastOnlineAt);

  // optimistic online ใช้ snapshot จาก API ชั่วคราวช่วงที่ยังไม่ได้รับ realtime signal แรก
  const optimisticOnlineFromApi =
    hasDevice &&
    getOptimisticOnlineFromApi({
      device: displayElder?.device,
      now,
      hasRealtimeSignal,
    });

  const apiOnlineWhileSocketUnavailable =
    hasDevice &&
    !displaySignals.socketConnected &&
    apiReportsOnline &&
    hasFreshDeviceLastOnline({ lastOnlineAt: deviceLastOnlineAt, now });

  const isWaitingFirstRealtimeSignal =
    hasDevice &&
    displaySignals.socketConnected &&
    !hasRealtimeSignal &&
    firstSocketConnectedAt !== null &&
    now - firstSocketConnectedAt < FIRST_REALTIME_SIGNAL_GRACE_MS;

  const isWaitingSocketConnection =
    hasDevice && !displaySignals.socketConnected && now - screenEnterAt < SOCKET_CONNECT_GRACE_MS;

  const shouldDelayOfflineDisplay =
    hasDevice &&
    displaySignals.socketConnected &&
    !displaySignals.isConnected &&
    !optimisticOnlineFromApi &&
    now - screenEnterAt < OFFLINE_DISPLAY_GRACE_MS;

  const shouldStopConnectingDueToTimeout = now - screenEnterAt >= CONNECTING_DISPLAY_MAX_MS;

  const isDeviceOnlineForDisplay =
    hasDevice &&
    (displaySignals.isConnected || optimisticOnlineFromApi || apiOnlineWhileSocketUnavailable);

  const isWithinInitialConnectivityGrace =
    isWaitingSocketConnection || isWaitingFirstRealtimeSignal || shouldDelayOfflineDisplay;

  const shouldPreferApiOfflineState =
    hasApiConnectivitySnapshot &&
    !apiReportsOnline &&
    !displaySignals.isConnected &&
    !isWithinInitialConnectivityGrace;

  const isBootstrappingDashboard =
    hasDevice &&
    !hasRealtimeSignal &&
    !shouldPreferApiOfflineState &&
    now - screenEnterAt < CONNECTING_DISPLAY_MAX_MS;

  // ตัดสินสถานะ “กำลังเชื่อมต่อ” ด้วย grace window หลายชั้น เพื่อลดการสลับ offline/online เร็วเกินไป
  const shouldShowConnecting =
    hasDevice &&
    (isWaitingSocketConnection ||
      (isWaitingFirstRealtimeSignal && !displaySignals.isConnected && !optimisticOnlineFromApi) ||
      shouldDelayOfflineDisplay) &&
    !shouldPreferApiOfflineState &&
    !optimisticOnlineFromApi &&
    !shouldStopConnectingDueToTimeout;

  const shouldHoldEventCardForInitialHistory =
    !!displayElder &&
    !hasFetchedInitialEvents &&
    !fallCardSnapshot &&
    effectiveFallStatus !== 'FALL';

  const showTransitionFallback =
    (hasDevice && shouldShowConnecting && (!hasFetchedInitialEvents || !hasRealtimeSignal)) ||
    shouldHoldEventCardForInitialHistory;

  const showEventTransitionFallback =
    showTransitionFallback &&
    !(effectiveFallStatusForDisplay === 'FALL' && !!fallTimestampForDisplay);

  const shouldShowDashboardSync =
    hasDevice &&
    (isBootstrappingDashboard ||
      // ถ้ามี fall active แล้ว ต้องคงการ์ดเหตุล้มไว้ ไม่ให้ connecting มากลบสถานะฉุกเฉิน
      (showEventTransitionFallback && effectiveFallStatusForDisplay !== 'FALL'));

  const isDeviceCardDisabled = hasDevice && shouldShowConnecting;

  const isHeartDataFresh =
    !!displaySignals.lastHeartUpdate &&
    now - displaySignals.lastHeartUpdate.getTime() <= HEART_FRESHNESS_MS;

  const heartValue = displaySignals.heartRate;
  const heartConfidenceValue = displaySignals.heartConfidence;

  const shouldShowHeartRate =
    isDeviceOnlineForDisplay &&
    isHeartDataFresh &&
    heartValue !== null &&
    heartValue > 0 &&
    heartConfidenceValue !== 'none';

  const isFallDataFresh =
    !!fallTimestampForDisplay && now - fallTimestampForDisplay.getTime() <= FALL_FRESHNESS_MS;

  const hasPreviousFallEventFromApi = !!latestFallEventTimestampFromApi;
  const shouldShowHomeLoadingOverlay = !displayElder && !stableElderInfo;

  const rawShouldShowFallSuspected = false;

  const rawShouldShowFallAlert =
    !shouldShowDashboardSync &&
    !showEventTransitionFallback &&
    effectiveFallStatusForDisplay === 'FALL' &&
    isFallDataFresh;

  const rawShouldShowStaleFall =
    !shouldShowDashboardSync &&
    !showEventTransitionFallback &&
    !isDeviceOnlineForDisplay &&
    ((effectiveFallStatusForDisplay === 'FALL' && !isFallDataFresh && !!fallTimestampForDisplay) ||
      (effectiveFallStatusForDisplay !== 'FALL' && hasPreviousFallEventFromApi));

  const rawShouldShowFallDetailAction =
    !showEventTransitionFallback && (rawShouldShowFallAlert || rawShouldShowStaleFall);

  const latestDeviceActivity = deviceLastOnlineAt;

  const rawLastUpdatedAt =
    rawShouldShowStaleFall && latestFallEventTimestampFromApi
      ? latestFallEventTimestampFromApi
      : rawShouldShowFallAlert || effectiveFallStatusForDisplay === 'FALL'
        ? fallTimestampForDisplay
        : latestDeviceActivity;

  const rawFallDisplayLabel = rawShouldShowFallAlert
    ? 'ตรวจพบการหกล้ม'
    : rawShouldShowStaleFall
      ? 'เหตุการณ์ที่ผ่านมา'
      : isDeviceOnlineForDisplay
        ? 'ปกติ'
        : 'ยังไม่มีข้อมูลเหตุการณ์';

  // หลัง caregiver รับทราบแล้ว ไม่ควรใช้ snapshot เก่าที่เคยแสดง fall alert
  const shouldBypassFallSnapshotAfterAcknowledge =
    !!manualAcknowledgedAt &&
    effectiveFallStatusForDisplay !== 'FALL' &&
    fallCardSnapshot?.shouldShowFallAlert === true;

  // ถ้า API ยืนยันแล้วว่าไม่มี fall event ให้เลิกใช้ snapshot เหตุการณ์เก่า
  const shouldBypassFallSnapshotWhenNoFallEvidence =
    hasFetchedInitialEvents && effectiveFallStatusForDisplay !== 'FALL' && !latestFallEventFromApi;

  // ใช้ snapshot เฉพาะช่วง dashboard sync/connecting เพื่อกันการ์ดกระพริบ
  // ช่วงปกติให้ยึด raw state ทันที เพื่อให้สถานะล่าสุดไม่ค้าง
  const shouldUseFallSnapshotForDisplay =
    shouldShowDashboardSync || shouldShowConnecting || !hasFetchedInitialEvents;

  const fallbackFallSnapshot =
    shouldUseFallSnapshotForDisplay &&
    !shouldBypassFallSnapshotAfterAcknowledge &&
    !shouldBypassFallSnapshotWhenNoFallEvidence
      ? fallCardSnapshot
      : null;

  const shouldShowFallSuspected =
    fallbackFallSnapshot?.shouldShowFallSuspected ?? rawShouldShowFallSuspected;

  const shouldShowFallAlert = fallbackFallSnapshot?.shouldShowFallAlert ?? rawShouldShowFallAlert;

  const shouldShowStaleFall = fallbackFallSnapshot?.shouldShowStaleFall ?? rawShouldShowStaleFall;

  const shouldShowFallDetailAction =
    fallbackFallSnapshot?.shouldShowFallDetailAction ?? rawShouldShowFallDetailAction;

  const fallDisplayLabel = fallbackFallSnapshot?.fallDisplayLabel ?? rawFallDisplayLabel;
  const lastUpdatedAt = fallbackFallSnapshot?.lastUpdatedAt ?? rawLastUpdatedAt;

  useEffect(() => {
    if (shouldShowDashboardSync || shouldShowConnecting || !hasFetchedInitialEvents) return;

    const nextSnapshot = {
      shouldShowFallSuspected: rawShouldShowFallSuspected,
      shouldShowFallAlert: rawShouldShowFallAlert,
      shouldShowStaleFall: rawShouldShowStaleFall,
      shouldShowFallDetailAction: rawShouldShowFallDetailAction,
      fallDisplayLabel: rawFallDisplayLabel,
      lastUpdatedAt: rawLastUpdatedAt ?? null,
    };

    const currentSnapshotTime = fallCardSnapshot?.lastUpdatedAt?.getTime() ?? null;
    const nextSnapshotTime = nextSnapshot.lastUpdatedAt?.getTime() ?? null;

    const hasChanged =
      !fallCardSnapshot ||
      fallCardSnapshot.shouldShowFallSuspected !== nextSnapshot.shouldShowFallSuspected ||
      fallCardSnapshot.shouldShowFallAlert !== nextSnapshot.shouldShowFallAlert ||
      fallCardSnapshot.shouldShowStaleFall !== nextSnapshot.shouldShowStaleFall ||
      fallCardSnapshot.shouldShowFallDetailAction !== nextSnapshot.shouldShowFallDetailAction ||
      fallCardSnapshot.fallDisplayLabel !== nextSnapshot.fallDisplayLabel ||
      currentSnapshotTime !== nextSnapshotTime;

    if (hasChanged) {
      // ตรึงผลการ์ดเหตุการณ์ล่าสุดไว้ใช้ระหว่าง refresh หรือช่วง connecting รอบถัดไป
      deferStateUpdate(() => setFallCardSnapshot(nextSnapshot));
    }
  }, [
    shouldShowDashboardSync,
    shouldShowConnecting,
    hasFetchedInitialEvents,
    rawShouldShowFallSuspected,
    rawShouldShowFallAlert,
    rawShouldShowStaleFall,
    rawShouldShowFallDetailAction,
    rawFallDisplayLabel,
    rawLastUpdatedAt,
    fallCardSnapshot,
  ]);

  useEffect(() => {
    if (!manualAcknowledgedAt) return;

    // เมื่อ caregiver กด “รับทราบแล้ว” ให้เวลาแสดงสถานะอัปเดตเป็นเวลาปัจจุบัน
    deferStateUpdate(() => setStableStatusTimestamp(new Date()));
  }, [manualAcknowledgedAt]);

  useEffect(() => {
    const currentOnlineStatus = isDeviceOnlineForDisplay;
    const hasFallEvent =
      rawShouldShowFallAlert || rawShouldShowFallSuspected || rawShouldShowStaleFall;

    const shouldUpdateTimestamp =
      hasFallEvent ||
      stableStatusTimestamp === null ||
      (prevOnlineStatus !== null && prevOnlineStatus !== currentOnlineStatus);

    // ถ้าเพิ่ง acknowledge ไปแล้ว ไม่ให้ online status มา override เวลา
    const recentlyAcknowledged =
      manualAcknowledgedAt &&
      stableStatusTimestamp &&
      stableStatusTimestamp.getTime() >= manualAcknowledgedAt.getTime();

    if (prevOnlineStatus !== currentOnlineStatus) {
      deferStateUpdate(() => setPrevOnlineStatus(currentOnlineStatus));

      if (shouldUpdateTimestamp && !recentlyAcknowledged) {
        deferStateUpdate(() => setStableStatusTimestamp(new Date()));
      }

      return;
    }

    if (shouldUpdateTimestamp && stableStatusTimestamp === null) {
      deferStateUpdate(() => setStableStatusTimestamp(new Date()));
    }
  }, [
    isDeviceOnlineForDisplay,
    rawShouldShowFallAlert,
    rawShouldShowFallSuspected,
    rawShouldShowStaleFall,
    stableStatusTimestamp,
    prevOnlineStatus,
    manualAcknowledgedAt,
  ]);

  const shouldUseAcknowledgedTimestamp =
    !!manualAcknowledgedAt && effectiveFallStatusForDisplay !== 'FALL';

  const stableLastUpdatedAt = shouldUseAcknowledgedTimestamp
    ? manualAcknowledgedAt
    : stableStatusTimestamp;

  return {
    displayElder,
    displaySignals,
    shouldShowConnecting,
    shouldShowDashboardSync,
    showEventTransitionFallback,
    isDeviceCardDisabled,
    isDeviceOnlineForDisplay,
    heartValue,
    shouldShowHeartRate,
    shouldShowHomeLoadingOverlay,
    shouldShowFallSuspected,
    shouldShowFallAlert,
    shouldShowStaleFall,
    shouldShowFallDetailAction,
    fallDisplayLabel,
    lastUpdatedAt,
    stableLastUpdatedAt,
  };
}
