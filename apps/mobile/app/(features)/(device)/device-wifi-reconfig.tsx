/**
 * Device WiFi Reconfig Screen
 *
 * หน้านี้ใช้เปลี่ยน WiFi ให้อุปกรณ์ที่ยังออนไลน์อยู่
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - สแกน WiFi รอบตัวให้ผู้ใช้เลือก
 * - หรือให้ผู้ใช้กรอก SSID เอง
 * - ส่ง SSID และ Password ไปที่ Backend
 * - Backend จะส่งคำสั่งต่อไปยังอุปกรณ์
 * - หน้านี้รอเช็กว่าอุปกรณ์กลับมาออนไลน์ด้วย WiFi ใหม่หรือไม่
 * - ถ้าสำเร็จ จะกลับไปหน้ารายละเอียดอุปกรณ์
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Keyboard } from 'react-native';
import { ModernSpinner } from '../../../components/ModernSpinner';
import { MaterialIconSolid } from '../../../components/MaterialIconSolid';
import { useMutation } from '@tanstack/react-query';

import KanitText from '../../../components/KanitText';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { FloatingLabelInput } from '../../../components/FloatingLabelInput';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { WiFiNetworkList } from '../../../components/WiFiNetworkList';

import { configureWifi, getDeviceConfig } from '../../../services/deviceService';
import { wifiScannerService } from '../../../services/wifiScannerService';
import { safeRouter as router } from '../../../utils/safeRouter';
import { showErrorMessage } from '../../../utils/errorHelper';
import { showDialog } from '../../../utils/dialogService';
import Logger from '../../../utils/logger';
import { useAppSearchParams } from '../../../utils/searchParams';
import { getWifiCredentialValidationError } from '../../../utils/formValidation';
import { runAfterKeyboardDismiss } from '../../../utils/keyboard';

import { useNavBarInset } from '../../../hooks/useNavBarInset';
import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { useDeviceSetupStore } from '../../../store/useDeviceSetupStore';
import { useSensorStore } from '../../../store/useSensorStore';

import type { WiFiNetwork } from '../../../services/wifiScannerService';
import type { WifiStatus } from '../../../services/types';

// เวลาสูงสุดที่รอให้อุปกรณ์ยืนยันว่าเปลี่ยน WiFi สำเร็จ
const VERIFY_TIMEOUT_MS = 25_000;

// ข้อความ progress ที่แสดงระหว่างรออุปกรณ์เปลี่ยน WiFi
const VERIFY_STATUS_STAGES: { afterMs: number; message: string }[] = [
  { afterMs: 0, message: 'กำลังส่งคำสั่งไปยังอุปกรณ์...' },
  { afterMs: 4_000, message: 'อุปกรณ์กำลังรีสตาร์ทเพื่อทดสอบ WiFi ใหม่...' },
  { afterMs: 10_000, message: 'กำลังตรวจสอบการเชื่อมต่อ...' },
  { afterMs: 18_000, message: 'หากเชื่อมต่อไม่ได้ อุปกรณ์จะกลับไปใช้ WiFi เดิม...' },
  { afterMs: 23_000, message: 'รอสัญญาณยืนยันจากระบบอีกสักครู่...' },
];

const getVerifyStageMessage = (elapsedMs: number): string => {
  // เลือกข้อความ progress ตามเวลาที่ผ่านไป
  const stages = [...VERIFY_STATUS_STAGES].reverse();
  const matched = stages.find((s) => elapsedMs >= s.afterMs);

  return matched?.message ?? VERIFY_STATUS_STAGES[0]?.message ?? '';
};

export default function DeviceWifiReconfigScreen() {
  // เพิ่มระยะด้านล่าง ไม่ให้ input หรือปุ่มชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // อ่าน params ที่ถูกส่งมาจาก device-info หรือ device-wifi-setup
  const searchParams = useAppSearchParams();

  // deviceCode ใช้เรียก API ตั้งค่า WiFi ของอุปกรณ์
  const deviceCode = searchParams.getStringOrEmpty('deviceCode');

  // โหลดข้อมูลผู้สูงอายุและอุปกรณ์ปัจจุบัน
  const { data: elderInfo } = useCurrentElder();

  // อ่านสถานะ realtime ของอุปกรณ์จาก store
  const {
    isConnected: deviceOnline,
    lastStatusUpdate,
    lastHeartUpdate,
    currentSSID,
  } = useSensorStore();

  // step ใช้ควบคุมว่า UI ตอนนี้อยู่ช่วงไหน
  const [step, setStep] = useState<'scan' | 'manual' | 'password' | 'verifying' | 'success'>(
    'scan',
  );

  // รายการ WiFi ที่สแกนได้ และ WiFi ที่ผู้ใช้เลือก
  const [isScanning, setIsScanning] = useState(true);
  const [networks, setNetworks] = useState<WiFiNetwork[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<WiFiNetwork | null>(null);

  // State ใช้แสดงค่าใน input, Ref ใช้เก็บค่าล่าสุดตอนส่งจริง
  const [customSSID, setCustomSSID] = useState('');
  const [password, setPassword] = useState('');
  const customSSIDRef = useRef('');
  const passwordRef = useRef('');

  // สถานะและ progress ตอนกำลังรอยืนยันผลการเปลี่ยน WiFi
  const [verifyStatus, setVerifyStatus] = useState<WifiStatus | null>(null);
  const [verifyStatusMessage, setVerifyStatusMessage] = useState('');
  const [verifyElapsedMs, setVerifyElapsedMs] = useState(0);

  // เวลาที่เริ่มส่งคำสั่งเปลี่ยน WiFi
  const verifyStartedAtRef = useRef<number | null>(null);

  // ใช้ดูว่าอุปกรณ์ออนไลน์อยู่ก่อนเริ่มเปลี่ยน WiFi หรือไม่
  const verifyOnlineAtStartRef = useRef(false);

  // เก็บ SSID เป้าหมายไว้ตรวจว่าหลังเปลี่ยนแล้ว อุปกรณ์อยู่ WiFi ที่ถูกต้องหรือไม่
  const targetSSIDRef = useRef<string>('');

  // Timer ที่ใช้ polling และ timeout ระหว่างรอผล
  const verifyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // กัน success/fail ทำงานซ้ำหลายรอบจากหลายแหล่ง เช่น socket + polling
  const hasCompletedRef = useRef(false);

  const clearTimers = useCallback(() => {
    // ล้าง timer ทั้งหมดที่เกี่ยวกับการ verify
    if (verifyIntervalRef.current) clearInterval(verifyIntervalRef.current);
    if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
    if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
  }, []);

  useEffect(() => {
    if (!elderInfo?.id || !elderInfo?.device?.id) return;

    // ตั้งค่า store เพื่อให้ realtime/socket รู้ว่าต้องติดตาม elder/device ตัวไหน
    useDeviceSetupStore.getState().setElderConfig(elderInfo.id, elderInfo.device.id);
  }, [elderInfo?.device?.id, elderInfo?.id]);

  const handleCustomSSIDChange = useCallback((value: string) => {
    // Ref ใช้เก็บค่าล่าสุดตอนส่งจริง, State ใช้แสดงใน input
    customSSIDRef.current = value;
    setCustomSSID(value);
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    // Ref ใช้เก็บค่าล่าสุดตอนส่งจริง, State ใช้แสดงใน input
    passwordRef.current = value;
    setPassword(value);
  }, []);

  const finishProcess = useCallback(
    (isSuccess: boolean) => {
      // กันการจบ flow ซ้ำ
      if (hasCompletedRef.current) return;

      hasCompletedRef.current = true;
      clearTimers();
      verifyStartedAtRef.current = null;

      if (isSuccess) {
        // เปลี่ยน WiFi สำเร็จ
        setStep('success');
      } else {
        // เปลี่ยน WiFi ไม่สำเร็จ ให้ผู้ใช้ลองใหม่จากหน้ากรอกรหัสเดิม
        Keyboard.dismiss();
        setPassword('');
        passwordRef.current = '';

        showDialog(
          'เชื่อมต่อไม่สำเร็จ',
          'รหัสผ่าน WiFi อาจไม่ถูกต้อง\nกรุณาตรวจสอบและลองใหม่อีกครั้ง',
          [
            {
              text: 'ตกลง',
              style: 'cancel',
              onPress: () => {
                setStep(selectedNetwork ? 'password' : 'manual');
              },
            },
          ],
        );
      }
    },
    [clearTimers, selectedNetwork],
  );

  useEffect(() => {
    if (step !== 'verifying') {
      if (verifyTimerRef.current) {
        clearInterval(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }

      setVerifyElapsedMs(0);
      return;
    }

    // เริ่มจับเวลาเมื่อเข้าสู่หน้า verifying
    verifyStartedAtRef.current = Date.now();
    setVerifyStatusMessage(VERIFY_STATUS_STAGES[0]?.message ?? '');

    verifyTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - (verifyStartedAtRef.current ?? Date.now());
      setVerifyElapsedMs(elapsed);
      setVerifyStatusMessage(getVerifyStageMessage(elapsed));
    }, 1000);

    return () => {
      if (verifyTimerRef.current) {
        clearInterval(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }
    };
  }, [step]);

  useEffect(() => {
    if (step !== 'success') return;

    // แสดงหน้าสำเร็จสั้น ๆ แล้วกลับไปหน้ารายละเอียดอุปกรณ์
    const timeout = setTimeout(() => router.dismissTo('/(features)/(device)/device-info'), 1500);

    return () => clearTimeout(timeout);
  }, [step]);

  useEffect(() => {
    if (step !== 'verifying') return;

    const startedAt = verifyStartedAtRef.current;
    if (!startedAt) return;

    // รอให้อุปกรณ์มีเวลาทดสอบ WiFi ใหม่ก่อน
    // ช่วงแรกอาจมี heartbeat เก่าค้างอยู่ จึงยังไม่สรุปผลทันที
    if (Date.now() - startedAt < 10000) return;

    if (!deviceOnline) return;

    const lastStatusMs = lastStatusUpdate?.getTime() ?? 0;
    const lastHeartMs = lastHeartUpdate?.getTime() ?? 0;
    const lastActivityMs = Math.max(lastStatusMs, lastHeartMs);

    // ต้องเป็นสัญญาณใหม่หลังเริ่มเปลี่ยน WiFi แล้วเท่านั้น
    if (lastActivityMs < startedAt + 5000) return;

    if (currentSSID && currentSSID !== targetSSIDRef.current) {
      // อุปกรณ์กลับมาออนไลน์ แต่ SSID ไม่ตรงกับที่ตั้งไว้
      // ถือว่าเปลี่ยน WiFi ไม่สำเร็จหรือ rollback กลับ WiFi เดิม
      Logger.warn('[WiFi] Device came online but SSID mismatch. Triggering failure early.');
      finishProcess(false);
    } else {
      // realtime ยืนยันว่าอุปกรณ์กลับมาออนไลน์แล้ว
      finishProcess(true);
    }
  }, [currentSSID, deviceOnline, finishProcess, lastHeartUpdate, lastStatusUpdate, step]);

  const startVerification = useCallback(() => {
    // เริ่มรอยืนยันผลหลังส่งคำสั่งเปลี่ยน WiFi ไป Backend แล้ว
    setStep('verifying');
    hasCompletedRef.current = false;
    verifyStartedAtRef.current = Date.now();
    verifyOnlineAtStartRef.current = deviceOnline;

    const verifyStatusOnce = async () => {
      try {
        // ตรวจสถานะอุปกรณ์จาก Backend
        // ไฟล์ถัดไป: services/deviceService.ts
        const device = await getDeviceConfig(deviceCode);

        if (device?.wifiStatus) setVerifyStatus(device.wifiStatus);

        const lastOnlineMs = device.lastOnline ? Date.parse(device.lastOnline) : 0;
        const startedAt = verifyStartedAtRef.current ?? 0;
        const hasFreshBackendOnline = lastOnlineMs >= startedAt;
        const wasOfflineAtStart = !verifyOnlineAtStartRef.current;

        if (device?.wifiStatus === 'CONNECTED' && (wasOfflineAtStart || hasFreshBackendOnline)) {
          if (currentSSID && currentSSID !== targetSSIDRef.current) {
            // Backend บอกว่า connected แต่ SSID จาก realtime ไม่ตรง
            Logger.warn('[WiFi] SSID mismatch, possible rollback');
            finishProcess(false);
          } else {
            finishProcess(true);
          }
        }
      } catch (_e) {
        Logger.warn('Status verification error');
      }
    };

    // เช็กทันที 1 ครั้ง แล้วค่อย polling ต่อ
    verifyStatusOnce();

    // polling backend ซ้ำระหว่างรอผล
    verifyIntervalRef.current = setInterval(verifyStatusOnce, 1500);

    // ถ้ารอเกินเวลาที่กำหนด ให้ถือว่าไม่สำเร็จ
    verifyTimeoutRef.current = setTimeout(() => finishProcess(false), VERIFY_TIMEOUT_MS);
  }, [currentSSID, deviceCode, deviceOnline, finishProcess]);

  const scanWiFi = useCallback(async () => {
    setIsScanning(true);

    // ดึงสถานะล่าสุดจาก Backend เพื่อให้ข้อมูล WiFi/status ทันขึ้น
    // ไฟล์ถัดไป: services/deviceService.ts
    void getDeviceConfig(deviceCode).then((device) => {
      if (device?.wifiStatus) setVerifyStatus(device.wifiStatus);
    });

    // โหลด WiFi จาก Cache เพื่อให้ผู้ใช้เห็นรายการและไอคอนความแรง WiFi ทันที (Instant Render)
    try {
      const cachedResult = await wifiScannerService.loadCachedNetworks();
      if (cachedResult.networks && cachedResult.networks.length > 0) {
        setNetworks(cachedResult.networks);
      }
    } catch (e) {
      Logger.warn('[WiFi] Failed to load cached networks:', e);
    }

    try {
      // สแกนหา WiFi รอบตัวแบบสด (Fresh scan) ใน background เพื่อผลลัพธ์ที่อัปเดตที่สุด
      // ไฟล์ถัดไป: services/wifiScannerService.ts
      const result = await wifiScannerService.scanNetworks();

      setNetworks(result.networks || []);
    } catch (_e) {
      Logger.error('WiFi scan error');
    } finally {
      setIsScanning(false);
    }
  }, [deviceCode]);

  // จัดการขั้นตอนส่งคำสั่งเปลี่ยน WiFi ไป Backend
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const configMutation = useMutation({
    mutationFn: (data: { ssid: string; wifiPassword: string }) => {
      // ส่ง WiFi credential ไปบันทึก/สั่งงานอุปกรณ์ผ่าน Backend
      // ไฟล์ถัดไป: services/deviceService.ts
      return configureWifi(deviceCode, data);
    },
    onSuccess: startVerification,
    onError: (error) => {
      // ส่งคำสั่งไป Backend ไม่สำเร็จ ให้กลับหน้า scan
      setStep('scan');
      showErrorMessage('ไม่สามารถส่งคำสั่งได้', error);
    },
  });

  const handleNetworkSelect = (network: WiFiNetwork) => {
    Keyboard.dismiss();

    if (currentSSID && network.SSID === currentSSID) {
      // ถ้าเลือก WiFi เดิมที่อุปกรณ์ใช้อยู่แล้ว ไม่ต้องตั้งค่าใหม่
      showDialog(
        'เครือข่ายปัจจุบัน',
        `อุปกรณ์กำลังเชื่อมต่อกับ "${network.SSID}" อยู่แล้ว คุณไม่จำเป็นต้องตั้งค่าใหม่`,
        [{ text: 'ตกลง', style: 'cancel' }],
      );
      return;
    }

    const isSecured = wifiScannerService.isSecured(network);

    setSelectedNetwork(network);

    if (isSecured) {
      // ถ้า WiFi มีรหัสผ่าน ให้ไปหน้ากรอกรหัสผ่าน
      setPassword('');
      passwordRef.current = '';
      setStep('password');
    } else {
      // ถ้าเป็น WiFi แบบเปิด ให้ส่งคำสั่งเปลี่ยน WiFi ได้เลย
      targetSSIDRef.current = network.SSID;

      // เริ่มส่งคำสั่งเปลี่ยน WiFi
      // ถัดไปไปที่ configMutation ด้านบน
      configMutation.mutate({ ssid: network.SSID, wifiPassword: '' });
    }
  };

  const handleConnect = () => {
    if (configMutation.isPending) return;

    let targetSSID = '';
    const latestCustomSSID = customSSIDRef.current;
    const latestPassword = passwordRef.current;

    if (step === 'manual') {
      // กรณีกรอกชื่อ WiFi เอง
      targetSSID = latestCustomSSID.trim();
    } else if (step === 'password') {
      // กรณีเลือก WiFi จาก list แล้วมากรอกรหัสผ่าน
      if (!selectedNetwork) return;

      targetSSID = selectedNetwork.SSID;
    }

    const wifiValidationError = getWifiCredentialValidationError({
      ssid: targetSSID,
      password: latestPassword,
      requiresPassword: true,
    });
    if (wifiValidationError) {
      showDialog(wifiValidationError.title, wifiValidationError.message);
      return;
    }

    Keyboard.dismiss();
    const runProvision = () => {
      // เก็บ SSID เป้าหมายไว้เทียบผลหลังอุปกรณ์กลับมาออนไลน์
      targetSSIDRef.current = targetSSID;

      // เริ่มส่งคำสั่งเปลี่ยน WiFi
      // ถัดไปไปที่ configMutation ด้านบน
      configMutation.mutate({ ssid: targetSSID, wifiPassword: latestPassword });
    };
    runProvision();
  };

  const handleBack = () => {
    if (step === 'verifying' || step === 'success') return;

    if (step === 'password' || step === 'manual') {
      runAfterKeyboardDismiss(
        () => {
          // ถ้าอยู่หน้ากรอกข้อมูล WiFi ให้กลับไปหน้า scan หลังคีย์บอร์ดปิดแล้ว
          setStep('scan');
          setPassword('');
          passwordRef.current = '';
          setCustomSSID('');
          customSSIDRef.current = '';
          setSelectedNetwork(null);
        },
        {
          waitAfterHideMs: 100,
          maxWaitMs: 300,
        },
      );
    } else {
      Keyboard.dismiss();

      // ถ้าอยู่หน้า scan ให้ย้อนกลับหน้าก่อนหน้า
      router.back();
    }
  };

  useEffect(() => {
    // เข้า screen แล้วเริ่มสแกน WiFi ทันที
    void scanWiFi();

    // ออกจากหน้าแล้วล้าง timer ทั้งหมด
    return clearTimers;
  }, [scanWiFi, clearTimers]);

  // ใช้ suppress unused warning เพราะ verifyStatus ถูกอัปเดตไว้สำหรับ polling/status ภายใน
  void verifyStatus;

  return (
    <ScreenWrapper
      useScrollView={step === 'password' || step === 'manual'}
      header={
        <ScreenHeader
          title="เปลี่ยน WiFi อุปกรณ์"
          {...(step !== 'verifying' && step !== 'success' ? { onBack: handleBack } : {})}
        />
      }
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: step === 'password' || step === 'manual' ? 24 + navBarInset : 0,
      }}
      edges={['top', 'left', 'right']}
      scrollViewProps={{
        bounces: false,
        overScrollMode: 'never',
        showsVerticalScrollIndicator: false,
      }}
    >
      <View className="flex-1">
        {step === 'verifying' ? (
          <View className="flex-1 justify-center items-center px-6">
            <ModernSpinner size={48} />

            <KanitText weight="medium" className="text-gray-900 text-xl mt-6 text-center">
              กำลังเปลี่ยนเครือข่าย WiFi...
            </KanitText>

            <KanitText className="text-gray-500 mt-2 text-center">{verifyStatusMessage}</KanitText>

            <View className="w-full mt-8 px-4">
              <View className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <View
                  className="h-full bg-green-500 rounded-full"
                  style={{
                    width: `${Math.min(95, (verifyElapsedMs / VERIFY_TIMEOUT_MS) * 100)}%`,
                  }}
                />
              </View>

              <KanitText className="text-gray-400 text-xs text-center mt-2">
                {Math.floor(verifyElapsedMs / 1000)}s / {VERIFY_TIMEOUT_MS / 1000}s
              </KanitText>
            </View>

            <KanitText className="text-gray-400 text-xs text-center mt-6 px-8">
              อุปกรณ์จะส่งสัญญาณกลับมาเมื่อเชื่อมต่อสำเร็จ
            </KanitText>
          </View>
        ) : step === 'success' ? (
          <View className="flex-1 justify-center items-center">
            <View className="w-32 h-32 bg-green-100 rounded-full items-center justify-center mb-6">
              <MaterialIconSolid name="check_circle" size={80} color="#10B981" />
            </View>

            <KanitText weight="medium" className="text-gray-900 text-2xl text-center mb-2">
              สำเร็จ!
            </KanitText>

            <KanitText className="text-gray-600 text-center">
              เปลี่ยนเครือข่าย WiFi เรียบร้อยแล้ว{'\n'}อุปกรณ์กำลังเชื่อมต่อเครือข่ายใหม่
            </KanitText>

            <KanitText className="text-gray-500 text-center mt-4">
              รอสักครู่ กำลังกลับไปหน้าข้อมูลอุปกรณ์...
            </KanitText>

            <View className="mt-4">
              <ModernSpinner size={20} />
            </View>
          </View>
        ) : step === 'scan' ? (
          <>
            <KanitText weight="medium" className="text-gray-900 text-[22px] mb-2">
              เลือก WiFi
            </KanitText>

            <KanitText className="text-gray-500 text-sm mb-2">
              เลือก WiFi เครือข่ายใหม่ที่ต้องการให้อุปกรณ์เปลี่ยนไปเชื่อมต่อ
            </KanitText>

            <KanitText className="text-amber-700 text-sm mb-6">
              อุปกรณ์รองรับเฉพาะเครือข่าย 2.4 GHz
            </KanitText>

            {/* แสดงหน้าจอค้นหาแบบเต็มถ้ากำลังสแกนและยังไม่มีข้อมูลเครือข่ายใน Cache */}
            {/* แต่หากมีข้อมูลใน Cache แล้ว จะแสดงรายชื่อ WiFi ทันที (Instant Render) เพื่อให้ไอคอนความแรงแสดงผลอย่างรวดเร็ว */}
            {isScanning && networks.length === 0 ? (
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
                networks={networks}
                isScanning={isScanning}
                onNetworkSelect={handleNetworkSelect}
                onScanAgain={scanWiFi}
                currentSSID={currentSSID ?? undefined}
                onManualInput={() => {
                  Keyboard.dismiss();
                  // ผู้ใช้เลือกกรอก WiFi เอง
                  setStep('manual');
                  setSelectedNetwork(null);
                  setCustomSSID('');
                  customSSIDRef.current = '';
                  setPassword('');
                  passwordRef.current = '';
                }}
              />
            )}
          </>
        ) : (
          <>
            <KanitText weight="medium" className="text-[22px] text-gray-900 mb-2">
              {step === 'manual' ? 'กรอกข้อมูล WiFi' : 'กรอกรหัสผ่าน'}
            </KanitText>

            <KanitText className="text-gray-500 text-sm mb-6">
              {step === 'manual'
                ? 'กรอกชื่อเครือข่ายและรหัสผ่านด้วยตนเอง'
                : `ใส่รหัสผ่าน WiFi สำหรับ "${selectedNetwork?.SSID}"`}
            </KanitText>

            {step === 'manual' && (
              <FloatingLabelInput
                label="ชื่อ WiFi (SSID)"
                value={customSSID}
                onChangeText={handleCustomSSIDChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            <FloatingLabelInput
              label="รหัสผ่าน WiFi"
              value={password}
              onChangeText={handlePasswordChange}
              isPassword
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
            />

            <View className="mt-2">
              <PrimaryButton
                title="ยืนยันการตั้งค่า"
                onPress={handleConnect}
                loading={configMutation.isPending}
              />
            </View>
          </>
        )}
      </View>
    </ScreenWrapper>
  );
}
