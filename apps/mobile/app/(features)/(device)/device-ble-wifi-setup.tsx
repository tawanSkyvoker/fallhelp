/**
 * Device BLE WiFi Setup Screen
 *
 * หน้านี้ใช้ตั้งค่า WiFi ให้อุปกรณ์ที่ยังออฟไลน์อยู่
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - รับ serialNumber จากหน้าก่อนหน้า
 * - ตรวจสิทธิ์ Bluetooth และ Location
 * - ค้นหาอุปกรณ์ผ่าน BLE
 * - สแกน WiFi รอบตัว หรือให้ผู้ใช้กรอกเอง
 * - ส่ง SSID และ Password ไปให้อุปกรณ์ผ่าน BLE
 * - รอให้อุปกรณ์ออนไลน์ แล้วกลับไปหน้ารายละเอียดอุปกรณ์
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, AppState, Linking, Platform, Keyboard } from 'react-native';
import { MaterialSymbol } from '../../../components/MaterialSymbol';
import { ModernSpinner } from '../../../components/ModernSpinner';
import { MaterialIconSolid } from '../../../components/MaterialIconSolid';
import { useQueryClient } from '@tanstack/react-query';

import KanitText from '../../../components/KanitText';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { FloatingLabelInput } from '../../../components/FloatingLabelInput';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { WiFiNetworkList } from '../../../components/WiFiNetworkList';

import Logger from '../../../utils/logger';
import { BLEProvisioningStatus, BLEState, State, bleService } from '../../../services/bleService';
import { wifiScannerService } from '../../../services/wifiScannerService';
import { showDialog } from '../../../utils/dialogService';
import { requestBLEPermissions, checkBLEPermissions } from '../../../utils/blePermissions';
import { safeRouter as router } from '../../../utils/safeRouter';
import { useAppSearchParams } from '../../../utils/searchParams';
import { getWiFiProvisioningFailureMessage } from '../../../utils/wifiProvisioningMessages';
import { getWifiCredentialValidationError } from '../../../utils/formValidation';
import { runAfterKeyboardDismiss } from '../../../utils/keyboard';
import { getDeviceConfig } from '../../../services/deviceService';

import { useNavBarInset } from '../../../hooks/useNavBarInset';
import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { queryKeys } from '../../../hooks/queryKeys';
import { useDeviceSetupStore } from '../../../store/useDeviceSetupStore';
import { useSensorStore } from '../../../store/useSensorStore';

import type { WiFiNetwork } from '../../../services/wifiScannerService';
import type { Device, Elder } from '../../../services/types';

// สถานะหลักของหน้าจอ
// ใช้บอกว่า UI ตอนนี้ควรแสดงขั้นตอนไหน
type SetupStep =
  | 'initializing'
  | 'bluetooth-check'
  | 'ble-connecting'
  | 'wifi-scanning'
  | 'wifi-list'
  | 'wifi-password'
  | 'wifi-manual-input'
  | 'provisioning'
  | 'provisioning-failed'
  | 'success';

// เวลาสูงสุดที่รอให้อุปกรณ์กลับมาออนไลน์หลังส่ง WiFi
const PROVISIONING_ONLINE_TIMEOUT_MS = 30_000;

// จำนวนครั้งและระยะเวลาที่ใช้รอให้สถานะ Bluetooth นิ่งก่อนตัดสินใจ
const BLE_STATE_SETTLE_ATTEMPTS = 4;
const BLE_STATE_SETTLE_DELAY_MS = 300;

// ข้อความ progress ระหว่างส่ง WiFi ให้อุปกรณ์
const PROVISIONING_STATUS_STAGES: { afterMs: number; message: string }[] = [
  { afterMs: 0, message: 'กำลังส่งข้อมูล WiFi ให้อุปกรณ์...' },
  { afterMs: 4_000, message: 'อุปกรณ์กำลังพยายามเชื่อมต่อ WiFi...' },
  { afterMs: 12_000, message: 'กำลังรอผลการเชื่อมต่อจากอุปกรณ์...' },
  { afterMs: 24_000, message: 'หากเชื่อมต่อไม่สำเร็จ ระบบจะเตรียมให้ลองใหม่...' },
  { afterMs: 28_000, message: 'รอให้อุปกรณ์พร้อมสำหรับการลองอีกครั้ง...' },
];

const INITIAL_PROVISIONING_STATUS_MESSAGE = PROVISIONING_STATUS_STAGES[0]?.message ?? '';

// สถานะ BLE เหล่านี้ถือว่า flow จบแล้ว แต่เป็นฝั่งไม่สำเร็จ
const TERMINAL_PROVISIONING_STATUSES: ReadonlySet<BLEProvisioningStatus> = new Set([
  BLEProvisioningStatus.FAILED,
  BLEProvisioningStatus.INVALID,
  BLEProvisioningStatus.MQTT_UNAVAILABLE,
  BLEProvisioningStatus.TRANSPORT_ERROR,
  BLEProvisioningStatus.TIMEOUT,
]);

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isTerminalProvisioningStatus = (
  status: BLEProvisioningStatus | undefined,
): status is BLEProvisioningStatus => {
  return status !== undefined && TERMINAL_PROVISIONING_STATUSES.has(status);
};

export default function DeviceBleWifiSetupScreen() {
  const queryClient = useQueryClient();

  // เพิ่มระยะด้านล่าง ไม่ให้เนื้อหาชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // อ่าน params ที่ถูกส่งมาจากหน้าก่อนหน้า
  const searchParams = useAppSearchParams();

  // serialNumber ใช้สำหรับหาอุปกรณ์ BLE ที่ต้องการเชื่อมต่อ
  const serialNumber = searchParams.getStringOrEmpty('serialNumber');

  // from ใช้บอกว่าหลังตั้งค่าเสร็จควรกลับไปหน้าไหน
  const from = searchParams.getStringOrEmpty('from');

  // อ่านสถานะ online ของอุปกรณ์จาก realtime store
  const { isConnected: deviceOnline, lastStatusUpdate, lastHeartUpdate } = useSensorStore();

  // ดึงข้อมูลผู้สูงอายุและอุปกรณ์ที่ผูกอยู่
  const { data: elderInfo } = useCurrentElder();

  // currentStep ใช้ควบคุมว่า renderContent() จะแสดง UI อะไร
  const [currentStep, setCurrentStep] = useState<SetupStep>('initializing');

  const appState = useRef(AppState.currentState);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref กลุ่มนี้ใช้กันงานซ้ำ หรือกัน callback ทำงานหลังออกจากหน้าแล้ว
  const isExitingRef = useRef(false);
  const isConnectingRef = useRef(false);
  const isInitializingRef = useRef(false);
  const permissionRequestInProgressRef = useRef(false);

  // เก็บ WiFi ไว้ชั่วคราว กรณี BLE หลุดแล้วต้อง reconnect ก่อนส่งต่อ
  const pendingProvisionRef = useRef<{ ssid: string; password: string } | null>(null);

  // เก็บสถานะว่า BLE เชื่อมต่ออยู่หรือไม่
  const [_bleConnected, setBleConnected] = useState(false);

  // เก็บรายการ WiFi ที่สแกนได้
  const [wifiNetworks, setWifiNetworks] = useState<WiFiNetwork[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<WiFiNetwork | null>(null);
  const selectedNetworkRef = useRef<WiFiNetwork | null>(null);

  // State ใช้แสดงค่าใน input, Ref ใช้เก็บค่าล่าสุดตอนส่งจริง
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const ssidRef = useRef('');
  const passwordRef = useRef('');

  // State สำหรับแสดงความคืบหน้าระหว่าง provisioning
  const [_isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningStatus, setProvisioningStatus] = useState<string>('');
  const [provisioningStartedAt, setProvisioningStartedAt] = useState<number | null>(null);
  const [provisioningElapsedMs, setProvisioningElapsedMs] = useState<number>(0);

  // ใช้เช็กว่าอุปกรณ์ออนไลน์อยู่ก่อนเริ่มส่ง WiFi หรือเพิ่งออนไลน์หลังส่ง
  const provisioningOnlineAtStartRef = useRef(false);

  // กัน timeout / success handler ทำงานซ้ำ
  const provisioningTimeoutHandledRef = useRef(false);
  const wifiConnectedViaBleRef = useRef(false);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const provisioningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isFlowActive = useCallback((): boolean => !isExitingRef.current, []);

  const showDialogIfActive = useCallback(
    (...args: Parameters<typeof showDialog>) => {
      // ถ้าออกจากหน้านี้แล้ว ไม่ควรแสดง dialog ตามหลัง
      if (!isFlowActive()) return;
      showDialog(...args);
    },
    [isFlowActive],
  );

  const primeOnlineStateForDeviceInfo = useCallback(
    (confirmedDevice?: Device | null): void => {
      const currentDevice = confirmedDevice ?? elderInfo?.device;
      if (!currentDevice?.id) return;

      const confirmedAt = confirmedDevice?.lastOnline ?? new Date().toISOString();

      // ส่งต่อสถานะที่เพิ่งยืนยันแล้วให้หน้ารายละเอียดอุปกรณ์ทันที กัน cache เก่าแสดง offline ชั่วคราว
      queryClient.setQueryData<Elder | null>(queryKeys.currentElder(), (currentElder) => {
        if (!currentElder?.device || currentElder.device.id !== currentDevice.id) {
          return currentElder;
        }

        return {
          ...currentElder,
          device: {
            ...currentElder.device,
            ...confirmedDevice,
            isOnline: true,
            onlineStatus: 'ONLINE',
            lastOnline: confirmedAt,
            wifiStatus: 'CONNECTED',
          },
        };
      });

      const sensorStore = useSensorStore.getState();
      const confirmedDate = new Date(confirmedAt);

      sensorStore.setIsConnected(true);
      sensorStore.setLastStatusUpdate(
        Number.isFinite(confirmedDate.getTime()) ? confirmedDate : new Date(),
      );

      void queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });
    },
    [elderInfo?.device, queryClient],
  );

  const completeProvisioningSuccess = useCallback(
    (logMessage?: string, confirmedDevice?: Device | null): void => {
      if (logMessage) {
        Logger.info(logMessage);
      }

      primeOnlineStateForDeviceInfo(confirmedDevice);
      setProvisioningStatus('เชื่อมต่อสำเร็จ!');
      setIsProvisioning(false);
      setProvisioningStartedAt(null);
      provisioningTimeoutHandledRef.current = true;
      setCurrentStep('success');
    },
    [primeOnlineStateForDeviceInfo],
  );

  const showPermissionRequiredDialog = useCallback(
    (message?: string): void => {
      const defaultPermissionMessage =
        'กรุณาอนุญาตสิทธิ์ Bluetooth และตำแหน่ง เพื่อให้แอปค้นหาและเชื่อมต่ออุปกรณ์ได้';
      const permissionMessage = message ?? defaultPermissionMessage;

      showDialogIfActive('ต้องอนุญาตสิทธิ์ก่อน', permissionMessage, [
        { text: 'ตกลง', style: 'cancel' },
        { text: 'ไปที่การตั้งค่า', onPress: () => Linking.openSettings() },
      ]);
    },
    [showDialogIfActive],
  );

  const getSettledBLEState = useCallback(async (): Promise<BLEState> => {
    // อ่านสถานะ BLE หลายรอบ เพื่อกันค่าชั่วคราวตอน Bluetooth กำลังเปลี่ยนสถานะ
    let previousState = await bleService.getState();

    for (let attempt = 0; attempt < BLE_STATE_SETTLE_ATTEMPTS; attempt += 1) {
      await wait(BLE_STATE_SETTLE_DELAY_MS);

      // อ่านสถานะ Bluetooth จาก BLE service
      // ไฟล์ถัดไป: services/bleService.ts
      const nextState = await bleService.getState();

      if (nextState === State.PoweredOn || nextState === previousState) {
        return nextState;
      }

      previousState = nextState;
    }

    return previousState;
  }, []);

  const resetProvisioningState = useCallback((): void => {
    // รีเซ็ตสถานะ provisioning เพื่อให้ผู้ใช้ลองใหม่ได้
    setIsProvisioning(false);
    setProvisioningStartedAt(null);
    setProvisioningStatus('');
    provisioningTimeoutHandledRef.current = true;
  }, []);

  const getProvisioningStageMessage = (elapsedMs: number): string => {
    // เลือกข้อความ progress ตามเวลาที่ผ่านไป
    const stages = [...PROVISIONING_STATUS_STAGES].reverse();
    const matched = stages.find((s) => elapsedMs >= s.afterMs);

    return matched?.message ?? INITIAL_PROVISIONING_STATUS_MESSAGE;
  };

  useEffect(() => {
    if (!provisioningStartedAt) {
      if (provisioningTimerRef.current) {
        clearInterval(provisioningTimerRef.current);
        provisioningTimerRef.current = null;
      }

      setProvisioningElapsedMs(0);
      return;
    }

    // ระหว่าง provisioning ให้อัปเดตเวลาและข้อความสถานะทุก 1 วินาที
    provisioningTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - provisioningStartedAt;
      setProvisioningElapsedMs(elapsed);
      setProvisioningStatus(getProvisioningStageMessage(elapsed));
    }, 1000);

    return () => {
      if (provisioningTimerRef.current) {
        clearInterval(provisioningTimerRef.current);
        provisioningTimerRef.current = null;
      }
    };
  }, [provisioningStartedAt]);

  // เก็บ currentStep ล่าสุดไว้ใน Ref
  // callback ที่ถูกสร้างไว้ก่อนหน้าจะอ่าน step ล่าสุดได้
  const currentStepRef = useRef(currentStep);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    selectedNetworkRef.current = selectedNetwork;
  }, [selectedNetwork]);

  useEffect(() => {
    if (!elderInfo?.id || !elderInfo?.device?.id) return;

    // ตั้งค่า store เพื่อให้ realtime/socket รู้ว่าต้องติดตาม elder/device ตัวไหน
    useDeviceSetupStore.getState().setElderConfig(elderInfo.id, elderInfo.device.id);
  }, [elderInfo?.device?.id, elderInfo?.id]);

  useEffect(() => {
    if (!provisioningStartedAt || currentStep === 'success') return;
    if (!deviceOnline) return;

    const lastStatusMs = lastStatusUpdate?.getTime() ?? 0;
    const lastHeartMs = lastHeartUpdate?.getTime() ?? 0;
    const lastActivityMs = Math.max(lastStatusMs, lastHeartMs);

    const hasFreshUpdate = lastActivityMs >= provisioningStartedAt;
    const wasOfflineAtStart = !provisioningOnlineAtStartRef.current;

    if (wasOfflineAtStart || hasFreshUpdate) {
      completeProvisioningSuccess(
        'Device online after BLE provisioning. Completing feature WiFi setup.',
      );
    }
  }, [
    completeProvisioningSuccess,
    currentStep,
    deviceOnline,
    lastHeartUpdate,
    lastStatusUpdate,
    provisioningStartedAt,
  ]);

  useEffect(() => {
    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    if (currentStep !== 'provisioning' || !provisioningStartedAt) {
      stopPolling();
      return;
    }

    const deviceId = elderInfo?.device?.id;

    if (!deviceId) {
      stopPolling();
      return;
    }

    // ถ้า realtime ยังไม่อัปเดต ให้ polling backend เป็นตัวสำรอง
    const startDelay = setTimeout(() => {
      pollingIntervalRef.current = setInterval(async () => {
        if (currentStepRef.current !== 'provisioning') {
          stopPolling();
          return;
        }

        if (provisioningTimeoutHandledRef.current) {
          stopPolling();
          return;
        }

        try {
          // ตรวจสถานะอุปกรณ์จาก backend
          // ไฟล์ถัดไป: services/deviceService.ts
          const device = await getDeviceConfig(deviceId);

          const lastOnlineMs = device.lastOnline ? Date.parse(device.lastOnline) : 0;
          const hasFreshBackendOnline = lastOnlineMs >= provisioningStartedAt;
          const wasOfflineAtStart = !provisioningOnlineAtStartRef.current;

          if (device?.wifiStatus === 'CONNECTED' && (wasOfflineAtStart || hasFreshBackendOnline)) {
            completeProvisioningSuccess(
              '[Device BLE Fallback] Device wifiStatus=CONNECTED via polling -> completing',
              device,
            );
            stopPolling();
          }
        } catch (err) {
          Logger.warn('[Device BLE Fallback] Polling error:', err);
        }
      }, 3000);
    }, 5000);

    return () => {
      clearTimeout(startDelay);
      stopPolling();
    };
  }, [completeProvisioningSuccess, currentStep, elderInfo?.device?.id, provisioningStartedAt]);

  const handleExit = useCallback(
    async (navigate = true) => {
      if (isExitingRef.current) return;

      isExitingRef.current = true;

      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      try {
        // ออกจากหน้านี้แล้วต้องหยุด BLE scan และ disconnect
        bleService.stopScan();
        await bleService.disconnect();
      } catch (error) {
        Logger.error('BLE cleanup error:', error);
      }

      if (!navigate) return;

      if (from === 'device-info') {
        router.dismissTo('/(features)/(device)/device-info');
        return;
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(features)/(device)/device-info');
      }
    },
    [from],
  );

  const handleProvisioningTerminalFailure = useCallback(
    (message: string) => {
      if (!isFlowActive()) return;

      const wifiConnectedViaBle = wifiConnectedViaBleRef.current;

      // provisioning จบแบบไม่สำเร็จ ให้ล้างรหัสผ่านและเปิดให้ลองใหม่
      resetProvisioningState();
      wifiConnectedViaBleRef.current = false;
      setPassword('');
      passwordRef.current = '';

      const displayMessage = getWiFiProvisioningFailureMessage(message, {
        wifiConnectedViaBle,
      });

      showDialogIfActive('เชื่อมต่อไม่สำเร็จ', displayMessage, [
        {
          text: 'ตกลง',
          style: 'cancel',
          onPress: () => {
            setCurrentStep(selectedNetwork ? 'wifi-password' : 'wifi-manual-input');
          },
        },
      ]);
    },
    [isFlowActive, resetProvisioningState, showDialogIfActive, selectedNetwork],
  );

  // Ref กลุ่มนี้ช่วยให้ listener เรียก callback เวอร์ชันล่าสุดได้
  const handleExitRef = useRef(handleExit);
  const connectBLERef = useRef<(targetSerialNumber: string, silent?: boolean) => Promise<void>>(
    async () => {},
  );
  const initializeRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const checkBluetoothAndInitializeRef = useRef<(state: BLEState) => Promise<void>>(() =>
    Promise.resolve(),
  );

  useEffect(() => {
    handleExitRef.current = handleExit;
  }, [handleExit]);

  const startWiFiScan = useCallback(async () => {
    setCurrentStep('wifi-list');
    setIsScanning(true);

    try {
      // ตรวจว่าเครื่องสแกน WiFi ได้หรือไม่
      // ไฟล์ถัดไป: services/wifiScannerService.ts
      const isAvailable = await wifiScannerService.isAvailable();

      if (!isFlowActive()) return;

      if (!isAvailable) {
        showDialogIfActive('WiFi ปิดอยู่', 'กรุณาเปิด WiFi บนมือถือเพื่อค้นหาเครือข่าย', [
          { text: 'ตกลง', onPress: () => setCurrentStep('wifi-list') },
        ]);

        setIsScanning(false);
        return;
      }

      // โหลด WiFi จาก Cache เพื่อให้ผู้ใช้เห็นรายการและไอคอนความแรง WiFi ทันที (Instant Render)
      try {
        const cachedResult = await wifiScannerService.loadCachedNetworks();
        if (isFlowActive() && cachedResult.networks && cachedResult.networks.length > 0) {
          setWifiNetworks(cachedResult.networks);
          setCurrentStep('wifi-list');
        }
      } catch (e) {
        Logger.warn('[WiFi] Failed to load cached networks in BLE setup:', e);
      }

      // สแกนหา WiFi รอบตัวแบบสด (Fresh scan) ใน background เพื่อผลลัพธ์ที่อัปเดตที่สุด
      // ไฟล์ถัดไป: services/wifiScannerService.ts
      const result = await wifiScannerService.scanNetworks();

      if (!isFlowActive()) return;

      if (result.error && result.networks.length === 0) {
        Logger.error('WiFi scan error:', result.error);
      }

      setWifiNetworks(result.networks);

      setCurrentStep('wifi-list');

      if (result.networks.length === 0) {
        const goManual = () => {
          selectedNetworkRef.current = null;
          setSelectedNetwork(null);
          setSsid('');
          setPassword('');
          ssidRef.current = '';
          passwordRef.current = '';
          currentStepRef.current = 'wifi-password';
          setCurrentStep('wifi-password');
        };

        showDialogIfActive('ไม่พบเครือข่าย WiFi', 'ต้องการทำอะไรต่อ?', [
          { text: 'สแกนอีกครั้ง', onPress: () => void startWiFiScan() },
          { text: 'กรอกเอง', onPress: () => goManual() },
          { text: 'ยกเลิก', style: 'cancel' },
        ]);
      }
    } catch (error) {
      if (!isFlowActive()) return;

      Logger.error('WiFi scan error:', error);
      showDialogIfActive('เชื่อมต่อไม่สำเร็จ', 'ค้นหาเครือข่าย WiFi ไม่สำเร็จ');
    } finally {
      setIsScanning(false);
    }
  }, [isFlowActive, showDialogIfActive]);

  const performProvision = useCallback(
    async (finalSSID: string, finalPassword: string) => {
      setIsProvisioning(true);
      setCurrentStep('provisioning');
      setProvisioningStatus('กำลังเชื่อมต่อ WiFi...');
      provisioningTimeoutHandledRef.current = false;
      wifiConnectedViaBleRef.current = false;

      try {
        const startedAt = Date.now();

        setProvisioningStartedAt(startedAt);
        provisioningOnlineAtStartRef.current = deviceOnline;

        // ส่ง SSID และ Password ไปให้อุปกรณ์ผ่าน BLE
        // ไฟล์ถัดไป: services/bleService.ts
        const result = await bleService.sendWiFiCredentials(finalSSID.trim(), finalPassword);

        if (!isFlowActive()) return;

        if (result.success) {
          // BLE CONNECTED ยืนยันแค่ว่า ESP32 ต่อ WiFi ได้แล้ว ยังต้องรอ backend/socket ยืนยัน online ก่อนจบ flow
          wifiConnectedViaBleRef.current = true;
          setProvisioningStatus('เชื่อมต่อ WiFi แล้ว กำลังรออุปกรณ์ออนไลน์...');
          await bleService.disconnect();
          return;
        }

        if (isTerminalProvisioningStatus(result.status)) {
          handleProvisioningTerminalFailure(result.message);
          return;
        }

        throw new Error(result.message);
      } catch (error) {
        if (!isFlowActive()) return;

        Logger.warn('WiFi provisioning failed:', error);
        handleProvisioningTerminalFailure(
          error instanceof Error ? error.message : 'ตั้งค่า WiFi ไม่สำเร็จ',
        );
      }
    },
    [deviceOnline, handleProvisioningTerminalFailure, isFlowActive],
  );

  const handleBLEDeviceFound = useCallback(
    async (deviceId: string) => {
      try {
        // เชื่อมต่ออุปกรณ์ BLE ที่สแกนเจอ
        // ไฟล์ถัดไป: services/bleService.ts
        const connected = await bleService.connectToDevice(deviceId);

        if (!isFlowActive()) return;

        if (connected) {
          setBleConnected(true);
          Logger.info('BLE connected successfully');

          isConnectingRef.current = false;

          if (pendingProvisionRef.current) {
            // กรณีเคยกดส่ง WiFi แล้ว BLE หลุด ให้ส่ง WiFi ต่อหลัง reconnect สำเร็จ
            const { ssid: pendingSsid, password: pendingPassword } = pendingProvisionRef.current;
            pendingProvisionRef.current = null;

            await performProvision(pendingSsid, pendingPassword);
            return;
          }

          const shouldReturnToWifiScan =
            currentStepRef.current === 'initializing' ||
            currentStepRef.current === 'bluetooth-check' ||
            currentStepRef.current === 'ble-connecting';

          if (!shouldReturnToWifiScan) {
            Logger.info('Ignoring stale BLE connect callback outside scan flow', {
              currentStep: currentStepRef.current,
            });
            return;
          }

          // BLE เชื่อมต่อสำเร็จแล้ว
          // ถัดไปเริ่มสแกน WiFi
          await startWiFiScan();
          return;
        }

        Logger.warn('BLE connection rejected or dropped by device');
        isConnectingRef.current = false;

        showDialogIfActive(
          'เชื่อมต่อไม่สำเร็จ',
          'ยังเชื่อมต่ออุปกรณ์ไม่ได้ กรุณาลองปิด-เปิดอุปกรณ์ก่อน แล้วค่อยลองใหม่อีกครั้ง',
          [
            { text: 'ลองอีกครั้ง', onPress: () => void connectBLERef.current(serialNumber) },
            { text: 'ยกเลิก', style: 'cancel', onPress: () => void handleExitRef.current() },
          ],
        );
      } catch (error) {
        if (!isFlowActive()) return;

        isConnectingRef.current = false;
        Logger.warn('Transient BLE device connection error (retrying):', error);

        if (pendingProvisionRef.current) {
          pendingProvisionRef.current = null;
          setIsProvisioning(false);
          setCurrentStep('wifi-password');
        }

        showDialogIfActive(
          'เชื่อมต่อไม่สำเร็จ',
          'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
          [
            { text: 'ลองอีกครั้ง', onPress: () => void connectBLERef.current(serialNumber) },
            { text: 'ยกเลิก', style: 'cancel', onPress: () => void handleExitRef.current() },
          ],
        );
      }
    },
    [isFlowActive, performProvision, serialNumber, showDialogIfActive, startWiFiScan],
  );

  const connectBLE = useCallback(
    async (targetSerialNumber: string, silent = false) => {
      if (isExitingRef.current || isConnectingRef.current) return;

      isConnectingRef.current = true;

      if (!silent) setCurrentStep('ble-connecting');

      try {
        if (scanTimerRef.current) {
          clearTimeout(scanTimerRef.current);
          scanTimerRef.current = null;
        }

        // ใช้เลขท้าย serial number เพื่อหา BLE device ที่ตรงกับอุปกรณ์ตัวนี้
        const shortId = targetSerialNumber.substring(targetSerialNumber.length - 6);
        Logger.info('Looking for BLE device with serial suffix:', shortId);

        let deviceConnecting = false;

        // สแกนหาอุปกรณ์ BLE
        // ไฟล์ถัดไป: services/bleService.ts
        bleService.scanForDevices((device) => {
          if (isExitingRef.current) return;
          if (!device.name || deviceConnecting) return;

          const deviceName = device.name || device.localName;

          if (deviceName && deviceName.endsWith(shortId)) {
            deviceConnecting = true;

            bleService.stopScan();

            if (scanTimerRef.current) {
              clearTimeout(scanTimerRef.current);
              scanTimerRef.current = null;
            }

            // เจออุปกรณ์แล้ว
            // ถัดไปไปที่ handleBLEDeviceFound()
            void handleBLEDeviceFound(device.id);
          }
        }, 10000);

        scanTimerRef.current = setTimeout(() => {
          if (!deviceConnecting && !isExitingRef.current) {
            isConnectingRef.current = false;

            bleService.stopScan();

            showDialogIfActive(
              'ไม่พบอุปกรณ์',
              'กรุณาตรวจสอบว่าอุปกรณ์อยู่ใกล้โทรศัพท์ และลองปิด-เปิดอุปกรณ์ก่อนค้นหาใหม่อีกครั้ง',
              [
                { text: 'ลองอีกครั้ง', onPress: () => void connectBLE(targetSerialNumber) },
                { text: 'ยกเลิก', style: 'cancel', onPress: () => void handleExitRef.current() },
              ],
            );
          }
        }, 10000);
      } catch (error) {
        if (!isFlowActive()) return;

        isConnectingRef.current = false;
        Logger.error('BLE connection error:', error);

        showDialogIfActive(
          'เชื่อมต่อไม่สำเร็จ',
          'ยังเชื่อมต่ออุปกรณ์ไม่ได้ กรุณาลองปิด-เปิดอุปกรณ์ก่อน แล้วค่อยลองใหม่อีกครั้ง',
        );
      }
    },
    [handleBLEDeviceFound, isFlowActive, showDialogIfActive],
  );

  const initialize = useCallback(async () => {
    if (_bleConnected) return;
    if (isInitializingRef.current) return;

    isInitializingRef.current = true;

    try {
      if (!serialNumber) {
        showDialogIfActive('เริ่มต้นไม่สำเร็จ', 'ไม่พบข้อมูลอุปกรณ์', [
          { text: 'ตกลง', onPress: () => void handleExitRef.current() },
        ]);
        return;
      }

      // ตรวจสิทธิ์ที่จำเป็นสำหรับ BLE
      // ไฟล์ถัดไป: utils/blePermissions.ts
      const hasPermissions = await checkBLEPermissions();

      if (!hasPermissions) {
        permissionRequestInProgressRef.current = true;

        // ขอสิทธิ์ Bluetooth และ Location
        // ไฟล์ถัดไป: utils/blePermissions.ts
        const result = await requestBLEPermissions();

        permissionRequestInProgressRef.current = false;

        if (!isFlowActive()) return;

        if (!result.granted) {
          showPermissionRequiredDialog(result.message);
          return;
        }

        const permissionsReady = await checkBLEPermissions();

        if (!permissionsReady) {
          showPermissionRequiredDialog();
          return;
        }
      }

      // ตรวจว่า Bluetooth พร้อมใช้งานหรือไม่
      // ไฟล์ถัดไป: services/bleService.ts
      const bleReady = await bleService.initialize();

      if (!bleReady) {
        const state = await getSettledBLEState();

        if (state === State.PoweredOff) {
          setCurrentStep('bluetooth-check');
          return;
        }

        if (state === State.Unauthorized) {
          showPermissionRequiredDialog();
          return;
        }

        if (state === State.Unsupported) {
          showDialogIfActive('ไม่รองรับ Bluetooth', 'อุปกรณ์เครื่องนี้ไม่รองรับ Bluetooth');
          return;
        }

        Logger.warn('BLE is not ready after permission request', { state });
        return;
      }

      // Bluetooth พร้อมแล้ว
      // ถัดไปเริ่มเชื่อมต่อ BLE
      await connectBLE(serialNumber);
    } catch (error) {
      if (!isFlowActive()) return;

      Logger.error('Initialization error:', error);
      showDialogIfActive('เริ่มต้นไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      permissionRequestInProgressRef.current = false;
      isInitializingRef.current = false;
    }
  }, [
    _bleConnected,
    connectBLE,
    getSettledBLEState,
    isFlowActive,
    serialNumber,
    showDialogIfActive,
    showPermissionRequiredDialog,
  ]);

  const checkBluetoothAndInitialize = useCallback(async (state: BLEState) => {
    try {
      if (permissionRequestInProgressRef.current) return;

      if (state === State.PoweredOn) {
        // Bluetooth เปิดแล้ว
        // ถัดไปเริ่ม initialize()
        void initializeRef.current();
      } else if (state === State.PoweredOff) {
        if (currentStepRef.current === 'initializing') {
          void initializeRef.current();
          return;
        }

        setCurrentStep('bluetooth-check');
      }
    } catch (error) {
      Logger.error('Error checking Bluetooth status:', error);
    }
  }, []);

  useEffect(() => {
    // อัปเดต Ref ให้ listener เรียก callback เวอร์ชันล่าสุด
    handleExitRef.current = handleExit;
    connectBLERef.current = connectBLE;
    initializeRef.current = initialize;
    checkBluetoothAndInitializeRef.current = checkBluetoothAndInitialize;
  }, [checkBluetoothAndInitialize, connectBLE, handleExit, initialize]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        Logger.info('App has come to the foreground!');

        const check = async () => {
          // กลับมาจาก background แล้วตรวจ Bluetooth ใหม่
          const state = await bleService.getState();
          await checkBluetoothAndInitializeRef.current(state);
        };

        void check();
      }

      appState.current = nextAppState;
    });

    const check = async () => {
      // เข้า screen ครั้งแรก ให้ตรวจ Bluetooth ทันที
      const state = await bleService.getState();
      await checkBluetoothAndInitializeRef.current(state);
    };

    void check();

    const bleSubscription = bleService.onStateChange((state) => {
      // ถ้า Bluetooth เปิด/ปิดระหว่างอยู่หน้านี้ ให้จัดการใหม่
      void checkBluetoothAndInitializeRef.current(state);
    });

    return () => {
      subscription.remove();
      bleSubscription.remove();

      // ออกจากหน้าแล้ว cleanup BLE
      void handleExitRef.current(false);
    };
  }, []);

  const handleProvision = useCallback(
    async (wifiSSID?: string, wifiPassword?: string) => {
      // อ่านค่าล่าสุดจาก Ref ก่อนเริ่มส่ง WiFi
      const latestSsid = ssidRef.current;
      const latestPassword = passwordRef.current;
      const finalSSID = wifiSSID ?? latestSsid;
      const finalPassword = wifiPassword !== undefined ? wifiPassword : latestPassword;

      const selectedWifiNetwork = selectedNetworkRef.current;
      const requiresPassword = selectedWifiNetwork
        ? wifiScannerService.isSecured(selectedWifiNetwork)
        : true;

      const wifiValidationError = getWifiCredentialValidationError({
        ssid: finalSSID,
        password: finalPassword,
        requiresPassword,
      });
      if (wifiValidationError) {
        showDialogIfActive(wifiValidationError.title, wifiValidationError.message);
        return;
      }

      Keyboard.dismiss();
      const runProvision = async () => {
        // ตรวจว่า BLE ยังเชื่อมต่ออยู่หรือไม่
        // ไฟล์ถัดไป: services/bleService.ts
        const actualConnected = await bleService.isConnected();

        if (!isFlowActive()) return;

        if (actualConnected && !_bleConnected) {
          setBleConnected(true);
        }

        if (!actualConnected) {
          if (!serialNumber) {
            showDialogIfActive('เริ่มต้นไม่สำเร็จ', 'ไม่พบข้อมูลอุปกรณ์ กรุณากลับไปลองใหม่');
            return;
          }

          // BLE หลุด ให้เก็บ WiFi ไว้ก่อน แล้ว reconnect
          pendingProvisionRef.current = { ssid: finalSSID.trim(), password: finalPassword };
          setCurrentStep('provisioning');
          setProvisioningStatus('กำลังเชื่อมต่อกับอุปกรณ์อีกครั้ง...');
          setProvisioningStartedAt(null);

          await connectBLE(serialNumber, true);
          return;
        }

        // BLE พร้อมแล้ว
        // ถัดไปส่ง WiFi ผ่าน performProvision()
        await performProvision(finalSSID, finalPassword);
      };
      runProvision();
    },
    [
      _bleConnected,
      connectBLE,
      isFlowActive,
      performProvision,
      serialNumber,
      setProvisioningStartedAt,
      setProvisioningStatus,
      showDialogIfActive,
    ],
  );

  useEffect(() => {
    if (currentStep !== 'provisioning' || !provisioningStartedAt) return;

    // ถ้ารอนานเกินกำหนด ให้ถือว่าตั้งค่า WiFi ไม่สำเร็จ
    const timer = setTimeout(() => {
      if (provisioningTimeoutHandledRef.current || currentStepRef.current !== 'provisioning') {
        return;
      }

      handleProvisioningTerminalFailure(
        wifiConnectedViaBleRef.current
          ? 'ยืนยันอุปกรณ์ออนไลน์ไม่สำเร็จ'
          : 'เชื่อมต่อ WiFi ไม่สำเร็จ',
      );
    }, PROVISIONING_ONLINE_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [currentStep, handleProvisioningTerminalFailure, provisioningStartedAt]);

  const handleNetworkSelect = useCallback(
    (network: WiFiNetwork) => {
      Keyboard.dismiss();

      selectedNetworkRef.current = network;
      setSelectedNetwork(network);
      setSsid(network.SSID);
      ssidRef.current = network.SSID;

      const isSecured = wifiScannerService.isSecured(network);

      Logger.debug('[WiFi] Selected network', {
        ssid: network.SSID,
        capabilities: network.capabilities,
        isSecured,
      });

      if (isSecured) {
        // ถ้า WiFi มีรหัสผ่าน ให้ไปหน้ากรอกรหัสผ่าน
        currentStepRef.current = 'wifi-password';
        setCurrentStep('wifi-password');
        return;
      }

      // ถ้าเป็น WiFi แบบเปิด ให้เริ่ม provisioning ได้เลย
      setPassword('');
      passwordRef.current = '';
      void handleProvision(network.SSID, '');
    },
    [handleProvision],
  );

  const handleManualInput = useCallback(() => {
    // ผู้ใช้เลือกกรอก WiFi เอง
    Keyboard.dismiss();
    selectedNetworkRef.current = null;
    setSelectedNetwork(null);
    setSsid('');
    setPassword('');
    ssidRef.current = '';
    passwordRef.current = '';
    currentStepRef.current = 'wifi-password';
    setCurrentStep('wifi-password');
  }, []);

  const handleSsidChange = useCallback((value: string) => {
    // Ref ใช้เก็บค่าล่าสุดตอนส่งจริง, State ใช้แสดงใน input
    ssidRef.current = value;
    setSsid(value);
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    // Ref ใช้เก็บค่าล่าสุดตอนส่งจริง, State ใช้แสดงใน input
    passwordRef.current = value;
    setPassword(value);
  }, []);

  const handleComplete = useCallback(() => {
    if (from === 'device-info') {
      router.dismissTo('/(features)/(device)/device-info');
      return;
    }

    if (from === 'pairing') {
      router.replace('/(features)/(device)/device-info');
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(features)/(device)/device-info');
    }
  }, [from]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (currentStep === 'success') {
      // แสดง success สั้น ๆ แล้วค่อยกลับไปหน้ารายละเอียดอุปกรณ์
      timeout = setTimeout(() => {
        handleComplete();
      }, 1500);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [currentStep, handleComplete]);

  const handleOpenBluetoothSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('App-Prefs:root=Bluetooth');
    } else {
      Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
    }
  };

  const renderBluetoothCheck = () => (
    <View className="flex-1 justify-center items-center px-6">
      <View className="mb-6">
        <MaterialSymbol name="bluetooth" size={64} color="#3B82F6" />
      </View>

      <KanitText weight="medium" className="text-gray-900 text-xl text-center mb-2">
        เปิด Bluetooth ก่อนเริ่มตั้งค่า
      </KanitText>

      <KanitText className="text-gray-600 text-sm text-center mb-6 px-4">
        ต้องเปิด Bluetooth ก่อนจึงจะเชื่อมต่ออุปกรณ์ได้
      </KanitText>

      <PrimaryButton
        title="เปิด Bluetooth"
        onPress={handleOpenBluetoothSettings}
        style={{ width: '100%' }}
      />

      <KanitText className="text-gray-400 text-sm text-center mt-6">
        เมื่อเปิดแล้ว ระบบจะเชื่อมต่อให้โดยอัตโนมัติ
      </KanitText>
    </View>
  );

  const renderContent = () => {
    switch (currentStep) {
      case 'initializing':
        return (
          <View className="flex-1 justify-center items-center px-6">
            <ModernSpinner size={48} />
            <KanitText weight="medium" className="text-gray-900 text-xl mt-6 text-center">
              กำลังเตรียมการ...
            </KanitText>
          </View>
        );

      case 'bluetooth-check':
        return renderBluetoothCheck();

      case 'ble-connecting':
        return (
          <View className="flex-1 justify-center items-center px-6">
            <ModernSpinner size={48} />
            <KanitText weight="medium" className="text-gray-900 text-xl mt-6 text-center">
              กำลังค้นหาอุปกรณ์...
            </KanitText>

            <KanitText className="text-gray-500 text-center mt-8 px-8">
              กรุณานำโทรศัพท์ไปใกล้ๆ กับอุปกรณ์ของคุณ
            </KanitText>
          </View>
        );

      case 'wifi-scanning':
      case 'wifi-list':
        return (
          <View className="flex-1">
            <KanitText weight="medium" className="text-[22px] text-gray-900 mb-2">
              เลือก WiFi
            </KanitText>
            <KanitText className="text-gray-500 text-sm mb-2">
              เลือก WiFi ที่ต้องการให้อุปกรณ์เชื่อมต่อ
            </KanitText>
            <KanitText className="text-amber-700 text-sm mb-6">
              อุปกรณ์รองรับเฉพาะเครือข่าย 2.4 GHz
            </KanitText>

            {isScanning && wifiNetworks.length === 0 ? (
              <View className="flex-1 justify-center items-center">
                <ModernSpinner size={48} />
                <KanitText weight="medium" className="text-gray-900 text-lg mt-6 text-center">
                  กำลังค้นหาเครือข่าย WiFi...
                </KanitText>
                <KanitText className="text-gray-500 text-sm mt-2 text-center">
                  กรุณารอสักครู่
                </KanitText>
              </View>
            ) : (
              <WiFiNetworkList
                networks={wifiNetworks}
                isScanning={isScanning}
                onNetworkSelect={handleNetworkSelect}
                onScanAgain={startWiFiScan}
                onManualInput={handleManualInput}
              />
            )}
          </View>
        );

      case 'wifi-password':
        return (
          <View className="flex-1">
            <KanitText weight="medium" className="text-[22px] text-gray-900 mb-2">
              {selectedNetwork ? 'กรอกรหัสผ่าน' : 'กรอกข้อมูล WiFi'}
            </KanitText>
            <KanitText className="text-gray-500 text-sm mb-6">
              {selectedNetwork
                ? `ใส่รหัสผ่าน WiFi สำหรับ "${selectedNetwork.SSID}"`
                : 'กรอกชื่อเครือข่ายและรหัสผ่านด้วยตนเอง'}
            </KanitText>

            {!selectedNetwork && (
              <FloatingLabelInput
                label="ชื่อเครือข่าย (SSID)"
                value={ssid}
                onChangeText={handleSsidChange}
                autoCorrect={false}
                autoCapitalize="none"
              />
            )}

            <FloatingLabelInput
              label="รหัสผ่าน WiFi"
              value={password}
              onChangeText={handlePasswordChange}
              isPassword
              autoCorrect={false}
              autoCapitalize="none"
              textContentType="password"
            />

            <View className="mt-2">
              <PrimaryButton title="เชื่อมต่อ" onPress={() => void handleProvision()} />
            </View>
          </View>
        );

      case 'provisioning':
      case 'success':
        return (
          <View className="flex-1 justify-center items-center px-6">
            {currentStep === 'provisioning' ? (
              <>
                <ModernSpinner size={48} />
                <KanitText weight="medium" className="text-gray-900 text-xl mt-6 text-center">
                  กำลังตรวจสอบการเชื่อมต่อ...
                </KanitText>
                <KanitText className="text-gray-500 text-center mt-3">
                  {provisioningStatus}
                </KanitText>

                <View className="w-full mt-8 px-4">
                  <View className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${Math.min(95, (provisioningElapsedMs / PROVISIONING_ONLINE_TIMEOUT_MS) * 100)}%`,
                      }}
                    />
                  </View>
                  <KanitText className="text-gray-400 text-xs text-center mt-2">
                    {Math.floor(provisioningElapsedMs / 1000)}s /{' '}
                    {PROVISIONING_ONLINE_TIMEOUT_MS / 1000}s
                  </KanitText>
                </View>

                <KanitText className="text-gray-400 text-xs text-center mt-6 px-8">
                  อุปกรณ์จะส่งสัญญาณกลับมาเมื่อเชื่อมต่อสำเร็จ
                </KanitText>
              </>
            ) : (
              <>
                <View className="w-32 h-32 bg-green-100 rounded-full items-center justify-center mb-6">
                  <MaterialIconSolid name="check_circle" size={80} color="#10B981" />
                </View>
                <KanitText weight="medium" className="text-gray-900 text-2xl text-center mb-2">
                  สำเร็จ!
                </KanitText>
                <KanitText className="text-gray-600 text-center">
                  ตั้งค่า WiFi เรียบร้อยแล้ว{'\n'}อุปกรณ์จะเริ่มเชื่อมต่อในไม่ช้า
                </KanitText>
                <KanitText className="text-gray-500 text-center mt-4">
                  รอสักครู่ กำลังกลับไปหน้าข้อมูลอุปกรณ์...
                </KanitText>
                <View className="mt-4">
                  <ModernSpinner size={20} />
                </View>
              </>
            )}
          </View>
        );

      case 'provisioning-failed':
        return <View className="flex-1 bg-white" />;

      default:
        return null;
    }
  };

  return (
    <ScreenWrapper
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 24 + navBarInset,
      }}
      edges={['top', 'left', 'right']}
      useScrollView={true}
      scrollViewProps={{
        bounces: false,
        overScrollMode: 'never',
        showsVerticalScrollIndicator: false,
      }}
      header={
        <ScreenHeader
          title={from === 'pairing' ? 'ตั้งค่า WiFi' : 'ตั้งค่า WiFi ใหม่'}
          onBack={
            currentStep === 'provisioning' || currentStep === 'success'
              ? undefined
              : () => {
                  if (currentStep === 'wifi-password' || currentStep === 'wifi-manual-input') {
                    runAfterKeyboardDismiss(
                      () => {
                        // ถ้าอยู่หน้ากรอก WiFi ให้กลับไปหน้า list WiFi หลังคีย์บอร์ดปิดแล้ว
                        selectedNetworkRef.current = null;
                        setSelectedNetwork(null);
                        setSsid('');
                        setPassword('');
                        ssidRef.current = '';
                        passwordRef.current = '';
                        currentStepRef.current = 'wifi-list';
                        setCurrentStep('wifi-list');
                      },
                      {
                        waitAfterHideMs: 100,
                        maxWaitMs: 300,
                      },
                    );
                  } else {
                    Keyboard.dismiss();

                    // ถ้าอยู่ step อื่น ให้ออกจาก flow นี้
                    void handleExit();
                  }
                }
          }
        />
      }
    >
      <View className="flex-1 mt-4 mb-8">{renderContent()}</View>
    </ScreenWrapper>
  );
}
