/**
 * Step 3 - WiFi Setup Screen
 *
 * หน้านี้ใช้ตั้งค่า WiFi ให้อุปกรณ์ผ่าน BLE
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลอุปกรณ์ที่ผูกไว้จาก Step 2
 * - ตรวจสิทธิ์ Bluetooth และ Location
 * - เชื่อมต่อ ESP32 ผ่าน BLE
 * - สแกน WiFi รอบตัวให้ผู้ใช้เลือก
 * - ส่ง SSID และ Password ไปให้อุปกรณ์
 * - รอให้อุปกรณ์ออนไลน์ แล้วไปหน้า Saved Success
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  AppState,
  Linking,
  Platform,
  Keyboard,
  TextInput as NativeTextInput,
} from 'react-native';
import { ModernSpinner } from '../../components/ModernSpinner';
import { StatusBar } from 'expo-status-bar';
import { MaterialSymbol } from '../../components/MaterialSymbol';
import { MaterialIconSolid } from '../../components/MaterialIconSolid';
import { useQueryClient } from '@tanstack/react-query';

import KanitText from '../../components/KanitText';
import { WizardLayout } from '../../components/WizardLayout';
import { FloatingLabelInput } from '../../components/FloatingLabelInput';
import { runAfterKeyboardDismiss } from '../../utils/keyboard';
import { PrimaryButton } from '../../components/PrimaryButton';
import { WiFiNetworkList } from '../../components/WiFiNetworkList';

import Logger from '../../utils/logger';
import { BLEProvisioningStatus, BLEState, State, bleService } from '../../services/bleService';
import { wifiScannerService, WiFiNetwork } from '../../services/wifiScannerService';
import { showDialog } from '../../utils/dialogService';
import { getCurrentElder } from '../../services/elderService';
import { requestBLEPermissions, checkBLEPermissions } from '../../utils/blePermissions';
import { safeRouter as router } from '../../utils/safeRouter';
import { getWiFiProvisioningFailureMessage } from '../../utils/wifiProvisioningMessages';
import { getWifiCredentialValidationError } from '../../utils/formValidation';
import { getDeviceConfig } from '../../services/deviceService';
import {
  setSetupStep,
  getSetupSerialNumber,
  setSetupElderId,
  setSetupDeviceId,
  setSetupSerialNumber,
  getSetupElderId,
  getSetupDeviceId,
  clearSetupTransientForCurrentUser,
} from '../../utils/setupStorage';

import { useDeviceSetupStore } from '../../store/useDeviceSetupStore';
import { useSensorStore } from '../../store/useSensorStore';
import { useNavBarInset } from '../../hooks/useNavBarInset';

// State หลักของหน้านี้
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

// เวลาสูงสุดที่รอให้อุปกรณ์ออนไลน์หลังส่ง WiFi
const PROVISIONING_ONLINE_TIMEOUT_MS = 30_000;

// จำนวนครั้งที่รออ่านสถานะ BLE ให้คงที่
const BLE_STATE_SETTLE_ATTEMPTS = 4;
const BLE_STATE_SETTLE_DELAY_MS = 300;

// ข้อความสถานะที่แสดงระหว่างกำลังตั้งค่า WiFi
const PROVISIONING_STATUS_STAGES: { afterMs: number; message: string }[] = [
  { afterMs: 0, message: 'กำลังส่งข้อมูล WiFi ให้อุปกรณ์...' },
  { afterMs: 4_000, message: 'อุปกรณ์กำลังพยายามเชื่อมต่อ WiFi...' },
  { afterMs: 12_000, message: 'กำลังรอผลการเชื่อมต่อจากอุปกรณ์...' },
  { afterMs: 24_000, message: 'หากเชื่อมต่อไม่สำเร็จ ระบบจะเตรียมให้ลองใหม่...' },
  { afterMs: 28_000, message: 'รอให้อุปกรณ์พร้อมสำหรับการลองอีกครั้ง...' },
];

const INITIAL_PROVISIONING_STATUS_MESSAGE = PROVISIONING_STATUS_STAGES[0]?.message ?? '';

// สถานะที่ถือว่าจบการตั้งค่าแล้ว แต่เป็นฝั่งไม่สำเร็จ
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

type TimeoutRef = React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
type IntervalRef = React.MutableRefObject<ReturnType<typeof setInterval> | null>;

const clearTimeoutRef = (timeoutRef: TimeoutRef): void => {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
};

const clearIntervalRef = (intervalRef: IntervalRef): void => {
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
};

export default function Step3WifiSetupScreen() {
  const queryClient = useQueryClient();

  // เพิ่มระยะด้านล่าง ไม่ให้ input หรือปุ่มชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // อ่านสถานะอุปกรณ์จาก socket/store
  // ใช้เช็กว่าอุปกรณ์ออนไลน์หลังส่ง WiFi สำเร็จหรือยัง
  const { isConnected: deviceOnline, lastStatusUpdate, lastHeartUpdate } = useSensorStore();

  // currentStep ใช้เปลี่ยน UI ทั้งหน้าใน renderContent()
  const [currentStep, setCurrentStep] = useState<SetupStep>('initializing');

  // เก็บ serial number ของอุปกรณ์ไว้ใช้ค้นหา BLE
  const [_deviceCode, setDeviceCode] = useState<string>('');

  const appState = useRef(AppState.currentState);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref กลุ่มนี้ใช้กันการทำงานซ้ำ เช่น connect ซ้ำ หรือ cleanup ซ้ำ
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
  const lastSelectedSSIDRef = useRef<string | null>(null);
  const lastKnownPhoneSSIDRef = useRef<string | null>(null);
  const pendingExternalWifiReturnRef = useRef(false);

  // State ใช้แสดงค่าใน input, Ref ใช้เก็บค่าล่าสุดตอนส่งจริง
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const ssidRef = useRef('');
  const passwordRef = useRef('');
  const passwordInputRef = useRef<NativeTextInput>(null);

  // State สำหรับแสดงความคืบหน้าระหว่างส่ง WiFi ให้อุปกรณ์
  const [_isProvisioning, setIsProvisioning] = useState(false);
  const [_provisioningStatus, setProvisioningStatus] = useState<string>('');
  const [provisioningStartedAt, setProvisioningStartedAt] = useState<number | null>(null);
  const [provisioningElapsedMs, setProvisioningElapsedMs] = useState<number>(0);

  // ใช้แยกว่าอุปกรณ์ออนไลน์ก่อนเริ่มส่ง WiFi อยู่แล้วหรือเพิ่งออนไลน์หลังส่ง
  const provisioningOnlineAtStartRef = useRef(false);

  // กัน timeout handler ทำงานซ้ำ
  const provisioningTimeoutHandledRef = useRef(false);
  const wifiConnectedViaBleRef = useRef(false);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const provisioningTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isFlowActive = useCallback((): boolean => !isExitingRef.current, []);

  const clearScanTimer = useCallback((): void => {
    clearTimeoutRef(scanTimerRef);
  }, []);

  const stopPolling = useCallback((): void => {
    clearIntervalRef(pollingIntervalRef);
  }, []);

  const completeProvisioningSuccess = useCallback((logMessage?: string): void => {
    if (logMessage) {
      Logger.info(logMessage);
    }

    // บังคับซ่อนแป้นพิมพ์ทันทีก่อนสลับเป็นหน้าความสำเร็จ เพื่อความปลอดภัยสูงสุด
    Keyboard.dismiss();

    setProvisioningStatus('เชื่อมต่อสำเร็จ!');
    setIsProvisioning(false);
    setProvisioningStartedAt(null);
    provisioningTimeoutHandledRef.current = true;
    setCurrentStep('success');
  }, []);

  const showDialogIfActive = useCallback(
    (...args: Parameters<typeof showDialog>) => {
      if (!isFlowActive()) return;
      showDialog(...args);
    },
    [isFlowActive],
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
    let previousState = await bleService.getState();

    for (let attempt = 0; attempt < BLE_STATE_SETTLE_ATTEMPTS; attempt += 1) {
      await wait(BLE_STATE_SETTLE_DELAY_MS);
      const nextState = await bleService.getState();

      if (nextState === State.PoweredOn || nextState === previousState) {
        return nextState;
      }

      previousState = nextState;
    }

    return previousState;
  }, []);

  const resetProvisioningState = useCallback((): void => {
    setIsProvisioning(false);
    setProvisioningStartedAt(null);
    setProvisioningStatus('');
    provisioningTimeoutHandledRef.current = true;
  }, []);

  const getProvisioningStageMessage = (elapsedMs: number): string => {
    const stages = [...PROVISIONING_STATUS_STAGES].reverse();
    const matched = stages.find((s) => elapsedMs >= s.afterMs);
    return matched?.message ?? INITIAL_PROVISIONING_STATUS_MESSAGE;
  };

  useEffect(() => {
    if (!provisioningStartedAt) {
      clearIntervalRef(provisioningTimerRef);
      setProvisioningElapsedMs(0);
      return;
    }

    // ระหว่าง provisioning ให้อัปเดต progress และข้อความสถานะทุก 1 วินาที
    const startProvisioningTimer = () => {
      provisioningTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - provisioningStartedAt;
        setProvisioningElapsedMs(elapsed);
        setProvisioningStatus(getProvisioningStageMessage(elapsed));
      }, 1000);
    };

    startProvisioningTimer();

    return () => {
      clearIntervalRef(provisioningTimerRef);
    };
  }, [provisioningStartedAt]);

  // เก็บ currentStep ล่าสุดไว้ใน Ref
  // callback ที่ถูกสร้างไว้ก่อนหน้าจะได้อ่าน step ล่าสุดได้
  const currentStepRef = useRef(currentStep);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    selectedNetworkRef.current = selectedNetwork;
  }, [selectedNetwork]);

  useEffect(() => {
    // เมื่อเข้าหน้านี้ ให้บันทึกว่า Setup อยู่ Step 3
    setSetupStep('3').catch(() => {
      // ถ้าบันทึกไม่ได้ ยังให้ flow ทำงานต่อได้
    });
  }, []);

  useEffect(() => {
    if (!provisioningStartedAt || currentStep === 'success') return;
    if (!deviceOnline) return;

    const lastStatusMs = lastStatusUpdate?.getTime() ?? 0;
    const lastHeartMs = lastHeartUpdate?.getTime() ?? 0;
    const lastActivityMs = Math.max(lastStatusMs, lastHeartMs);

    const hasFreshUpdate = lastActivityMs >= provisioningStartedAt;
    const wasOfflineAtStart = !provisioningOnlineAtStartRef.current;

    if (wasOfflineAtStart || hasFreshUpdate) {
      completeProvisioningSuccess('Device online after provisioning. Completing Step 3.');
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
    if (currentStep !== 'provisioning' || !provisioningStartedAt) {
      stopPolling();
      return;
    }

    // ถ้า socket ไม่อัปเดต ให้ poll backend เป็นตัวสำรอง
    const startDelay = setTimeout(async () => {
      const deviceId = await getSetupDeviceId();
      if (!deviceId) return;

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
          // ตรวจสถานะอุปกรณ์จาก Backend
          // ไฟล์ถัดไป: services/deviceService.ts
          const device = await getDeviceConfig(deviceId);

          const lastOnlineMs = device.lastOnline ? Date.parse(device.lastOnline) : 0;
          const hasFreshBackendOnline = lastOnlineMs >= provisioningStartedAt;
          const wasOfflineAtStart = !provisioningOnlineAtStartRef.current;

          if (device?.wifiStatus === 'CONNECTED' && (wasOfflineAtStart || hasFreshBackendOnline)) {
            stopPolling();
            completeProvisioningSuccess(
              '[Step3 Fallback] Device wifiStatus=CONNECTED via polling -> completing',
            );
          }
        } catch (err) {
          Logger.warn('[Step3 Fallback] Polling error:', err);
        }
      }, 3000);
    }, 5000);

    return () => {
      clearTimeout(startDelay);
      stopPolling();
    };
  }, [completeProvisioningSuccess, currentStep, provisioningStartedAt, stopPolling]);

  const handleExit = useCallback(
    async (navigate = true) => {
      if (isExitingRef.current) return;
      isExitingRef.current = true;

      clearScanTimer();
      stopPolling();

      try {
        // ออกจากหน้านี้แล้วต้องหยุด BLE scan และ disconnect
        bleService.stopScan();
        await bleService.disconnect();
      } catch (error) {
        Logger.error('BLE cleanup error:', error);
      }

      if (navigate) {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(setup)/step2-device-pairing');
        }
      }
    },
    [clearScanTimer, stopPolling],
  );

  const handleProvisioningTerminalFailure = useCallback(
    (message: string) => {
      if (!isFlowActive()) return;

      const wifiConnectedViaBle = wifiConnectedViaBleRef.current;

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
  const connectBLERef = useRef<(serialNumber: string, silent?: boolean) => Promise<void>>(
    async () => {},
  );
  const initializeRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const checkBluetoothAndInitializeRef = useRef<(state: BLEState) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const reconcileExternalWifiReturnRef = useRef<() => Promise<boolean>>(async () => false);

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

      const connectedSSID = await wifiScannerService.getCurrentSSID();

      if (isFlowActive()) {
        lastKnownPhoneSSIDRef.current = connectedSSID ?? null;
      }

      // โหลด WiFi จาก Cache เพื่อให้ผู้ใช้เห็นรายการและไอคอนความแรง WiFi ทันที (Instant Render)
      try {
        const cachedResult = await wifiScannerService.loadCachedNetworks();
        if (isFlowActive() && cachedResult.networks && cachedResult.networks.length > 0) {
          setWifiNetworks(cachedResult.networks);
          setCurrentStep('wifi-list');
        }
      } catch (e) {
        Logger.warn('[WiFi] Failed to load cached networks in Step 3:', e);
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
          pendingExternalWifiReturnRef.current = false;
          lastSelectedSSIDRef.current = null;
          currentStepRef.current = 'wifi-password';
          setCurrentStep('wifi-password');
        };

        showDialogIfActive('ไม่พบเครือข่าย WiFi', 'ต้องการทำอะไรต่อ?', [
          { text: 'สแกนอีกครั้ง', onPress: () => startWiFiScan() },
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

  const reconcileExternalWifiReturn = useCallback(async (): Promise<boolean> => {
    if (!pendingExternalWifiReturnRef.current) return false;
    if (currentStepRef.current !== 'wifi-password') return false;

    const previousSSID = lastKnownPhoneSSIDRef.current;
    const selectedSSID = lastSelectedSSIDRef.current ?? selectedNetworkRef.current?.SSID ?? null;
    const connectedSSID = await wifiScannerService.getCurrentSSID();

    if (!isFlowActive()) return false;

    const normalizedSSID = connectedSSID?.trim() || null;
    const phoneWifiChanged = !!normalizedSSID && normalizedSSID !== previousSSID;
    const returnedToSelectedNetwork =
      !!normalizedSSID && !!selectedSSID && normalizedSSID === selectedSSID;

    if (!phoneWifiChanged && !returnedToSelectedNetwork) return false;

    Logger.info('[WiFi] Returned from external WiFi screen, reopening network list', {
      previousSSID,
      phoneSSID: normalizedSSID,
      selectedSSID,
    });

    pendingExternalWifiReturnRef.current = false;
    lastSelectedSSIDRef.current = null;
    lastKnownPhoneSSIDRef.current = normalizedSSID;

    selectedNetworkRef.current = null;
    currentStepRef.current = 'wifi-list';
    setSelectedNetwork(null);
    setPassword('');
    passwordRef.current = '';

    setCurrentStep('wifi-list');
    void startWiFiScan();
    return true;
  }, [isFlowActive, startWiFiScan]);

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
          wifiConnectedViaBleRef.current = true;
          completeProvisioningSuccess();
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
    [
      completeProvisioningSuccess,
      deviceOnline,
      handleProvisioningTerminalFailure,
      isFlowActive,
      setProvisioningStatus,
      setProvisioningStartedAt,
    ],
  );

  const handleBLEDeviceFound = useCallback(
    async (deviceId: string) => {
      try {
        // เชื่อมต่ออุปกรณ์ BLE ที่เจอ
        // ไฟล์ถัดไป: services/bleService.ts
        const connected = await bleService.connectToDevice(deviceId);
        if (!isFlowActive()) return;

        if (connected) {
          setBleConnected(true);
          Logger.info('BLE connected successfully');

          isConnectingRef.current = false;

          if (pendingProvisionRef.current) {
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
        } else {
          Logger.warn('BLE connection rejected or dropped by device');
          isConnectingRef.current = false;

          showDialogIfActive(
            'เชื่อมต่อไม่สำเร็จ',
            'ยังเชื่อมต่ออุปกรณ์ไม่ได้ กรุณาลองปิด-เปิดอุปกรณ์ก่อน แล้วค่อยลองใหม่อีกครั้ง',
            [
              { text: 'ลองอีกครั้ง', onPress: () => connectBLERef.current(_deviceCode) },
              { text: 'ยกเลิก', style: 'cancel', onPress: () => void handleExitRef.current() },
            ],
          );
        }
      } catch (error) {
        if (!isFlowActive()) return;

        isConnectingRef.current = false;
        Logger.error('BLE device connection error:', error);

        if (pendingProvisionRef.current) {
          pendingProvisionRef.current = null;
          setIsProvisioning(false);
          setCurrentStep('wifi-password');
        }

        showDialogIfActive(
          'เชื่อมต่อไม่สำเร็จ',
          'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
          [
            { text: 'ลองอีกครั้ง', onPress: () => connectBLERef.current(_deviceCode) },
            { text: 'ยกเลิก', style: 'cancel', onPress: () => void handleExitRef.current() },
          ],
        );
      }
    },
    [isFlowActive, showDialogIfActive, startWiFiScan, _deviceCode, performProvision],
  );

  const connectBLE = useCallback(
    async (serialNumber: string, silent = false) => {
      if (isExitingRef.current || isConnectingRef.current) return;

      isConnectingRef.current = true;

      if (!silent) setCurrentStep('ble-connecting');

      try {
        clearScanTimer();

        // ใช้เลขท้ายของ serial number เพื่อหาอุปกรณ์ BLE ตัวที่ต้องการ
        const shortId = serialNumber.substring(serialNumber.length - 6);
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

            clearScanTimer();

            // เจออุปกรณ์แล้ว
            // ถัดไปไปที่ handleBLEDeviceFound()
            handleBLEDeviceFound(device.id);
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
                { text: 'ลองอีกครั้ง', onPress: () => connectBLE(serialNumber) },
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
    [clearScanTimer, handleBLEDeviceFound, isFlowActive, showDialogIfActive],
  );

  const initialize = useCallback(async () => {
    if (_bleConnected) return;
    if (isInitializingRef.current) return;

    isInitializingRef.current = true;

    try {
      // โหลด serial number ที่บันทึกจาก Step 2
      let savedSerialNumber = await getSetupSerialNumber();

      if (!savedSerialNumber) {
        try {
          // ถ้า local storage หาย ให้ลองกู้ข้อมูลจาก elder ปัจจุบัน
          // ไฟล์ถัดไป: services/elderService.ts
          const elder = await getCurrentElder();
          const device = elder?.device;

          if (elder?.id && device?.id && device.serialNumber) {
            await setSetupElderId(String(elder.id));
            await setSetupDeviceId(String(device.id));
            await setSetupSerialNumber(device.serialNumber);
            await setSetupStep('3');

            savedSerialNumber = device.serialNumber;

            Logger.info('Recovered setup data from backend', {
              elderId: elder.id,
              deviceId: device.id,
            });
          }
        } catch (recoverError) {
          Logger.warn('Failed to recover setup data from backend', recoverError);
        }
      }

      const elderId = await getSetupElderId();
      const deviceId = await getSetupDeviceId();

      if (elderId && deviceId) {
        // ตั้งค่า store เพื่อให้ socket รู้ว่าต้องติดตาม elder/device ตัวไหน
        useDeviceSetupStore.getState().setElderConfig(elderId, deviceId);
      }

      if (!savedSerialNumber) {
        showDialogIfActive('เริ่มต้นไม่สำเร็จ', 'ไม่พบข้อมูลอุปกรณ์ กรุณาเริ่มต้นใหม่', [
          {
            text: 'กลับไปขั้นตอนที่ 2',
            onPress: () => router.replace('/(setup)/step2-device-pairing'),
          },
          { text: 'ยกเลิก', style: 'cancel' },
        ]);
        return;
      }

      setDeviceCode(savedSerialNumber);
      Logger.info('Serial Number:', savedSerialNumber);

      const lastStatusMs = lastStatusUpdate?.getTime() ?? 0;
      const lastHeartMs = lastHeartUpdate?.getTime() ?? 0;
      const lastActivityMs = Math.max(lastStatusMs, lastHeartMs);
      const isRecentlyOnline = deviceOnline && Date.now() - lastActivityMs < 15000;

      if (isRecentlyOnline && elderId && deviceId) {
        // ถ้าอุปกรณ์ออนไลน์อยู่แล้ว ไม่ต้องตั้งค่า WiFi ซ้ำ
        setCurrentStep('success');
        return;
      }

      // ตรวจสิทธิ์ BLE และ Location
      // ไฟล์ถัดไป: utils/blePermissions.ts
      const hasPermissions = await checkBLEPermissions();

      if (!hasPermissions) {
        permissionRequestInProgressRef.current = true;

        // ขอสิทธิ์ที่ต้องใช้กับ BLE
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
      await connectBLE(savedSerialNumber);
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
    deviceOnline,
    getSettledBLEState,
    isFlowActive,
    lastHeartUpdate,
    lastStatusUpdate,
    showPermissionRequiredDialog,
    showDialogIfActive,
  ]);

  const checkBluetoothAndInitialize = useCallback(async (state: BLEState) => {
    try {
      if (permissionRequestInProgressRef.current) return;

      if (state === State.PoweredOn) {
        // Bluetooth เปิดแล้ว
        // ถัดไปเริ่ม initialize()
        initializeRef.current();
      } else if (state === State.PoweredOff) {
        if (currentStepRef.current === 'initializing') {
          initializeRef.current();
          return;
        }

        setCurrentStep('bluetooth-check');
      }
    } catch (error) {
      Logger.error('Error checking Bluetooth status:', error);
    }
  }, []);

  useEffect(() => {
    connectBLERef.current = connectBLE;
    initializeRef.current = initialize;
    checkBluetoothAndInitializeRef.current = checkBluetoothAndInitialize;
    reconcileExternalWifiReturnRef.current = reconcileExternalWifiReturn;
  }, [connectBLE, initialize, checkBluetoothAndInitialize, reconcileExternalWifiReturn]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        Logger.info('App has come to the foreground!');

        const check = async () => {
          // ถ้าผู้ใช้กลับมาจากหน้า WiFi ของระบบ ให้คืนไปหน้า list ก่อน ไม่ส่งรหัสให้อุปกรณ์เอง
          const handledExternalWifiReturn = await reconcileExternalWifiReturnRef.current();
          if (handledExternalWifiReturn) return;

          // กลับมาจาก background แล้วเช็ก Bluetooth ใหม่
          const state = await bleService.getState();
          checkBluetoothAndInitializeRef.current(state);
        };

        check();
      }

      appState.current = nextAppState;
    });

    const check = async () => {
      // เข้า Step 3 ครั้งแรก ให้เช็ก Bluetooth ทันที
      const state = await bleService.getState();
      checkBluetoothAndInitializeRef.current(state);
    };

    check();

    const bleSubscription = bleService.onStateChange((state) => {
      // ถ้า Bluetooth เปิด/ปิดระหว่างอยู่หน้านี้ ให้จัดการใหม่
      checkBluetoothAndInitializeRef.current(state);
    });

    return () => {
      subscription.remove();
      bleSubscription.remove();

      // ออกจากหน้าแล้ว cleanup BLE
      handleExitRef.current(false);
    };
  }, []);

  const handleComplete = useCallback(async () => {
    try {
      // โหลดข้อมูล elder ใหม่เมื่อเข้า Dashboard หลัง setup เสร็จ
      const { queryKeys } = await import('../../hooks/queryKeys');
      await queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });

      await setSetupStep('complete');

      // ล้างข้อมูลชั่วคราวของ Setup Flow
      await clearSetupTransientForCurrentUser();

      router.replace('/(setup)/saved-success');
    } catch (err) {
      Logger.error('Error clearing setup data:', err);
      router.replace('/(setup)/saved-success');
    }
  }, [queryClient]);

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

      // ใช้ runAfterKeyboardDismiss เพื่อให้คีย์บอร์ดปิดลงเสร็จสมบูรณ์ก่อนเริ่มเชื่อมต่อและสลับสถานะ
      // ป้องกันปัญหาคีย์บอร์ดลอยค้างบน Android เมื่อ Input ถูก Unmount ระหว่างทาง
      Keyboard.dismiss();
      const runProvision = async () => {
        // เช็กว่า BLE ยังเชื่อมต่ออยู่หรือไม่
        // ไฟล์ถัดไป: services/bleService.ts
        const actualConnected = await bleService.isConnected();

        if (!isFlowActive()) return;

        if (actualConnected && !_bleConnected) {
          setBleConnected(true);
        }

        if (!actualConnected) {
          if (!_deviceCode) {
            showDialogIfActive('เริ่มต้นไม่สำเร็จ', 'ไม่พบข้อมูลอุปกรณ์ กรุณากลับไปขั้นตอนที่ 2');
            return;
          }

          pendingExternalWifiReturnRef.current = false;

          // BLE หลุด ให้เก็บ WiFi ไว้ก่อน แล้ว reconnect
          pendingProvisionRef.current = { ssid: finalSSID.trim(), password: finalPassword };
          setCurrentStep('provisioning');
          setProvisioningStatus('กำลังเชื่อมต่อกับอุปกรณ์อีกครั้ง...');
          setProvisioningStartedAt(null);

          await connectBLE(_deviceCode, true);
          return;
        }

        // BLE พร้อมแล้ว
        // ถัดไปส่ง WiFi ผ่าน performProvision()
        pendingExternalWifiReturnRef.current = false;
        await performProvision(finalSSID, finalPassword);
      };
      runProvision();
    },
    [
      _bleConnected,
      _deviceCode,
      connectBLE,
      isFlowActive,
      performProvision,
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

      if (isSecured) {
        // ถ้า WiFi มีรหัสผ่าน ให้ไปหน้ากรอกรหัส
        pendingExternalWifiReturnRef.current = true;
        lastSelectedSSIDRef.current = network.SSID;
        currentStepRef.current = 'wifi-password';
        setCurrentStep('wifi-password');
        return;
      }

      // ถ้าเป็น WiFi แบบเปิด ให้ส่งค่าได้เลย
      pendingExternalWifiReturnRef.current = false;
      setPassword('');
      passwordRef.current = '';
      handleProvision(network.SSID, '');
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
    pendingExternalWifiReturnRef.current = false;
    lastSelectedSSIDRef.current = null;
    currentStepRef.current = 'wifi-password';
    setCurrentStep('wifi-password');
  }, []);

  const handleSsidChange = useCallback((value: string) => {
    ssidRef.current = value;
    setSsid(value);
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    passwordRef.current = value;
    setPassword(value);
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (currentStep === 'success') {
      // แสดงหน้าสำเร็จ 2 วินาที
      // ถัดไปไปที่ handleComplete()
      timeout = setTimeout(() => {
        handleComplete();
      }, 2000);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [currentStep, handleComplete]);

  const handleBack = async () => {
    if (currentStep === 'wifi-password') {
      runAfterKeyboardDismiss(
        () => {
          // ถ้าอยู่หน้ากรอกรหัส WiFi ให้กลับไปหน้า list WiFi หลังคีย์บอร์ดปิดแล้ว
          selectedNetworkRef.current = null;
          pendingExternalWifiReturnRef.current = false;
          lastSelectedSSIDRef.current = null;
          currentStepRef.current = 'wifi-list';
          setCurrentStep('wifi-list');
        },
        {
          waitAfterHideMs: 100,
          maxWaitMs: 300,
        },
      );
      return;
    }

    Keyboard.dismiss();

    await setSetupStep('2');

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(setup)/step2-device-pairing');
    }
  };

  const handleOpenBluetoothSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('App-Prefs:root=Bluetooth');
    } else {
      Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
    }
  };

  // ระหว่าง provisioning และ success ไม่ให้กดย้อนกลับ
  const canNavigateBack = currentStep !== 'provisioning' && currentStep !== 'success';

  const renderContent = () => {
    switch (currentStep) {
      case 'initializing':
      case 'ble-connecting':
        return (
          <View className="flex-1 justify-center items-center px-6">
            <ModernSpinner size={48} />
            <KanitText weight="medium" className="text-gray-900 text-xl mt-6 text-center">
              {currentStep === 'initializing' ? 'กำลังเตรียมการ...' : 'กำลังเชื่อมต่ออุปกรณ์...'}
            </KanitText>
            {currentStep === 'ble-connecting' && (
              <>
                <KanitText className="text-gray-500 text-center mt-3">
                  กรุณานำโทรศัพท์ไปใกล้ๆ กับอุปกรณ์
                </KanitText>
                <View className="bg-amber-50 p-3 rounded-lg mt-6 w-full max-w-sm flex-row items-start gap-2">
                  <MaterialSymbol
                    name="lightbulb"
                    size={18}
                    color="#B45309"
                    style={{ marginTop: 1 }}
                  />
                  <KanitText className="text-amber-800 text-sm flex-1">
                    หากหน้าจอนี้ค้างนาน แนะนำให้ลอง ปิด-เปิด สวิตช์ที่ตัวอุปกรณ์ใหม่อีกครั้ง
                  </KanitText>
                </View>
              </>
            )}
          </View>
        );

      case 'bluetooth-check':
        return (
          <View className="flex-1 justify-center items-center px-6">
            <MaterialSymbol name="bluetooth" size={64} color="#3B82F6" />
            <KanitText weight="medium" className="text-gray-900 text-xl text-center mb-2 mt-6">
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
                label="ชื่อ WiFi (SSID)"
                value={ssid}
                onChangeText={handleSsidChange}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />
            )}

            <FloatingLabelInput
              inputRef={passwordInputRef}
              label="รหัสผ่าน WiFi"
              value={password}
              onChangeText={handlePasswordChange}
              isPassword
              autoCorrect={false}
              autoCapitalize="none"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={() => handleProvision()}
            />

            <View className="mt-2">
              <PrimaryButton title="เชื่อมต่อ" onPress={() => handleProvision()} />
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
                {_provisioningStatus ? (
                  <KanitText className="text-gray-500 text-center mt-2">
                    {_provisioningStatus}
                  </KanitText>
                ) : null}

                <View className="w-11/12 mt-8 px-4">
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
                  <KanitText className="text-gray-400 text-xs text-center mt-4">
                    อุปกรณ์จะส่งสัญญาณกลับมาเมื่อเชื่อมต่อสำเร็จ
                  </KanitText>
                </View>
              </>
            ) : (
              <>
                <View className="w-28 h-28 bg-green-100 rounded-full items-center justify-center mb-6">
                  <MaterialIconSolid name="check_circle" size={64} color="#10B981" />
                </View>
                <KanitText weight="medium" className="text-gray-900 text-xl text-center">
                  เชื่อมต่อ WiFi แล้ว
                </KanitText>
                <KanitText className="text-gray-600 text-center mt-3">
                  อุปกรณ์ออนไลน์พร้อมใช้งาน
                </KanitText>
                <KanitText className="text-gray-500 text-center mt-4">
                  รอสักครู่ กำลังไปขั้นตอนถัดไป...
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
    <>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />
      <WizardLayout
        currentStep={3}
        title="ตั้งค่า WiFi"
        onBack={canNavigateBack ? handleBack : undefined}
        useScrollView={true}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 24 + navBarInset,
          flexGrow: 1,
        }}
        scrollViewProps={{
          bounces: false,
          overScrollMode: 'never',
          showsVerticalScrollIndicator: false,
        }}
      >
        <View className="flex-1 mt-2">{renderContent()}</View>
      </WizardLayout>
    </>
  );
}
