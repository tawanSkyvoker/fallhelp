/**
 * Dashboard Screen
 *
 * หน้านี้เป็นหน้าหลักของแอป
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลผู้สูงอายุ โปรไฟล์ผู้ใช้ เหตุการณ์ล่าสุด และยอดแจ้งเตือน
 * - อ่านสถานะ realtime จาก sensor store และ fall alert store
 * - ตรึงข้อมูลบางส่วนไว้ชั่วคราว เพื่อลดอาการหน้ากระพริบตอน refetch
 * - แสดงสถานะอุปกรณ์ ชีพจร และเหตุการณ์ล้ม
 * - กดเข้าเมนูย่อย เช่น ข้อมูลผู้สูงอายุ อุปกรณ์ แจ้งเตือน และโทรฉุกเฉิน
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  LayoutChangeEvent,
  Dimensions,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { MaterialSymbol } from '../../components/MaterialSymbol';
import { MaterialIconSolid } from '../../components/MaterialIconSolid';
import { useIsFocused } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import KanitText from '../../components/KanitText';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { NotificationModal } from '../../components/NotificationModal';
import { AppModalCard } from '../../components/AppModalCard';
import { Bounceable } from '../../components/Bounceable';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';
import {
  DashboardAvatarSkeleton,
  DashboardEmergencyButtonSkeleton,
  DashboardEventCardSkeleton,
  DashboardHeaderProfileSkeleton,
  DashboardDeviceCardSkeleton,
  DashboardHeartRateCardSkeleton,
} from '../../components/skeletons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { showDialog } from '../../utils/dialogService';
import { showSuccessToast } from '../../utils/toast';
import { safeRouter as router } from '../../utils/safeRouter';
import { formatThaiBuddhistDateTime, parseBirthDate } from '../../utils/date';
import { getHrStatus } from '../../utils/heartRate';
import { getProfile } from '../../services/userService';
import { listEvents } from '../../services/eventService';
import { listContacts } from '../../services/emergencyContactService';
import { getUnreadCount } from '../../services/notificationService';
import Logger from '../../utils/logger';

import { useSensorStore } from '../../store/useSensorStore';
import { useFallAlertStore } from '../../store/useFallAlertStore';
import { useDeviceSetupStore } from '../../store/useDeviceSetupStore';
import { useAuth } from '../../context/AuthContext';

import { useCurrentElder } from '../../hooks/useCurrentElder';
import { queryKeys } from '../../hooks/queryKeys';
import { useHomeDisplayState } from '../../hooks/useHomeDisplayState';

import type { RealtimeHeartConfidence } from '../../store/useSensorStore';
import type { RealtimeFallStatus } from '../../store/useFallAlertStore';
import type { Elder, Event } from '../../services/types';

// Snapshot สำหรับตรึงค่าสัญญาณไว้ระหว่างรีเฟรชข้อมูล
// ช่วยลดอาการ UI กระพริบตอน API หรือ socket กำลังอัปเดต
type DashboardSignalSnapshot = {
  isConnected: boolean;
  socketConnected: boolean;
  fallStatus: RealtimeFallStatus;
  lastFallUpdate: Date | null;
  heartRate: number | null;
  heartConfidence: RealtimeHeartConfidence;
  lastHeartUpdate: Date | null;
  lastStatusUpdate: Date | null;
};

type PressTimeoutRef = React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
type PressLockRef = React.MutableRefObject<boolean>;

// เก็บ eventId ที่ caregiver กด "รับทราบแล้ว"
// อันนี้เป็นสถานะฝั่งแอป ไม่ใช่การ cancel เหตุการณ์ในระบบ
const ACKNOWLEDGED_FALL_KEY = 'fallhelp:acknowledged_fall_event_id';

// เลื่อน setState ไป tick ถัดไป
// ใช้ลดอาการกระตุกเมื่อมีหลาย state update พร้อมกัน
const deferStateUpdate = (updater: () => void): void => {
  setTimeout(updater, 0);
};

// ล้าง timeout ของปุ่มที่มีระบบ lock
const clearPressTimeout = (timeoutRef: PressTimeoutRef): void => {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
};

// ปลดล็อกปุ่ม และล้าง timeout ที่เกี่ยวข้อง
const resetPressLock = (lockRef: PressLockRef, timeoutRef: PressTimeoutRef): void => {
  lockRef.current = false;
  clearPressTimeout(timeoutRef);
};

// ตั้งเวลาปลดล็อกปุ่มอัตโนมัติ
// ใช้กันผู้ใช้กดปุ่มรัวแล้วเปิดหน้าซ้ำ
const armPressLockRelease = (
  lockRef: PressLockRef,
  timeoutRef: PressTimeoutRef,
  delayMs: number,
): void => {
  clearPressTimeout(timeoutRef);
  timeoutRef.current = setTimeout(() => {
    lockRef.current = false;
    timeoutRef.current = null;
  }, delayMs);
};

// เช็กว่า event ล้มนี้ยัง active อยู่หรือไม่
const isActiveFallStage = (event: Event): boolean =>
  (event.fallStage === 'PENDING_CONFIRMATION' || event.fallStage === 'CONFIRMED') &&
  !event.cancelledAt;

// หา event ล้มล่าสุดที่ยัง active
const pickLatestActiveFallEvent = (events: Event[] | null | undefined): Event | null => {
  if (!events || events.length === 0) return null;

  const activeEvents = events.filter((event) => isActiveFallStage(event));
  if (activeEvents.length === 0) return null;

  return activeEvents.reduce((latest, current) => {
    const latestTime = new Date(latest.timestamp).getTime();
    const currentTime = new Date(current.timestamp).getTime();

    if (Number.isNaN(currentTime)) return latest;
    if (Number.isNaN(latestTime)) return current;

    return currentTime > latestTime ? current : latest;
  });
};

// หา event ล้มที่ timestamp ตรงกับข้อมูล realtime
const findActiveFallEventByExactTimestamp = (
  events: Event[] | null | undefined,
  targetTimestamp: Date | null,
): Event | null => {
  if (!events || events.length === 0 || !targetTimestamp) return null;

  const targetTime = targetTimestamp.getTime();
  if (Number.isNaN(targetTime)) return null;

  const activeEvents = events.filter((event) => isActiveFallStage(event));
  if (activeEvents.length === 0) return null;

  return (
    activeEvents.find((event) => {
      const eventTime = new Date(event.timestamp).getTime();

      return !Number.isNaN(eventTime) && eventTime === targetTime;
    }) ?? null
  );
};

// คำนวณอายุจากวันเกิด
const calculateAge = (dateOfBirth: string | Date | undefined): number => {
  if (!dateOfBirth) return 0;

  const today = new Date();
  const birthDate = parseBirthDate(dateOfBirth);
  const birthYear = birthDate.getFullYear();
  const currentYear = today.getFullYear();

  let age = currentYear - birthYear;
  const m = today.getMonth() - birthDate.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age < 0 ? 0 : age;
};

// แปลงเวลาเป็นรูปแบบไทย
const formatTime = (date: Date | null): string => {
  if (!date) return '--';

  return formatThaiBuddhistDateTime(date);
};

export default function DashboardScreen() {
  // ใช้จัดการ cache ของ React Query
  const queryClient = useQueryClient();

  // ใช้เช็กสถานะ login และสถานะว่า dashboard กำลังแสดงอยู่หรือไม่
  const { isSignedIn } = useAuth();
  const isFocused = useIsFocused();

  // State สำหรับ UI ทั่วไป
  const [imageError, setImageError] = useState(false);
  const [lastProfileImage, setLastProfileImage] = useState<string | null | undefined>(undefined);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFallDetail, setShowFallDetail] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // State สำหรับตรึงข้อมูลเดิมระหว่างโหลดข้อมูลใหม่
  const [stableElderInfo, setStableElderInfo] = useState<Elder | null>(null);
  const [manualAcknowledgedAt, setManualAcknowledgedAt] = useState<Date | null>(null);
  const [screenEnterAt, setScreenEnterAt] = useState<number>(() => Date.now());
  const [clockNow, setClockNow] = useState<number>(() => Date.now());
  const [emergencyButtonHeight, setEmergencyButtonHeight] = useState(0);
  const [firstSocketConnectedAt, setFirstSocketConnectedAt] = useState<number | null>(null);
  const [stableSignals, setStableSignals] = useState<DashboardSignalSnapshot | null>(null);

  // Ref สำหรับกันกดปุ่มซ้ำ และเก็บค่าล่าสุดให้ effect ใช้อ่าน
  const deviceCardPressLockRef = useRef(false);
  const deviceCardPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elderCardPressLockRef = useRef(false);
  const elderCardPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profilePressLockRef = useRef(false);
  const profilePressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectedRef = useRef(false);
  const elderIdRef = useRef<string | undefined>(undefined);
  const hasStableSnapshotRef = useRef(false);

  // คำนวณ safe area และ navigation bar เพื่อจัด layout ให้ไม่โดนบัง
  const { top, bottom } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;

  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const androidNavBarHeight =
    Platform.OS === 'android' ? Math.max(0, screenHeight - windowHeight - statusBarHeight) : 0;
  const hasSystemNavBar = bottom > 0 || androidNavBarHeight > 0;

  const emergencyGap = hasSystemNavBar ? 0 : 16;
  const emergencyContentPadding =
    emergencyButtonHeight > 0 ? emergencyButtonHeight + emergencyGap : 96 + emergencyGap;

  const elderCardSpacingClass = hasSystemNavBar ? 'mt-0 mb-6' : 'mt-0 mb-4';
  const elderCardPaddingClass = hasSystemNavBar ? 'p-4' : 'p-6';
  const elderAvatarSizeClass = hasSystemNavBar ? 'w-14 h-14' : 'w-16 h-16';
  const elderNameSizeClass = hasSystemNavBar ? 'text-lg' : 'text-xl';
  const elderRowGapClass = 'gap-5';

  // อ่านสถานะ sensor จาก realtime store
  const {
    isConnected,
    socketConnected: _socketConnected,
    wasEverConnected: _wasEverConnected,
    heartRate,
    heartConfidence: _heartConfidence,
    lastHeartUpdate: _lastHeartUpdate,
    lastStatusUpdate,
    setIsConnected: _setIsConnected,
  } = useSensorStore();

  // อ่านสถานะเหตุการณ์ล้มจาก fall alert store
  const fallStatus = useFallAlertStore((s) => s.fallStatus);
  const lastFallUpdate = useFallAlertStore((s) => s.lastFallUpdate);
  const activeFallEventId = useFallAlertStore((s) => s.activeFallEventId);
  const activeFallBpm = useFallAlertStore((s) => s.activeFallBpm);
  const setFallStatus = useFallAlertStore((s) => s.setFallStatus);
  const setLastFallUpdate = useFallAlertStore((s) => s.setLastFallUpdate);
  const setActiveFallEventId = useFallAlertStore((s) => s.setActiveFallEventId);
  const setActiveFallBpm = useFallAlertStore((s) => s.setActiveFallBpm);

  // โหลดข้อมูลผู้สูงอายุปัจจุบัน
  const { data: elderInfo, refetch: refetchElder } = useCurrentElder({
    enabled: isSignedIn,
    staleTime: 0,
    refetchInterval: isSignedIn && isFocused && !_socketConnected ? 3_000 : false,
  });

  const activeDeviceId = elderInfo?.device?.id ?? stableElderInfo?.device?.id;
  const elderId = elderInfo?.id ?? stableElderInfo?.id;

  // โหลดโปรไฟล์ผู้ใช้
  const { data: userProfile, refetch: _refetchUserProfile } = useQuery({
    queryKey: queryKeys.userProfile(),

    // ไฟล์ถัดไป: services/userService.ts
    queryFn: getProfile,

    enabled: isSignedIn && isFocused,
  });

  // โหลดเบอร์ติดต่อฉุกเฉินเพื่อกำหนดสถานะปุ่มโทรฉุกเฉิน
  // isFetched ต้องเป็น true ก่อน dashboard จึงจะแสดงผล เพื่อกันปุ่มกระพริบระหว่าง SETUP และ STANDBY
  const {
    data: contacts = [],
    isFetched: contactsFetched,
    isError: contactsIsError,
  } = useQuery({
    queryKey: queryKeys.emergencyContacts(elderId),
    queryFn: () => listContacts(elderId!),
    enabled: !!elderId && isSignedIn,
    staleTime: 0,
  });

  useEffect(() => {
    if (userProfile?.profileImage === lastProfileImage) return;

    // เมื่อรูปโปรไฟล์เปลี่ยน ให้ reset error เพื่อให้รูปใหม่มีโอกาสโหลด
    deferStateUpdate(() => {
      setLastProfileImage(userProfile?.profileImage);
      setImageError(false);
    });
  }, [userProfile?.profileImage, lastProfileImage]);

  useEffect(() => {
    if (!elderInfo || elderInfo === stableElderInfo) return;

    // เก็บ elderInfo ล่าสุดไว้เป็น snapshot
    // ถ้า refetch แล้วข้อมูลยังไม่พร้อม หน้าจอยังใช้ค่าชุดนี้แสดงได้
    deferStateUpdate(() => setStableElderInfo(elderInfo));
  }, [elderInfo, stableElderInfo]);

  useEffect(() => {
    if (isTransitioning || !elderInfo) return;

    // รวมสัญญาณ realtime ชุดล่าสุดไว้เป็น snapshot
    const nextSignals = {
      isConnected,
      socketConnected: _socketConnected,
      fallStatus,
      lastFallUpdate,
      heartRate,
      heartConfidence: _heartConfidence,
      lastHeartUpdate: _lastHeartUpdate,
      lastStatusUpdate,
    };

    const hasChanged =
      !stableSignals ||
      stableSignals.isConnected !== nextSignals.isConnected ||
      stableSignals.socketConnected !== nextSignals.socketConnected ||
      stableSignals.fallStatus !== nextSignals.fallStatus ||
      stableSignals.lastFallUpdate !== nextSignals.lastFallUpdate ||
      stableSignals.heartRate !== nextSignals.heartRate ||
      stableSignals.heartConfidence !== nextSignals.heartConfidence ||
      stableSignals.lastHeartUpdate !== nextSignals.lastHeartUpdate ||
      stableSignals.lastStatusUpdate !== nextSignals.lastStatusUpdate;

    if (hasChanged) {
      deferStateUpdate(() => setStableSignals(nextSignals));
    }
  }, [
    isTransitioning,
    elderInfo,
    isConnected,
    _socketConnected,
    fallStatus,
    lastFallUpdate,
    heartRate,
    _heartConfidence,
    _lastHeartUpdate,
    lastStatusUpdate,
    stableSignals,
  ]);

  useEffect(() => {
    // นาฬิกาในหน้า dashboard
    // ใช้คำนวณว่าข้อมูล realtime ล่าสุดเก่าแค่ไหน
    const timer = setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // sync ค่า connected ล่าสุดไว้ใน ref
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    // sync elderId ล่าสุดไว้ใน ref
    elderIdRef.current = elderInfo?.id;
  }, [elderInfo?.id]);

  useEffect(() => {
    // ใช้บอกว่าเคยมี snapshot แล้วหรือยัง
    hasStableSnapshotRef.current = Boolean(stableSignals || stableElderInfo);
  }, [stableSignals, stableElderInfo]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const hasStableSnapshot = hasStableSnapshotRef.current;

      // ปลดล็อกปุ่มทุกครั้งที่กลับมาหน้านี้
      resetPressLock(deviceCardPressLockRef, deviceCardPressTimeoutRef);
      resetPressLock(elderCardPressLockRef, elderCardPressTimeoutRef);
      resetPressLock(profilePressLockRef, profilePressTimeoutRef);

      if (hasStableSnapshot) {
        setIsTransitioning(true);
      }

      setImageError(false);

      // refresh ข้อมูลสำคัญของ dashboard
      queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });

      if (elderIdRef.current) {
        // invalidate contacts เพื่อให้ emergencyButtonState อัปเดตเมื่อกลับจากหน้าจัดการเบอร์ฉุกเฉิน
        queryClient.invalidateQueries({
          queryKey: queryKeys.emergencyContacts(elderIdRef.current),
        });
      }

      if (!isConnectedRef.current && elderIdRef.current) {
        queryClient.invalidateQueries({ queryKey: queryKeys.initialEvents(elderIdRef.current) });
      }

      const refetchTasks = [
        refetchElder(),
        queryClient.refetchQueries({ queryKey: queryKeys.userProfile() }),
        queryClient.refetchQueries({ queryKey: queryKeys.unreadCount() }),
      ];

      if (elderIdRef.current) {
        // refetch contacts เป็นส่วนหนึ่งของ transition เพื่อให้ isTransitioning รอจนกว่าจะโหลดเสร็จ
        refetchTasks.push(
          queryClient.refetchQueries({ queryKey: queryKeys.emergencyContacts(elderIdRef.current) }),
        );
      }

      if (!isConnectedRef.current && elderIdRef.current) {
        refetchTasks.push(
          queryClient.refetchQueries({ queryKey: queryKeys.initialEvents(elderIdRef.current) }),
        );
      }

      void Promise.allSettled(refetchTasks).finally(() => {
        if (isActive) {
          setIsTransitioning(false);
        }
      });

      return () => {
        isActive = false;
      };
    }, [queryClient, refetchElder]),
  );

  useEffect(() => {
    if (_socketConnected) {
      // จดเวลาที่ socket ต่อสำเร็จครั้งแรก
      // ใช้ให้หน้า dashboard รอข้อมูลนิ่งก่อนแสดงผลจริง
      deferStateUpdate(() =>
        setFirstSocketConnectedAt((prev) => (prev === null ? Date.now() : prev)),
      );
      return;
    }

    deferStateUpdate(() => setFirstSocketConnectedAt(null));
  }, [_socketConnected]);

  useEffect(() => {
    // ถ้าเปลี่ยนอุปกรณ์ ให้ reset เวลาเชื่อมต่อ socket
    deferStateUpdate(() => setFirstSocketConnectedAt(null));
  }, [activeDeviceId]);

  useEffect(() => {
    // จดเวลาเข้าหน้าจอใหม่เมื่อเปลี่ยนอุปกรณ์
    deferStateUpdate(() => setScreenEnterAt(Date.now()));
  }, [activeDeviceId]);

  // โหลดเหตุการณ์ล่าสุดของผู้สูงอายุ
  const { data: initialEvents, isFetched: hasFetchedInitialEvents } = useQuery({
    queryKey: queryKeys.initialEvents(elderInfo?.id),
    queryFn: async () => {
      if (!elderInfo?.id) return null;

      // ไฟล์ถัดไป: services/eventService.ts
      const response = await listEvents({
        elderId: elderInfo.id,
        limit: 20,
        page: 1,
      });

      return response.data || [];
    },
    enabled: !!elderInfo?.id && isFocused,
    staleTime: 0,
  });

  // โหลดจำนวนแจ้งเตือนที่ยังไม่ได้อ่าน
  const { data: unreadCount = 0 } = useQuery({
    queryKey: queryKeys.unreadCount(),
    queryFn: async () => {
      try {
        // ไฟล์ถัดไป: services/notificationService.ts
        const count = await getUnreadCount();

        return count ?? 0;
      } catch (error) {
        Logger.warn('Failed to fetch unread count:', error);
        return 0;
      }
    },
    enabled: isSignedIn && isFocused,
    refetchInterval: isFocused ? 60000 : false,
    retry: 1,
    staleTime: 30000,
  });

  useEffect(() => {
    if (elderInfo?.id && elderInfo?.device?.id) {
      // ตั้งค่า elder/device ให้ realtime store รู้ว่าต้องติดตามอุปกรณ์ตัวไหน
      useDeviceSetupStore.getState().setElderConfig(elderInfo.id, elderInfo.device.id);
    }
  }, [elderInfo?.id, elderInfo?.device?.id]);

  const lastOnlineStr = String(elderInfo?.device?.lastOnline);
  const lastFallUpdateTime = lastFallUpdate?.getTime();

  useEffect(() => {
    const sync = async () => {
      if (!initialEvents || !isSignedIn) return;

      if (initialEvents.length === 0) {
        // ไม่มี event ล่าสุด ให้ reset สถานะล้มเป็นปกติ
        setFallStatus('NORMAL');
        setLastFallUpdate(null);
        setActiveFallEventId(null);
        return;
      }

      // หา event ล้มล่าสุดที่ยืนยันแล้ว
      const latestFall = initialEvents.find((e) => e.fallStage === 'CONFIRMED');

      if (latestFall) {
        const eventTime = new Date(latestFall.timestamp).getTime();
        const contextTime = lastFallUpdate ? lastFallUpdate.getTime() : 0;
        const acknowledgedId = await AsyncStorage.getItem(ACKNOWLEDGED_FALL_KEY);
        const isAcknowledged = acknowledgedId === latestFall.id;
        const isCancelled = !!latestFall.cancelledAt;

        if (eventTime > contextTime) {
          Logger.debug('[Dashboard] Syncing newer Fall from API', {
            api: eventTime,
            ctx: contextTime,
          });

          // ถ้า API มี event ใหม่กว่า store ให้ sync กลับเข้า fall alert store
          setLastFallUpdate(new Date(latestFall.timestamp));
          setFallStatus(isCancelled || isAcknowledged ? 'NORMAL' : 'FALL');
        }

        if (isCancelled || isAcknowledged) {
          setActiveFallEventId(null);
        } else if (eventTime > contextTime) {
          setActiveFallEventId(latestFall.id);
        }
      }
    };

    void sync();
  }, [
    isSignedIn,
    initialEvents?.length,
    initialEvents,
    lastOnlineStr,
    setFallStatus,
    setLastFallUpdate,
    setActiveFallEventId,
    lastFallUpdate,
    lastFallUpdateTime,
  ]);

  const emergencyPressLockRef = useRef(false);
  const emergencyPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAcknowledge = async () => {
    if (!activeFallEventId && fallStatus === 'FALL') {
      showDialog(
        'ยืนยันเหตุการณ์',
        'ผู้สูงอายุปลอดภัยดีแล้วใช่หรือไม่?\n\nแอปจะกลับสู่หน้าจอปกติ',
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'ยืนยัน, ปลอดภัยแล้ว',
            style: 'confirm',
            onPress: () => {
              // ไม่มี activeFallEventId แต่ยังอยู่สถานะ FALL
              // จึง reset เฉพาะ state ในแอป
              setFallStatus('NORMAL');
              setActiveFallEventId(null);
              setActiveFallBpm(undefined);
            },
          },
        ],
      );
      return;
    }

    if (!activeFallEventId) return;

    showDialog('ยืนยันเหตุการณ์', 'ผู้สูงอายุปลอดภัยดีแล้วใช่หรือไม่?\n\nแอปจะกลับสู่หน้าจอปกติ', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน, ปลอดภัยแล้ว',
        style: 'confirm',
        onPress: () => {
          const acknowledgedAt = new Date();

          if (activeFallEventId) {
            // บันทึกว่า event นี้ caregiver รับทราบแล้ว
            // เพื่อไม่ให้กลับมาแสดงเป็น alert ซ้ำในฝั่งแอป
            void AsyncStorage.setItem(ACKNOWLEDGED_FALL_KEY, activeFallEventId);
          }

          setFallStatus('NORMAL');
          setLastFallUpdate(acknowledgedAt);
          setActiveFallEventId(null);
          setActiveFallBpm(undefined);
          setManualAcknowledgedAt(acknowledgedAt);
          showSuccessToast('รับทราบเหตุการณ์แล้ว');
        },
      },
    ]);
  };

  useEffect(() => {
    return () => {
      // ออกจาก dashboard แล้วล้าง timeout ของปุ่มทั้งหมด
      clearPressTimeout(emergencyPressTimeoutRef);
      clearPressTimeout(deviceCardPressTimeoutRef);
      clearPressTimeout(elderCardPressTimeoutRef);
      clearPressTimeout(profilePressTimeoutRef);
    };
  }, []);

  // ไปหน้าโทรฉุกเฉินพร้อม prefetch รายชื่อ — ใช้ร่วมกันทั้ง EMERGENCY และ STANDBY (หลัง confirm)
  const goToEmergencyCall = () => {
    const prefetchElderId = elderInfo?.id ?? stableElderInfo?.id;

    if (prefetchElderId) {
      // โหลดรายชื่อฉุกเฉินล่วงหน้า ก่อนเข้า call screen
      // ไฟล์ถัดไป: services/emergencyContactService.ts
      void queryClient.prefetchQuery({
        queryKey: queryKeys.emergencyContacts(prefetchElderId),
        queryFn: () => listContacts(prefetchElderId),
        staleTime: 30_000,
      });
    }

    router.push('/(features)/(emergency)/call');
  };

  const handleEmergencyPress = (state: EmergencyButtonState) => {
    if (state === 'SETUP') {
      // Priority 2: ยังไม่ได้เพิ่มเบอร์ฉุกเฉิน พาไปหน้า call screen ก่อน
      // เพื่อให้สามารถกดโทร 1669 หรือ โทรหาผู้สูงอายุ ได้ทันทีหากเกิดเหตุ
      if (emergencyPressLockRef.current) return;
      emergencyPressLockRef.current = true;
      goToEmergencyCall();
      armPressLockRelease(emergencyPressLockRef, emergencyPressTimeoutRef, 1000);
      return;
    }

    if (state === 'STANDBY') {
      // Priority 3: ถาม Confirmation ก่อนโทร เพื่อป้องกันการกดผิด
      // ไม่ใช้ press lock เพราะ dialog เป็นตัวป้องกันการกดซ้ำอยู่แล้ว
      showDialog('ยืนยันการโทรฉุกเฉิน', 'คุณต้องการโทรหาผู้ติดต่อฉุกเฉินใช่ไหม?', [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'โทรเลย', style: 'confirm', onPress: goToEmergencyCall },
      ]);
      return;
    }

    // Priority 1: EMERGENCY — ไปทันทีโดยไม่มี dialog เพราะทุกวินาทีมีค่า
    if (emergencyPressLockRef.current) return;
    emergencyPressLockRef.current = true;
    goToEmergencyCall();
    armPressLockRelease(emergencyPressLockRef, emergencyPressTimeoutRef, 1000);
  };

  const handleFallDetailPress = () => {
    // เปิด modal รายละเอียดเหตุการณ์ล้ม
    setShowFallDetail(true);
  };

  const handleProfilePress = () => {
    if (profilePressLockRef.current) return;
    profilePressLockRef.current = true;
    router.push('/(features)/(profile)/profile-info');
    armPressLockRelease(profilePressLockRef, profilePressTimeoutRef, 2000);
  };

  const handleDeviceCardPress = () => {
    if (deviceCardPressLockRef.current) return;

    deviceCardPressLockRef.current = true;

    // ไปหน้ารายละเอียดอุปกรณ์
    router.push('/(features)/(device)/device-info');

    armPressLockRelease(deviceCardPressLockRef, deviceCardPressTimeoutRef, 2000);
  };

  const handleElderCardPress = () => {
    if (elderCardPressLockRef.current) return;

    elderCardPressLockRef.current = true;

    // ไปหน้าข้อมูลผู้สูงอายุ
    router.push('/(features)/(elder)/elder-info');

    armPressLockRelease(elderCardPressLockRef, elderCardPressTimeoutRef, 2000);
  };

  const handleEmergencyLayout = (event: LayoutChangeEvent) => {
    // วัดความสูงปุ่มฉุกเฉินด้านล่าง
    // แล้วเอาไปดัน content ไม่ให้ถูกปุ่มบัง
    const nextHeight = Math.round(event.nativeEvent.layout.height);

    setEmergencyButtonHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  };

  // รวม state หลายแหล่ง แล้วให้ hook คำนวณค่าที่ควรใช้แสดงผลจริง
  const {
    displayElder,
    displaySignals,
    shouldShowDashboardSync,
    showEventTransitionFallback,
    isDeviceCardDisabled,
    isDeviceOnlineForDisplay,
    heartValue,
    shouldShowHeartRate,
    shouldShowFallAlert,
    shouldShowStaleFall,
    shouldShowFallDetailAction,
    fallDisplayLabel,
    lastUpdatedAt,
    stableLastUpdatedAt,
  } = useHomeDisplayState({
    now: clockNow,
    isTransitioning,
    elderInfo: elderInfo ?? null,
    stableElderInfo,
    stableSignals,
    isConnected,
    socketConnected: _socketConnected,
    fallStatus,
    lastFallUpdate,
    heartRate,
    heartConfidence: _heartConfidence,
    lastHeartUpdate: _lastHeartUpdate,
    lastStatusUpdate,
    manualAcknowledgedAt,
    activeFallEventId,
    initialEvents,
    hasFetchedInitialEvents,
    firstSocketConnectedAt,
    screenEnterAt,
  });

  // ปุ่มโทรฉุกเฉิน 3 สถานะ — เช็คจากบนลงล่าง (Priority 1 → 2 → 3)
  type EmergencyButtonState = 'EMERGENCY' | 'SETUP' | 'STANDBY';

  const emergencyButtonState = useMemo((): EmergencyButtonState => {
    // Priority 1: เซนเซอร์ตรวจพบการล้มและยังไม่รับทราบ
    if (shouldShowFallAlert) return 'EMERGENCY';
    // Priority 2: ยังไม่มีเบอร์ฉุกเฉิน (เช็คเฉพาะเมื่อ contacts โหลดสำเร็จแล้ว ไม่ใช่ Error)
    if (contactsFetched && !contactsIsError && contacts.length === 0) return 'SETUP';
    // Priority 3: พร้อมใช้งาน (default)
    return 'STANDBY';
  }, [shouldShowFallAlert, contactsFetched, contactsIsError, contacts.length]);

  // Skeleton เต็มหน้าจอใช้เฉพาะ cold load ที่ยังไม่มี elder snapshot
  // ส่วน profile, event และ contacts ให้แสดง skeleton รายจุด เพื่อให้ข้อมูลหลักขึ้นก่อน
  const isDashboardSyncing = shouldShowDashboardSync || showEventTransitionFallback;
  const isDashboardReady = !!displayElder || !!stableElderInfo;
  const shouldShowEventCardSkeleton =
    isDashboardSyncing && !shouldShowFallAlert && !shouldShowStaleFall;
  const shouldShowEmergencyButtonSkeleton =
    !!elderId && !contactsFetched && !contactsIsError && !shouldShowFallAlert;

  // หา event ล้มที่ใช้แสดงค่า BPM ตอนเกิดเหตุ
  const activeFallEventForHeartCard = useMemo(() => {
    if (!initialEvents || initialEvents.length === 0) return null;

    if (activeFallEventId) {
      const eventById = initialEvents.find((event) => event.id === activeFallEventId);
      if (eventById && isActiveFallStage(eventById)) return eventById;
      return null;
    }

    const eventByExactTimestamp = findActiveFallEventByExactTimestamp(
      initialEvents,
      displaySignals.lastFallUpdate,
    );

    if (eventByExactTimestamp) return eventByExactTimestamp;

    if (shouldShowFallAlert) return null;

    return pickLatestActiveFallEvent(initialEvents);
  }, [initialEvents, activeFallEventId, displaySignals.lastFallUpdate, shouldShowFallAlert]);

  // ถ้ากำลังแสดงเหตุล้ม ให้ใช้ BPM ตอนเกิดเหตุ
  // ถ้าไม่มีเหตุล้ม ให้ใช้ BPM สด
  const shouldShowEventHeartContext =
    shouldShowFallAlert && !shouldShowDashboardSync && !showEventTransitionFallback;
  const eventBpmFromCache =
    activeFallEventForHeartCard &&
    activeFallEventForHeartCard.fallStage === 'CONFIRMED' &&
    typeof activeFallEventForHeartCard.bpm === 'number' &&
    activeFallEventForHeartCard.bpm > 0
      ? Math.round(activeFallEventForHeartCard.bpm)
      : null;
  // undefined = ยังไม่ได้รับข้อมูล bpm จาก socket
  // null     = socket ส่งมาแล้วแต่ไม่มีข้อมูล bpm
  // number   = มีข้อมูล bpm (รวม 0 = ไม่พบสัญญาณ)
  const eventBpmFromSocket = typeof activeFallBpm === 'number' ? Math.round(activeFallBpm) : null;
  const hasReceivedSocketBpm = activeFallBpm !== undefined;
  const eventBpm = eventBpmFromCache ?? (shouldShowEventHeartContext ? eventBpmFromSocket : null);
  const isWaitingForEventData =
    shouldShowEventHeartContext && !activeFallEventForHeartCard && !hasReceivedSocketBpm;
  const heartRateDisplayValue = shouldShowEventHeartContext
    ? eventBpm !== null
      ? String(eventBpm)
      : '--'
    : shouldShowHeartRate
      ? String(heartValue)
      : '--';

  const isConfirmedButNoBpm =
    shouldShowEventHeartContext &&
    !!activeFallEventForHeartCard &&
    eventBpm === null &&
    !isWaitingForEventData;
  const currentBpmForStatus = shouldShowEventHeartContext
    ? eventBpm
    : shouldShowHeartRate
      ? heartValue
      : null;
  const hrStatus = currentBpmForStatus !== null ? getHrStatus(currentBpmForStatus) : null;

  const heartCardContextText = shouldShowEventHeartContext
    ? eventBpm !== null
      ? 'ชีพจรขณะหกล้ม'
      : isConfirmedButNoBpm
        ? 'ไม่มีข้อมูลชีพจรขณะล้ม'
        : isWaitingForEventData
          ? 'กำลังประมวลผลเหตุการณ์...'
          : 'ไม่มีข้อมูลชีพจรขณะล้ม'
    : shouldShowHeartRate
      ? 'ชีพจรปัจจุบัน (สด)'
      : null;

  // เตรียมข้อความและเวลาสำหรับ modal รายละเอียดเหตุการณ์
  const isHistoricalEventContext = !shouldShowFallAlert && shouldShowStaleFall;
  const eventDetailTitle = shouldShowFallAlert ? 'เหตุการณ์หกล้ม' : 'เหตุการณ์ที่ผ่านมา';
  const eventDetailHeadline = shouldShowFallAlert ? 'ตรวจพบเหตุการณ์หกล้ม' : 'เหตุการณ์ที่ผ่านมา';
  const eventDetailTimestamp = shouldShowFallAlert ? displaySignals.lastFallUpdate : lastUpdatedAt;
  const statusTimestampLabel = isHistoricalEventContext ? 'เหตุการณ์ล่าสุด' : 'สถานะล่าสุด';
  const statusTimestamp =
    shouldShowFallAlert || isHistoricalEventContext
      ? (lastUpdatedAt ?? stableLastUpdatedAt)
      : (stableLastUpdatedAt ?? lastUpdatedAt);
  const statusTimestampText = formatTime(statusTimestamp).replace(' น.', '\u00A0น.');
  const isNoEventStatus = !shouldShowFallAlert && !shouldShowStaleFall && !isDeviceOnlineForDisplay;

  return (
    <View className="flex-1 bg-white">
      <AppModalCard
        visible={showFallDetail}
        title={eventDetailTitle}
        onClose={() => setShowFallDetail(false)}
      >
        <View className="gap-4">
          {/* สรุปเหตุการณ์ใน modal */}
          <View
            className={`rounded-xl p-3 border ${shouldShowFallAlert ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-200'}`}
          >
            <View>
              <KanitText
                weight="regular"
                className={`${shouldShowFallAlert ? 'text-red-600' : 'text-gray-700'} text-base`}
              >
                {eventDetailHeadline}
              </KanitText>
            </View>

            <KanitText
              className={`${shouldShowFallAlert ? 'text-red-500' : 'text-gray-500'} text-sm mt-1`}
            >
              เวลา: {formatTime(eventDetailTimestamp)}
            </KanitText>
          </View>

          {/* คำแนะนำหลังเกิดเหตุ */}
          <View>
            <KanitText weight="regular" className="text-gray-900 text-sm mb-2">
              {shouldShowFallAlert ? 'คำแนะนำเมื่อเกิดเหตุ' : 'คำแนะนำเพิ่มเติม'}
            </KanitText>

            <View className="gap-2">
              <View className="flex-row items-start">
                <MaterialSymbol
                  name="fiber_manual_record"
                  size={8}
                  color="#6B7280"
                  style={{ marginTop: 5, marginRight: 8 }}
                />
                <KanitText className="text-gray-700 flex-1">
                  {shouldShowFallAlert
                    ? 'รีบเข้าตรวจสอบผู้สูงอายุว่ารู้สึกตัวและโต้ตอบได้ไหม'
                    : 'สังเกตอาการบาดเจ็บหรือมึนงงอย่างต่อเนื่อง'}
                </KanitText>
              </View>

              <View className="flex-row items-start">
                <MaterialSymbol
                  name="fiber_manual_record"
                  size={8}
                  color="#6B7280"
                  style={{ marginTop: 5, marginRight: 8 }}
                />
                <KanitText className="text-gray-700 flex-1">
                  {shouldShowFallAlert
                    ? 'หากพบบาดเจ็บหรือหมดสติ ให้กด “โทรฉุกเฉิน” ทันที'
                    : 'ตรวจสอบการสวมใส่อุปกรณ์และแบตเตอรี่เสมอ'}
                </KanitText>
              </View>

              <View className="flex-row items-start">
                <MaterialSymbol
                  name="fiber_manual_record"
                  size={8}
                  color="#6B7280"
                  style={{ marginTop: 5, marginRight: 8 }}
                />
                <KanitText className="text-gray-700 flex-1">
                  {shouldShowFallAlert
                    ? 'หากผู้สูงอายุปลอดภัยดีแล้ว ให้กดปุ่ม “รับทราบแล้ว”'
                    : 'กด “ดูประวัติ” ด้านล่าง เพื่อดูบันทึกเหตุการณ์ย้อนหลัง'}
                </KanitText>
              </View>
            </View>
          </View>

          <View className="flex-row gap-3">
            {shouldShowFallAlert ? (
              <Bounceable
                onPress={() => {
                  setShowFallDetail(false);
                  // ข้าม dialog เพราะผู้ใช้กำลังดูรายละเอียดเหตุล้มอยู่แล้ว
                  goToEmergencyCall();
                }}
                className="flex-1 bg-red-500 py-3 rounded-xl items-center"
                scale={0.96}
              >
                <KanitText weight="regular" className="text-white">
                  โทรฉุกเฉิน
                </KanitText>
              </Bounceable>
            ) : null}

            <Bounceable
              onPress={() => {
                setShowFallDetail(false);

                // ไปหน้าประวัติ พร้อม focus รายการล่าสุด
                router.push({ pathname: '/(tabs)/history', params: { focus: 'latest' } });
              }}
              className="flex-1 bg-gray-200 py-3 rounded-xl items-center"
              scale={0.96}
            >
              <KanitText weight="regular" className="text-gray-800">
                ดูประวัติ
              </KanitText>
            </Bounceable>
          </View>

          <Bounceable
            onPress={() => setShowFallDetail(false)}
            className="py-2 items-center"
            scale={0.98}
          >
            <KanitText className="text-gray-500 text-sm">ปิด</KanitText>
          </Bounceable>
        </View>
      </AppModalCard>

      {isDashboardReady ? (
        <ScreenWrapper
          edges={['left', 'right']}
          useScrollView={false}
          style={{ backgroundColor: '#FFFFFF', position: 'relative' }}
        >
          <NotificationModal
            visible={showNotifications}
            onClose={() => setShowNotifications(false)}
          />

          {/* Header dashboard */}
          <View
            style={{
              paddingTop: top + 12,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
            }}
            className="flex-row items-center justify-between pb-6 bg-white px-6 rounded-b-[32px] shadow-sm z-10 mb-2"
          >
            <View className="flex-1 mr-4">
              {userProfile ? (
                <>
                  <KanitText className="text-base text-gray-500">สวัสดี, คุณ</KanitText>
                  <KanitText weight="regular" className="text-2xl text-gray-800" numberOfLines={1}>
                    {userProfile.firstName} {userProfile.lastName}
                  </KanitText>
                </>
              ) : (
                <DashboardHeaderProfileSkeleton />
              )}
            </View>

            <View className="flex-row items-center gap-5">
              {/* เปิด modal แจ้งเตือน */}
              <Bounceable
                onPress={() => setShowNotifications(true)}
                className="p-1 relative"
                scale={0.9}
              >
                {unreadCount > 0 ? (
                  <MaterialIconSolid name="notifications" size={28} color="#374151" />
                ) : (
                  <MaterialSymbol name="notifications" size={28} color="#374151" />
                )}
                {unreadCount > 0 && (
                  <View className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                )}
              </Bounceable>

              {/* ไปหน้า profile info */}
              <Bounceable
                onPress={handleProfilePress}
                className="rounded-full overflow-hidden"
                disabled={!userProfile}
                scale={0.9}
              >
                {userProfile?.profileImage && !imageError ? (
                  <Image
                    key={userProfile?.profileImage}
                    source={{ uri: userProfile.profileImage }}
                    style={{ width: 48, height: 48, borderRadius: 24 }}
                    onError={() => setImageError(true)}
                  />
                ) : userProfile ? (
                  <View
                    style={{ width: 48, height: 48 }}
                    className="bg-gray-200 items-center justify-center rounded-full"
                  >
                    <MaterialIconSolid name="person" size={28} color="#9CA3AF" />
                  </View>
                ) : (
                  <DashboardAvatarSkeleton />
                )}
              </Bounceable>
            </View>
          </View>

          {/* ป้องกันการเบียดกันระหว่างการ์ดกับปุ่มด้านล่าง และอนุญาตให้เลื่อนเฉพาะเมื่ออยู่บนหน้าจอขนาดเล็ก */}
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 20,
              paddingBottom: emergencyContentPadding,
            }}
          >
            <KanitText weight="regular" className="text-xl text-gray-900 mb-4">
              ภาพรวม
            </KanitText>

            {/* การ์ดสถานะเหตุการณ์ */}
            {shouldShowEventCardSkeleton ? (
              <DashboardEventCardSkeleton />
            ) : (
              <View
                className={`px-4 py-4 rounded-[28px] mb-5 border min-h-[156px] bg-white shadow-sm ${shouldShowFallAlert ? 'border-red-100' : 'border-gray-100'}`}
              >
                {!shouldShowFallAlert && shouldShowStaleFall && (
                  <View className="absolute top-4 right-4 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                    <KanitText weight="regular" className="text-xs text-gray-600">
                      ข้อมูลย้อนหลัง
                    </KanitText>
                  </View>
                )}

                {shouldShowFallAlert && (
                  <View className="absolute top-4 right-4 px-3 py-1 rounded-full border bg-red-50 border-red-100">
                    <KanitText weight="regular" className="text-xs text-red-600">
                      ฉุกเฉิน
                    </KanitText>
                  </View>
                )}

                <View className="flex-row items-start mb-4">
                  <View className="flex-row items-center gap-4 flex-1">
                    <View
                      className={`w-14 h-14 rounded-full items-center justify-center ${shouldShowFallAlert ? 'bg-red-100' : shouldShowStaleFall ? 'bg-gray-100' : isDeviceOnlineForDisplay ? 'bg-blue-50' : 'bg-gray-100'}`}
                    >
                      <MaterialSymbol
                        name={
                          shouldShowFallAlert
                            ? 'warning'
                            : shouldShowStaleFall
                              ? 'history'
                              : isNoEventStatus
                                ? 'event_busy'
                                : isDeviceOnlineForDisplay
                                  ? 'accessibility'
                                  : 'signal_wifi_off'
                        }
                        size={30}
                        color={
                          shouldShowFallAlert
                            ? '#EF4444'
                            : shouldShowStaleFall
                              ? '#9CA3AF'
                              : isNoEventStatus
                                ? '#9CA3AF'
                                : isDeviceOnlineForDisplay
                                  ? '#3B82F6'
                                  : '#9CA3AF'
                        }
                      />
                    </View>

                    <View className="flex-1">
                      <KanitText className="text-gray-400 text-sm mb-1">สถานะเหตุการณ์</KanitText>
                      <KanitText
                        className={`text-2xl ${
                          shouldShowFallAlert
                            ? 'text-red-600'
                            : shouldShowStaleFall
                              ? 'text-gray-500'
                              : isDeviceOnlineForDisplay
                                ? 'text-gray-900'
                                : 'text-gray-400'
                        }`}
                        weight={shouldShowFallAlert ? 'medium' : 'regular'}
                        numberOfLines={1}
                      >
                        {fallDisplayLabel}
                      </KanitText>
                    </View>
                  </View>
                </View>

                <View className="h-[1px] bg-gray-100 mb-3" />

                <View className="flex-row justify-between items-end min-h-[44px]">
                  <View className="flex-1">
                    <KanitText
                      className="text-gray-400 text-sm"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {statusTimestampLabel} : {statusTimestampText}
                    </KanitText>

                    {shouldShowFallDetailAction ? (
                      <Bounceable
                        onPress={handleFallDetailPress}
                        className="flex-row items-center mt-1"
                        scale={0.98}
                      >
                        <KanitText weight="regular" className="text-sm text-gray-700">
                          ดูรายละเอียดเหตุการณ์เพิ่มเติม
                        </KanitText>
                        <MaterialSymbol name="chevron_right" size={18} color="#6B7280" />
                      </Bounceable>
                    ) : (
                      <View className="h-5 mt-1" />
                    )}
                  </View>

                  {shouldShowFallAlert ? (
                    <View className="w-[104px] min-h-[40px] items-end justify-center ml-3">
                      <Bounceable
                        onPress={handleAcknowledge}
                        className="bg-white px-5 py-2.5 rounded-xl shadow-sm border border-red-100"
                        scale={0.95}
                      >
                        <KanitText weight="regular" className="text-red-600 text-sm">
                          รับทราบแล้ว
                        </KanitText>
                      </Bounceable>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            {/* การ์ดอุปกรณ์และการ์ดชีพจร */}
            <View className="flex-row items-stretch mb-5">
              {isDashboardSyncing && displayElder?.device ? (
                <DashboardDeviceCardSkeleton />
              ) : (
                <Bounceable
                  onPress={handleDeviceCardPress}
                  disabled={isDeviceCardDisabled}
                  testID="home-device-card"
                  className="flex-1 min-h-[130px] bg-white pt-4 px-4 pb-2 rounded-[24px] border border-gray-100 shadow-sm mr-1.5"
                  scale={0.95}
                >
                  <View className="flex-row justify-between items-start">
                    <View
                      className={`w-12 h-12 rounded-2xl items-center justify-center ${
                        !displayElder?.device
                          ? 'bg-gray-100'
                          : isDeviceOnlineForDisplay
                            ? 'bg-green-100'
                            : 'bg-red-100'
                      }`}
                    >
                      <MaterialSymbol
                        name="devices"
                        size={24}
                        color={
                          !displayElder?.device
                            ? '#9CA3AF'
                            : isDeviceOnlineForDisplay
                              ? '#16AD78'
                              : '#EF4444'
                        }
                      />
                    </View>

                    <View className="flex-row items-center gap-2">
                      <View
                        className={`w-3 h-3 rounded-full ${
                          !displayElder?.device
                            ? 'bg-gray-300'
                            : isDeviceOnlineForDisplay
                              ? 'bg-green-500'
                              : 'bg-red-500'
                        }`}
                      />
                      <MaterialSymbol name="chevron_right" size={28} color="#9CA3AF" />
                    </View>
                  </View>

                  <View className="mt-2.5">
                    {displayElder?.device ? (
                      <KanitText className="text-gray-400 text-sm mb-1">อุปกรณ์</KanitText>
                    ) : (
                      <KanitText className="text-gray-400 text-sm mb-1">
                        แตะที่นี่เพื่อผูกอุปกรณ์
                      </KanitText>
                    )}

                    <KanitText
                      className={`text-lg ${
                        !displayElder?.device
                          ? 'text-gray-400'
                          : isDeviceOnlineForDisplay
                            ? 'text-gray-800'
                            : 'text-red-500'
                      }`}
                      weight="regular"
                    >
                      {!displayElder?.device
                        ? 'ยังไม่เชื่อมต่อ'
                        : isDeviceOnlineForDisplay
                          ? 'ออนไลน์'
                          : 'ออฟไลน์'}
                    </KanitText>
                  </View>
                </Bounceable>
              )}

              {isDashboardSyncing && displayElder?.device ? (
                <DashboardHeartRateCardSkeleton />
              ) : (
                <View className="flex-1 min-h-[130px] bg-white pt-4 px-4 pb-2 rounded-[24px] border border-gray-100 shadow-sm ml-1.5 relative overflow-hidden">
                  {hrStatus && isDeviceOnlineForDisplay && (
                    <View
                      className="absolute top-4 right-4 px-2 py-0.5 rounded-md z-20"
                      style={{ backgroundColor: hrStatus.bg }}
                    >
                      <KanitText style={{ color: hrStatus.color, fontSize: 11 }} weight="medium">
                        {hrStatus.label}
                      </KanitText>
                    </View>
                  )}

                  <View className="flex-row justify-between items-start z-10">
                    <View
                      className={`w-12 h-12 rounded-2xl items-center justify-center ${
                        isDeviceOnlineForDisplay ? 'bg-red-100' : 'bg-gray-100'
                      }`}
                    >
                      <MaterialIconSolid
                        name="favorite"
                        size={24}
                        color={isDeviceOnlineForDisplay ? '#EF4444' : '#9CA3AF'}
                      />
                    </View>
                  </View>

                  <View className="mt-2.5 z-10">
                    <View className="flex-row items-center justify-between">
                      <KanitText className="text-gray-400 text-sm mb-1">อัตราชีพจร</KanitText>
                    </View>

                    <View className="flex-row items-baseline gap-1">
                      <KanitText
                        className={`text-4xl ${
                          (!shouldShowHeartRate && !shouldShowEventHeartContext) ||
                          !isDeviceOnlineForDisplay
                            ? 'text-gray-400'
                            : 'text-gray-800'
                        }`}
                        style={
                          (!shouldShowHeartRate && !shouldShowEventHeartContext) ||
                          (!isDeviceOnlineForDisplay && eventBpm === null)
                            ? {}
                            : { color: '#1F2937' }
                        }
                        weight="regular"
                      >
                        {heartRateDisplayValue}
                      </KanitText>
                      <KanitText className="text-gray-400 text-sm">BPM</KanitText>
                    </View>

                    <View className="min-h-[18px] mt-1">
                      <KanitText
                        className={`text-xs ${heartCardContextText ? 'text-amber-700' : 'text-transparent'}`}
                        numberOfLines={1}
                      >
                        {heartCardContextText}
                      </KanitText>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* การ์ดข้อมูลผู้สูงอายุ */}
            <Bounceable
              onPress={handleElderCardPress}
              testID="home-elder-card"
              className={`bg-white ${elderCardPaddingClass} rounded-[28px] border border-gray-100 shadow-sm flex-row items-center justify-between ${elderCardSpacingClass}`}
              scale={0.95}
            >
              <View className={`flex-row items-center ${elderRowGapClass}`}>
                <View
                  className={`${elderAvatarSizeClass} bg-blue-50 rounded-full items-center justify-center border border-blue-100 overflow-hidden shadow-sm`}
                >
                  <MaterialIconSolid name="elderly" size={40} color="#4A90E2" />
                </View>

                <View>
                  <KanitText className="text-gray-400 text-sm mb-1.5">ผู้สูงอายุที่ดูแล</KanitText>

                  <KanitText
                    weight="regular"
                    className={`${elderNameSizeClass} text-gray-800 mb-2`}
                  >
                    {displayElder?.firstName} {displayElder?.lastName}
                  </KanitText>

                  <View className="flex-row space-x-2 gap-2">
                    <View
                      className={`px-3 py-1 rounded-full ${
                        displayElder?.gender === 'MALE'
                          ? 'bg-blue-100'
                          : displayElder?.gender === 'FEMALE'
                            ? 'bg-pink-100'
                            : 'bg-gray-100'
                      }`}
                    >
                      <KanitText
                        className={`text-xs ${
                          displayElder?.gender === 'MALE'
                            ? 'text-blue-600'
                            : displayElder?.gender === 'FEMALE'
                              ? 'text-pink-600'
                              : 'text-gray-600'
                        }`}
                      >
                        {displayElder?.gender === 'MALE'
                          ? 'ชาย'
                          : displayElder?.gender === 'FEMALE'
                            ? 'หญิง'
                            : 'ไม่ระบุ'}
                      </KanitText>
                    </View>

                    {displayElder?.dateOfBirth && (
                      <View className="bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
                        <KanitText className="text-xs text-orange-700">
                          อายุ {calculateAge(displayElder.dateOfBirth)} ปี
                        </KanitText>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <MaterialSymbol name="chevron_right" size={32} color="#9CA3AF" />
            </Bounceable>
          </ScrollView>

          {/* ปุ่มโทรฉุกเฉิน 3 สถานะ — Priority: EMERGENCY > SETUP > STANDBY */}
          <View
            className="absolute left-0 right-0"
            style={{ bottom: 0 }}
            onLayout={handleEmergencyLayout}
          >
            {shouldShowEmergencyButtonSkeleton ? <DashboardEmergencyButtonSkeleton /> : null}

            {!shouldShowEmergencyButtonSkeleton && emergencyButtonState === 'EMERGENCY' && (
              // Priority 1: ตรวจพบการล้ม — solid red ดึงดูดสายตาสูงสุด ไม่มี dialog
              <Bounceable
                onPress={() => handleEmergencyPress('EMERGENCY')}
                className="bg-red-500 rounded-t-[35px] rounded-b-none px-5 py-3.5 flex-row justify-center items-center shadow-lg shadow-red-200"
                scale={0.98}
              >
                <View className="bg-white/20 p-1.5 rounded-full mr-3">
                  <MaterialIconSolid name="phone_in_talk" size={22} color="white" />
                </View>
                <KanitText weight="regular" className="text-white text-lg">
                  โทรฉุกเฉินทันที
                </KanitText>
              </Bounceable>
            )}

            {!shouldShowEmergencyButtonSkeleton && emergencyButtonState === 'SETUP' && (
              // Priority 2: ยังไม่มีเบอร์ฉุกเฉิน — orange แจ้งเตือนว่าระบบยังไม่พร้อม
              <Bounceable
                onPress={() => handleEmergencyPress('SETUP')}
                className="bg-orange-500 rounded-t-[35px] rounded-b-none px-5 py-3.5 flex-row justify-center items-center shadow-lg shadow-orange-200"
                scale={0.98}
              >
                <View className="bg-white/20 p-1.5 rounded-full mr-3">
                  <MaterialIconSolid name="person_add" size={22} color="white" />
                </View>
                <KanitText weight="regular" className="text-white text-lg">
                  เพิ่มเบอร์ติดต่อฉุกเฉิน
                </KanitText>
              </Bounceable>
            )}

            {!shouldShowEmergencyButtonSkeleton && emergencyButtonState === 'STANDBY' && (
              // Priority 3: พร้อมใช้งาน — ขาว-ขอบแดงรักษา affordance แต่ไม่สร้าง alarm fatigue
              <Bounceable
                onPress={() => handleEmergencyPress('STANDBY')}
                className="bg-white rounded-t-[35px] rounded-b-none px-5 py-3.5 flex-row justify-center items-center border border-red-300 shadow-sm shadow-gray-100"
                scale={0.98}
              >
                <View className="bg-red-50 p-1.5 rounded-full mr-3">
                  <MaterialIconSolid name="phone_in_talk" size={22} color="#EF4444" />
                </View>
                <KanitText weight="regular" className="text-red-500 text-lg">
                  โทรฉุกเฉิน
                </KanitText>
              </Bounceable>
            )}
          </View>
        </ScreenWrapper>
      ) : (
        <ScreenWrapper
          edges={['left', 'right']}
          useScrollView={false}
          style={{ backgroundColor: '#FFFFFF', position: 'relative' }}
        >
          <DashboardSkeleton />
        </ScreenWrapper>
      )}
    </View>
  );
}
