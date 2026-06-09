/**
 * Device Pairing Screen
 *
 * หน้านี้ใช้ผูกอุปกรณ์ใหม่จากหน้า Device Feature
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - ผู้ใช้สแกน QR Code หรือกรอกรหัสอุปกรณ์เอง
 * - ระบบตรวจว่ามีข้อมูลผู้สูงอายุอยู่หรือไม่
 * - ถ้าข้อมูลถูกต้อง จะผูกอุปกรณ์กับผู้สูงอายุ
 * - เมื่อผูกสำเร็จ จะพาไป flow ตั้งค่า WiFi ของอุปกรณ์
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Linking, Keyboard } from 'react-native';
import { ModernSpinner } from '../../../components/ModernSpinner';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialSymbol } from '../../../components/MaterialSymbol';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import KanitText from '../../../components/KanitText';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { FloatingLabelInput } from '../../../components/FloatingLabelInput';
import { PrimaryButton } from '../../../components/PrimaryButton';

import { pairDevice } from '../../../services/deviceService';
import { safeRouter as router } from '../../../utils/safeRouter';
import { showErrorMessage, getErrorMessage } from '../../../utils/errorHelper';
import { showDialog } from '../../../utils/dialogService';
import { useDeviceSetupStore } from '../../../store/useDeviceSetupStore';
import {
  getDeviceCodeValidationError,
  sanitizeDeviceCodeInput,
} from '../../../utils/formValidation';

import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { queryKeys } from '../../../hooks/queryKeys';
import { useNavBarInset } from '../../../hooks/useNavBarInset';
import { useDarkNavigationBarWhen } from '../../../hooks/useNavigationBar';

export default function DevicePairingScreen() {
  // ใช้จัดการ permission กล้องสำหรับสแกน QR Code
  const [permission, requestPermission] = useCameraPermissions();

  // เพิ่มระยะด้านล่าง ไม่ให้ปุ่มชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // ใช้จัดการ cache ของ React Query หลังผูกอุปกรณ์สำเร็จ
  const queryClient = useQueryClient();

  // ใช้สลับระหว่างหน้าสแกน QR และหน้ากรอกรหัสเอง
  const [showManualEntry, setShowManualEntry] = useState(false);

  // ควบคุมสถานะไฟฉาย
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);

  // เก็บรหัสอุปกรณ์ที่ผู้ใช้กรอกเอง
  const [macAddress, setMacAddress] = useState('');
  const macAddressRef = useRef('');

  // เก็บข้อมูลอุปกรณ์ที่ผูกสำเร็จแล้ว
  const [pairedDevice, setPairedDevice] = useState<{ serialNumber: string } | null>(null);

  // กันการสแกน QR ซ้ำ เพราะกล้องอาจอ่าน QR ได้หลายครั้งติดกัน
  const isScanning = useRef(false);

  // ใช้เช็กว่าหน้านี้ยัง mounted อยู่หรือไม่ ก่อนอัปเดต state
  const mountedRef = useRef(true);

  // เปลี่ยนสี Navigation Bar ให้เหมาะกับหน้ากล้องพื้นหลังสีดำ
  useDarkNavigationBarWhen(!showManualEntry);

  // ดึงข้อมูลผู้สูงอายุปัจจุบัน
  // ใช้ elderId ตอนผูกอุปกรณ์
  const { data: currentElder } = useCurrentElder();

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleRequestCameraPermission = useCallback(async () => {
    try {
      if (permission && !permission.granted) {
        if (!permission.canAskAgain) {
          // ถ้าขอ permission ผ่านแอปไม่ได้แล้ว ให้พาไป settings ของเครื่อง
          await Linking.openSettings();
        } else {
          // ขอ permission กล้องจากผู้ใช้
          await requestPermission();
        }
      }
    } catch (error) {
      showErrorMessage('เกิดข้อผิดพลาดในการขอสิทธิ์กล้อง', error);
    }
  }, [permission, requestPermission]);

  // จัดการขั้นตอนผูกอุปกรณ์ของหน้านี้
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const pairMutation = useMutation({
    mutationKey: ['pairDevice'],
    mutationFn: async (deviceCode: string) => {
      // ใช้ elderId ของผู้สูงอายุปัจจุบันในการผูกอุปกรณ์
      const elderId = currentElder?.id;

      if (!elderId) {
        throw new Error('ไม่พบข้อมูลผู้สูงอายุในระบบ กรุณาสร้างข้อมูลก่อนทำการผูกอุปกรณ์');
      }

      if (currentElder?.device?.deviceCode === deviceCode) {
        // ถ้าอุปกรณ์นี้ผูกอยู่แล้ว ให้ใช้ข้อมูลเดิมได้เลย
        return currentElder.device;
      }

      // เรียก service สำหรับผูกอุปกรณ์กับผู้สูงอายุ
      // ไฟล์ถัดไป: services/deviceService.ts
      return await pairDevice({ deviceCode, elderId });
    },
    onSuccess: (device) => {
      if (!mountedRef.current) return;

      // ผูกอุปกรณ์สำเร็จแล้ว เก็บ serialNumber ไว้ส่งต่อไปหน้า WiFi setup
      setPairedDevice({ serialNumber: device.serialNumber });

      if (currentElder) {
        // อัปเดต cache ทันที เพื่อให้หน้า device-info เห็นอุปกรณ์ใหม่เร็วขึ้น
        queryClient.setQueryData(queryKeys.currentElder(), { ...currentElder, device });
      }

      if (currentElder?.id) {
        // ตั้งค่า store เพื่อให้ realtime/socket รู้ว่าต้องติดตาม elder/device ตัวไหน
        useDeviceSetupStore.getState().setElderConfig(currentElder.id, device.id);
      }

      // ให้ข้อมูลผู้สูงอายุ refetch อีกครั้งเพื่อซิงก์กับ server
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });
    },
    onError: (error) => {
      if (!mountedRef.current) return;

      // เปิดให้สแกนใหม่ได้หลังเกิด error
      isScanning.current = false;

      const msg = getErrorMessage(error);

      // แยกประเภท error เพื่อแสดงข้อความที่ผู้ใช้เข้าใจง่าย
      const isNotFound = msg.includes('ไม่พบ') || msg.includes('404') || msg.includes('not found');
      const isAlreadyPaired =
        msg.includes('ถูกเชื่อมต่อ') ||
        msg.includes('ถูกผูก') ||
        msg.includes('409') ||
        msg.includes('already');

      if (isNotFound) {
        showDialog(
          'ไม่พบอุปกรณ์',
          'ไม่พบอุปกรณ์รหัสนี้ในระบบ\nกรุณาตรวจสอบรหัส 8 หลักให้ถูกต้องแล้วลองใหม่',
        );
      } else if (isAlreadyPaired) {
        showDialog(
          'อุปกรณ์ถูกใช้งานแล้ว',
          'อุปกรณ์นี้ถูกเชื่อมต่อกับบัญชีอื่นอยู่แล้ว\nหากเป็นอุปกรณ์ของคุณ กรุณายกเลิกการเชื่อมต่อจากบัญชีเดิมก่อน',
        );
      } else {
        showErrorMessage('ไม่สามารถผูกอุปกรณ์ได้', error);
      }
    },
  });

  const handleManualPairing = () => {
    Keyboard.dismiss();

    if (pairMutation.isPending) return;

    const latestDeviceCode = macAddressRef.current;

    // ตรวจรหัสอุปกรณ์ก่อนเริ่มผูกอุปกรณ์
    const deviceCodeError = getDeviceCodeValidationError(latestDeviceCode);
    if (deviceCodeError) {
      showDialog('ข้อมูลไม่ครบถ้วน', deviceCodeError);
      return;
    }

    // เริ่มผูกอุปกรณ์จากรหัสที่กรอกเอง
    // ถัดไปไปที่ pairMutation ด้านบน
    pairMutation.mutate(sanitizeDeviceCodeInput(latestDeviceCode));
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    // ถ้ากำลังผูกอุปกรณ์อยู่ ให้ข้ามผลสแกนใหม่ไปก่อน
    if (isScanning.current || pairMutation.isPending) return;

    isScanning.current = true;

    // เริ่มผูกอุปกรณ์จาก QR Code
    // ถัดไปไปที่ pairMutation ด้านบน
    pairMutation.mutate(data);
  };

  const handleBack = () => {
    Keyboard.dismiss();

    if (showManualEntry) {
      // ถ้าอยู่หน้ากรอกรหัสเอง ให้กลับไปหน้าสแกน QR
      setShowManualEntry(false);
      isScanning.current = false;
    } else if (pairedDevice) {
      // ถ้าผูกอุปกรณ์แล้ว ให้กลับไปหน้ารายละเอียดอุปกรณ์
      router.replace('/(features)/(device)/device-info');
    } else {
      // ถ้ายังไม่ผูกอุปกรณ์ ให้ย้อนกลับหน้าก่อนหน้า
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/dashboard');
      }
    }
  };

  useEffect(() => {
    if (pairedDevice && showManualEntry) {
      // ถ้าผูกสำเร็จตอนอยู่หน้ากรอกรหัสเอง ให้กลับไปแสดง success overlay
      setTimeout(() => setShowManualEntry(false), 0);
    }
  }, [pairedDevice, showManualEntry]);

  if (showManualEntry) {
    return (
      <ScreenWrapper
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 24 + navBarInset,
          flexGrow: 1,
        }}
        useScrollView
        keyboardAvoiding
        scrollViewProps={{
          bounces: false,
          overScrollMode: 'never',
          showsVerticalScrollIndicator: false,
        }}
        header={<ScreenHeader title="" onBack={handleBack} />}
      >
        <View className="flex-1">
          <KanitText weight="medium" className="text-gray-900 text-[28px] mb-2">
            กรอกรหัสอุปกรณ์
          </KanitText>
          <KanitText className="text-gray-500 text-base mb-6">
            กรุณากรอกรหัส 8 หลักที่แสดงบนตัวอุปกรณ์ของคุณเพื่อเริ่มต้นการเชื่อมต่อ
          </KanitText>

          {/* ตัวอย่างรหัสอุปกรณ์ เพื่อให้ผู้ใช้รู้ว่าต้องกรอกแบบไหน */}
          <View className="bg-gray-50 rounded-2xl p-4 mb-8 border border-gray-100">
            <KanitText className="text-gray-500 text-xs mb-1">รูปแบบรหัสอุปกรณ์:</KanitText>
            <KanitText weight="medium" className="text-gray-800 text-lg tracking-[2px]">
              ตัวอย่าง: 832CE051
            </KanitText>
          </View>

          <FloatingLabelInput
            label="รหัสอุปกรณ์ (Device Code)"
            value={macAddress}
            onChangeText={(t) => {
              const nextDeviceCode = sanitizeDeviceCodeInput(t);

              macAddressRef.current = nextDeviceCode;
              setMacAddress(nextDeviceCode);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            maxLength={8}
          />

          <View className="mt-8">
            {/* ปุ่มเริ่มผูกอุปกรณ์จากรหัสที่กรอกเอง */}
            <PrimaryButton
              title="ยืนยันรหัสอุปกรณ์"
              loading={pairMutation.isPending}
              disabled={pairMutation.isPending}
              onPress={handleManualPairing}
            />
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]}>
      <StatusBar style="light" />

      {/* เปิดกล้องเฉพาะเมื่อได้รับสิทธิ์ และยังไม่ได้ผูกอุปกรณ์ */}
      {permission?.granted && !pairedDevice && (
        <CameraView
          style={[StyleSheet.absoluteFill]}
          facing="back"
          enableTorch={isFlashlightOn}
          onBarcodeScanned={handleBarCodeScanned}
        />
      )}

      <View className="flex-1">
        <ScreenHeader transparent title="สแกนรหัสอุปกรณ์" onBack={handleBack} />

        <View className="flex-1 justify-between" style={{ paddingBottom: 40 + navBarInset }}>
          <View className="flex-1 items-center justify-center">
            {pairedDevice ? (
              <View key="pairing-success" className="items-center w-full px-6">
                <View className="w-24 h-24 rounded-full bg-[#16AD78] items-center justify-center mb-8">
                  <MaterialSymbol name="check" size={56} color="white" />
                </View>
                <KanitText weight="medium" className="text-white text-3xl text-center mb-3">
                  ผูกอุปกรณ์เรียบร้อยแล้ว
                </KanitText>
                <KanitText className="text-white text-lg text-center mb-10" style={styles.hintText}>
                  กดปุ่มด้านล่างเพื่อตั้งค่า Wi-Fi ให้อุปกรณ์
                </KanitText>
                <TouchableOpacity
                  onPress={() => {
                    // รีเฟรชข้อมูลอุปกรณ์ก่อนเข้าสู่ flow ตั้งค่า WiFi
                    queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });

                    // ไปหน้ากลางสำหรับเลือก flow ตั้งค่า WiFi
                    // ถัดไปไปที่ device-wifi-setup.tsx
                    router.replace({
                      pathname: '/(features)/(device)/device-wifi-setup',
                      params: { serialNumber: pairedDevice.serialNumber, from: 'pairing' },
                    });
                  }}
                  className="bg-white rounded-2xl py-4 w-full items-center"
                >
                  <KanitText weight="medium" className="text-green-600 text-lg">
                    ไปตั้งค่า Wi-Fi
                  </KanitText>
                </TouchableOpacity>
              </View>
            ) : !permission ? (
              <ModernSpinner key="camera-permission-loading" size={48} />
            ) : !permission.granted ? (
              <View key="camera-permission-required" className="items-center px-6">
                <KanitText className="text-white text-center mb-6 text-lg">
                  ต้องการสิทธิ์เข้าถึงกล้องเพื่อเริ่มทำการสแกน
                </KanitText>
                <TouchableOpacity
                  onPress={handleRequestCameraPermission}
                  className="bg-[#16AD78] px-8 py-3 rounded-full"
                  style={styles.permissionButton}
                  activeOpacity={0.8}
                >
                  <KanitText weight="medium" className="text-white text-base">
                    อนุญาตการเข้าถึงกล้อง
                  </KanitText>
                </TouchableOpacity>
              </View>
            ) : (
              <React.Fragment key="camera-scanner">
                {/* กรอบสแกน QR Code */}
                <View className="w-72 h-72 relative">
                  <View className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-[#16AD78] rounded-tl-2xl" />
                  <View className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-[#16AD78] rounded-tr-2xl" />
                  <View className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-[#16AD78] rounded-bl-2xl" />
                  <View className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-[#16AD78] rounded-br-2xl" />
                  <View
                    className="absolute top-1/2 left-4 right-4 h-[1px]"
                    style={styles.scanLine}
                  />
                </View>

                {/* คำแนะนำสำหรับการสแกน QR */}
                <View
                  className="mt-8 px-6 py-4 rounded-2xl border mx-6"
                  style={styles.scanHintCard}
                >
                  <KanitText weight="medium" className="text-white text-lg text-center">
                    สแกน QR Code
                  </KanitText>
                  <KanitText className="text-emerald-400 text-sm font-medium text-center mt-1">
                    กรุณาเปิดสวิตช์อุปกรณ์ให้ไฟติดก่อนสแกน
                  </KanitText>
                  <KanitText className="text-gray-300 text-xs text-center mt-1">
                    วาง QR Code ให้อยู่ในกรอบเพื่อเชื่อมต่อ
                  </KanitText>

                  {pairMutation.isError && (
                    <View className="mt-3 pt-3 border-t" style={styles.scanErrorDivider}>
                      <KanitText className="text-red-400 text-sm text-center">
                        ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่อีกครั้ง
                      </KanitText>
                    </View>
                  )}
                </View>
              </React.Fragment>
            )}
          </View>

          {!pairedDevice && (
            <View key="manual-entry-action" className="px-6 items-center">
              {/* ปุ่มเปิด/ปิดไฟฉาย */}
              {permission?.granted && (
                <TouchableOpacity
                  onPress={() => setIsFlashlightOn(!isFlashlightOn)}
                  className={`mb-6 flex-row items-center justify-center self-center px-6 py-3 rounded-full border ${
                    isFlashlightOn
                      ? 'bg-yellow-500/20 border-yellow-400/40'
                      : 'bg-white/10 border-white/20'
                  } backdrop-blur-md active:opacity-70`}
                >
                  <MaterialSymbol
                    name={isFlashlightOn ? 'flashlight_off' : 'flashlight_on'}
                    size={20}
                    color={isFlashlightOn ? '#FBBF24' : 'white'}
                  />
                  <KanitText
                    weight="medium"
                    className={`ml-2 text-sm ${isFlashlightOn ? 'text-yellow-400' : 'text-white'}`}
                  >
                    {isFlashlightOn ? 'ปิดไฟฉาย' : 'เปิดไฟฉาย'}
                  </KanitText>
                </TouchableOpacity>
              )}

              {/* ทางเลือกสำหรับกรอกรหัสอุปกรณ์เอง */}
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  isScanning.current = false;
                  pairMutation.reset();
                  setShowManualEntry(true);
                }}
                className="flex-row items-center px-8 py-4 rounded-full border"
                style={styles.manualEntryButton}
                activeOpacity={0.75}
              >
                <MaterialSymbol name="dialpad" size={20} color="white" />
                <KanitText weight="medium" className="text-white ml-3 text-base">
                  กรอกรหัสอุปกรณ์ด้วยตนเอง
                </KanitText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hintText: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  manualEntryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  permissionButton: {
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  scanErrorDivider: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scanHintCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scanLine: {
    backgroundColor: 'rgba(22, 173, 120, 0.3)',
  },
});
