/**
 * Step 2 - Device Pairing Screen
 *
 * หน้านี้ใช้ผูกอุปกรณ์กับผู้สูงอายุใน Setup Flow
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - ตรวจว่ามีอุปกรณ์ที่ผูกไว้แล้วหรือไม่
 * - ถ้ายังไม่มี ให้ผู้ใช้สแกน QR Code หรือกรอกรหัสอุปกรณ์เอง
 * - เมื่อตรวจรหัสสำเร็จ จะผูกอุปกรณ์กับผู้สูงอายุ
 * - ถ้าผูกสำเร็จ จะบันทึก deviceId และ serialNumber เพื่อใช้ใน Step 3
 * - ถ้ามีอุปกรณ์เดิมอยู่ ผู้ใช้สามารถไป Step 3 หรือเปลี่ยนอุปกรณ์ได้
 */

import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, AppState, Linking, Keyboard } from 'react-native';
import { ModernSpinner } from '../../components/ModernSpinner';
import { StatusBar } from 'expo-status-bar';
import { MaterialSymbol } from '../../components/MaterialSymbol';
import { useMutation } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';

import KanitText from '../../components/KanitText';
import { FloatingLabelInput } from '../../components/FloatingLabelInput';
import { PrimaryButton } from '../../components/PrimaryButton';
import { WizardLayout } from '../../components/WizardLayout';

import { pairDevice, unpairDevice } from '../../services/deviceService';
import { getCurrentElder } from '../../services/elderService';
import { showErrorMessage, getErrorMessage } from '../../utils/errorHelper';
import { showDialog } from '../../utils/dialogService';
import { safeRouter as router } from '../../utils/safeRouter';
import { getDeviceCodeValidationError, sanitizeDeviceCodeInput } from '../../utils/formValidation';
import {
  getSetupDeviceId,
  getSetupElderId,
  setSetupElderId,
  setSetupDeviceId,
  setSetupSerialNumber,
  clearSetupDeviceId,
  setSetupStep,
} from '../../utils/setupStorage';

import { useNavBarInset } from '../../hooks/useNavBarInset';
import { useDarkNavigationBarWhen } from '../../hooks/useNavigationBar';

export default function Step2DevicePairingScreen() {
  // ใช้จัดการ permission กล้องสำหรับสแกน QR Code
  const [permission, requestPermission] = useCameraPermissions();

  // เพิ่มระยะด้านล่าง ไม่ให้ปุ่มชน Navigation Bar ของเครื่อง
  const navBarInset = useNavBarInset();

  // ใช้สลับระหว่างหน้าสแกน QR และหน้ากรอกรหัสเอง
  const [showManualEntry, setShowManualEntry] = useState(false);

  // เปลี่ยนสี Navigation Bar ให้เหมาะกับหน้ากล้องพื้นหลังสีดำ
  useDarkNavigationBarWhen(!showManualEntry);

  // เก็บรหัสอุปกรณ์ที่ผู้ใช้กรอกเอง
  const [macAddress, setMacAddress] = useState('');

  // เก็บ deviceId ถ้ามีอุปกรณ์ที่ผูกไว้แล้ว
  const [existingDeviceId, setExistingDeviceId] = useState<string | null>(null);

  // กันการสแกน QR ซ้ำ เพราะกล้องอาจอ่าน QR ได้หลายครั้งติดกัน
  const isScanning = useRef(false);

  // ควบคุมสถานะไฟฉาย
  const [torchEnabled, setTorchEnabled] = useState(false);

  // กันการกดขอ permission กล้องซ้ำ ขณะที่ dialog ระบบยังเปิดอยู่
  const isRequestingCameraPermission = useRef(false);

  React.useEffect(() => {
    const checkExistingDevice = async () => {
      // ตรวจว่ามี deviceId ที่เคยบันทึกไว้จากการผูกอุปกรณ์หรือไม่
      const deviceId = await getSetupDeviceId();
      setExistingDeviceId(deviceId);
    };

    checkExistingDevice();
  }, []);

  const refreshDeviceStatus = React.useCallback(() => {
    // รีเซ็ตสถานะสแกน แล้วอ่าน deviceId ล่าสุดจาก setup storage
    isScanning.current = false;
    getSetupDeviceId().then(setExistingDeviceId);
  }, []);

  React.useEffect(() => {
    // เมื่อเข้าหน้านี้ ให้ดึงสถานะอุปกรณ์ล่าสุด
    refreshDeviceStatus();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // กลับมาจาก background แล้วอ่านสถานะใหม่
        // เช่น ผู้ใช้เพิ่งไปเปิด permission กล้องใน settings
        refreshDeviceStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshDeviceStatus]);

  const handleRequestCameraPermission = React.useCallback(async () => {
    if (isRequestingCameraPermission.current) return;

    isRequestingCameraPermission.current = true;

    try {
      if (permission && !permission.canAskAgain && !permission.granted) {
        // ถ้าขอ permission ผ่านแอปไม่ได้แล้ว ให้พาไปหน้า settings ของเครื่อง
        await Linking.openSettings();
      } else {
        // ขอ permission กล้องจากผู้ใช้
        await requestPermission();
      }
    } finally {
      isRequestingCameraPermission.current = false;
    }
  }, [permission, requestPermission]);

  // จัดการขั้นตอนผูกอุปกรณ์ของหน้านี้
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const pairMutation = useMutation({
    mutationFn: async (deviceCode: string) => {
      // อ่าน elderId ที่สร้างไว้จาก Step 1
      let elderId = await getSetupElderId();

      if (!elderId) {
        // ถ้า elderId ในเครื่องหาย ให้ลองกู้จากข้อมูลผู้สูงอายุปัจจุบัน
        // ไฟล์ถัดไป: services/elderService.ts
        const elder = await getCurrentElder();

        if (elder?.id) {
          elderId = String(elder.id);

          // บันทึก elderId กลับเข้า setup storage เพื่อใช้ต่อใน step ถัดไป
          await setSetupElderId(elderId);
        }
      }

      if (!elderId) throw new Error('ไม่พบข้อมูลผู้สูงอายุ กรุณากลับไปทำขั้นตอนที่ 1 ใหม่');

      // เรียก service สำหรับผูกอุปกรณ์กับผู้สูงอายุ
      // ไฟล์ถัดไป: services/deviceService.ts
      return await pairDevice({ deviceCode, elderId });
    },
    onSuccess: async (device) => {
      // ผูกอุปกรณ์สำเร็จแล้ว บันทึก deviceId ไว้ใช้ใน Step 3
      await setSetupDeviceId(String(device.id));
      setExistingDeviceId(String(device.id));
      setShowManualEntry(false);
      setTorchEnabled(false);

      if (device.serialNumber) {
        // serialNumber ใช้ใน Step 3 เพื่อค้นหาอุปกรณ์ผ่าน BLE
        await setSetupSerialNumber(device.serialNumber);
      }

      // บันทึกว่า Setup Flow พร้อมไป Step 3 แล้ว
      await setSetupStep('3');
    },
    onError: (error: unknown) => {
      // ถ้าผูกอุปกรณ์ไม่สำเร็จ ให้เปิดให้สแกนใหม่ได้
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
        showErrorMessage('ข้อผิดพลาด', error);
      }
    },
  });

  const handleManualPairing = async () => {
    Keyboard.dismiss();
    // ตรวจรหัสอุปกรณ์ก่อนเริ่มผูกอุปกรณ์
    const deviceCodeError = getDeviceCodeValidationError(macAddress);
    if (deviceCodeError) {
      showDialog('ข้อมูลไม่ครบถ้วน', deviceCodeError);
      return;
    }

    // เริ่มผูกอุปกรณ์จากรหัสที่กรอกเอง
    // ถัดไปไปที่ pairMutation ด้านบน
    pairMutation.mutate(sanitizeDeviceCodeInput(macAddress));
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    // ถ้ากำลังผูกอุปกรณ์อยู่ ให้ข้ามผลสแกนใหม่ไปก่อน
    if (isScanning.current || pairMutation.isPending) return;

    isScanning.current = true;

    let deviceCode = data;
    let serialNumber: string | undefined;

    try {
      // รองรับ QR แบบ JSON ที่มี deviceCode และ serialNumber
      const parsed = JSON.parse(data) as { deviceCode?: string; serialNumber?: string };

      if (parsed?.deviceCode) {
        deviceCode = parsed.deviceCode;
        serialNumber = parsed.serialNumber;
      }
    } catch (_error) {
      // ถ้าไม่ใช่ JSON ให้ใช้ data เป็น deviceCode ตรง ๆ
    }

    if (serialNumber) {
      // เก็บ serialNumber ไว้ใช้ใน Step 3 สำหรับค้นหา BLE
      setSetupSerialNumber(serialNumber).catch(() => {
        // ถ้าบันทึก serialNumber ไม่สำเร็จ ยังผูกอุปกรณ์ด้วย deviceCode ต่อได้
      });
    }

    // เริ่มผูกอุปกรณ์จาก QR Code
    // ถัดไปไปที่ pairMutation ด้านบน
    pairMutation.mutate(deviceCode);
  };

  const handleChangeDevice = async () => {
    showDialog('เปลี่ยนอุปกรณ์', 'ต้องการยกเลิกการผูกอุปกรณ์เดิมและเชื่อมต่ออุปกรณ์ใหม่หรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        style: 'destructive',
        onPress: async () => {
          try {
            if (existingDeviceId) {
              // เรียก service สำหรับยกเลิกการผูกอุปกรณ์เดิม
              // ไฟล์ถัดไป: services/deviceService.ts
              await unpairDevice({ deviceId: existingDeviceId });
            }

            // ล้างข้อมูลอุปกรณ์ใน setup storage เพื่อเริ่มผูกใหม่
            await clearSetupDeviceId();
            setExistingDeviceId(null);
            setMacAddress('');
            isScanning.current = false;
            pairMutation.reset();
            setShowManualEntry(false);
            setTorchEnabled(false);

            showDialog(
              'สำเร็จ',
              'ยกเลิกการผูกอุปกรณ์เดิมเรียบร้อยแล้ว (กรุณาปิดอุปกรณ์เดิม)\nตอนนี้คุณสามารถสแกนเชื่อมต่ออุปกรณ์ใหม่ได้เลย',
            );
          } catch (_error) {
            showDialog('ข้อผิดพลาด', 'ไม่สามารถยกเลิกการผูกอุปกรณ์ได้');
          }
        },
      },
    ]);
  };

  const handleBack = async () => {
    setTorchEnabled(false);
    if (showManualEntry) {
      // ถ้าอยู่หน้ากรอกรหัสเอง ให้กลับไปหน้าสแกน QR
      setShowManualEntry(false);
    } else {
      // ถ้าอยู่หน้าสแกน QR ให้ย้อนกลับไป Step 1
      await setSetupStep('1');

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(setup)/step1-elder-info');
      }
    }
  };

  if (showManualEntry && !existingDeviceId) {
    return (
      <WizardLayout
        currentStep={2}
        title="ติดตั้งอุปกรณ์"
        onBack={handleBack}
        useScrollView={!existingDeviceId}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24, flexGrow: 1 }}
        scrollViewProps={{
          bounces: false,
          overScrollMode: 'never',
          showsVerticalScrollIndicator: false,
        }}
      >
        <View className="mt-6">
          <KanitText weight="medium" className="text-[28px] text-gray-900 mb-2">
            กรอกรหัสอุปกรณ์
          </KanitText>
          <KanitText className="text-[15px] text-gray-500 mb-6">
            กรุณากรอกรหัส 8 หลักที่แสดงบนตัวอุปกรณ์ของคุณเพื่อเริ่มต้นการเชื่อมต่อ
          </KanitText>

          {/* ตัวอย่างรหัสอุปกรณ์ เพื่อให้ผู้ใช้รู้ว่าต้องกรอกแบบไหน */}
          <View className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100">
            <KanitText className="text-[13px] text-gray-500">รูปแบบรหัสอุปกรณ์:</KanitText>
            <KanitText
              weight="medium"
              style={{ letterSpacing: 2 }}
              className="text-lg text-gray-800 mt-1"
            >
              ตัวอย่าง: 832CE051
            </KanitText>
          </View>

          <View className="mb-6">
            <FloatingLabelInput
              label="รหัสอุปกรณ์ (Device Code)"
              value={macAddress}
              onChangeText={(text) => setMacAddress(sanitizeDeviceCodeInput(text))}
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>

          {/* ปุ่มเริ่มผูกอุปกรณ์จากรหัสที่กรอกเอง */}
          <PrimaryButton
            title="ยืนยันรหัสอุปกรณ์"
            loading={pairMutation.isPending}
            disabled={pairMutation.isPending}
            onPress={handleManualPairing}
          />
        </View>
      </WizardLayout>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]}>
      <StatusBar style="light" />

      {/* เปิดกล้องเฉพาะเมื่อได้รับสิทธิ์ และยังไม่มีอุปกรณ์ผูกอยู่ */}
      {permission?.granted && !existingDeviceId && (
        <CameraView
          style={[StyleSheet.absoluteFill]}
          facing="back"
          enableTorch={torchEnabled}
          onBarcodeScanned={handleBarCodeScanned}
        />
      )}

      <WizardLayout currentStep={2} title="ติดตั้งอุปกรณ์" onBack={handleBack} transparent={true}>
        <View className="flex-1">
          <View className="flex-1 justify-between px-6" style={{ paddingBottom: 40 + navBarInset }}>
            <View className="flex-1 items-center justify-center">
              {existingDeviceId ? (
                <View testID="qr-pairing-success" className="items-center w-full">
                  <View className="w-24 h-24 rounded-full bg-[#16AD78] items-center justify-center mb-8">
                    <MaterialSymbol name="check" size={56} color="white" />
                  </View>
                  <KanitText weight="medium" className="text-white text-3xl text-center mb-3">
                    ผูกอุปกรณ์เรียบร้อยแล้ว
                  </KanitText>
                  <KanitText className="text-white/90 text-lg text-center mb-10">
                    กดปุ่มด้านล่างเพื่อตั้งค่าอินเทอร์เน็ตให้อุปกรณ์
                  </KanitText>
                  <TouchableOpacity
                    onPress={() => router.push('/(setup)/step3-wifi-setup')}
                    className="bg-white rounded-2xl py-4 mb-4 w-full items-center"
                  >
                    <KanitText weight="medium" className="text-lg text-green-600">
                      ไปตั้งค่าอินเทอร์เน็ต
                    </KanitText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleChangeDevice}
                    className="bg-white/20 border-2 border-white rounded-2xl py-4 w-full items-center"
                  >
                    <KanitText weight="medium" className="text-lg text-white">
                      เปลี่ยนอุปกรณ์
                    </KanitText>
                  </TouchableOpacity>
                </View>
              ) : permission == null ? (
                <View className="items-center px-6">
                  <ModernSpinner size={20} />
                  <KanitText className="text-white text-center mt-4 text-base">
                    กำลังตรวจสอบสิทธิ์กล้อง...
                  </KanitText>
                </View>
              ) : !permission.granted ? (
                <View className="items-center px-6">
                  <KanitText className="text-white text-center mb-6 text-lg">
                    {permission.canAskAgain
                      ? 'ต้องการสิทธิ์การเข้าถึงกล้องเพื่อสแกน QR Code'
                      : 'คุณได้ปฏิเสธสิทธิ์กล้อง กรุณาเปิดในการตั้งค่าของอุปกรณ์'}
                  </KanitText>
                  <TouchableOpacity
                    onPress={handleRequestCameraPermission}
                    className="bg-[#16AD78] px-8 py-3 rounded-full shadow-lg"
                  >
                    <KanitText weight="medium" className="text-white text-base">
                      {permission.canAskAgain ? 'อนุญาตให้ใช้กล้อง' : 'ตั้งค่ากล้อง'}
                    </KanitText>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {/* กรอบสแกน QR Code */}
                  <View className="w-72 h-72 relative">
                    <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#16AD78] rounded-tl-2xl" />
                    <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#16AD78] rounded-tr-2xl" />
                    <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#16AD78] rounded-bl-2xl" />
                    <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#16AD78] rounded-br-2xl" />
                    <View className="absolute top-1/2 left-4 right-4 h-[1px] bg-[#16AD78]/50" />
                  </View>

                  {/* คำแนะนำสำหรับการสแกน QR */}
                  <View className="mt-8 bg-black/60 px-6 py-3 rounded-2xl backdrop-blur-md">
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
                      <KanitText className="text-red-400 text-sm text-center mt-2">
                        ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่
                      </KanitText>
                    )}
                  </View>
                </>
              )}
            </View>

            {/* ทางเลือกสำหรับกรอกรหัสอุปกรณ์เอง แสดงเฉพาะตอนยังไม่มีอุปกรณ์ผูกอยู่ */}
            {!existingDeviceId && (
              <View className="items-center">
                {/* ปุ่มเปิด-ปิดไฟฉาย */}
                {permission?.granted && (
                  <TouchableOpacity
                    onPress={() => setTorchEnabled((prev) => !prev)}
                    className={`mb-6 flex-row items-center justify-center self-center px-6 py-3 rounded-full border ${
                      torchEnabled
                        ? 'bg-yellow-500/20 border-yellow-400/40'
                        : 'bg-white/10 border-white/20'
                    } backdrop-blur-md active:opacity-70`}
                  >
                    <MaterialSymbol
                      name={torchEnabled ? 'flashlight_off' : 'flashlight_on'}
                      size={20}
                      color={torchEnabled ? '#FBBF24' : 'white'}
                    />
                    <KanitText
                      weight="medium"
                      className={`ml-2 text-sm ${torchEnabled ? 'text-yellow-400' : 'text-white'}`}
                    >
                      {torchEnabled ? 'ปิดไฟฉาย' : 'เปิดไฟฉาย'}
                    </KanitText>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setTorchEnabled(false);
                    setShowManualEntry(true);
                  }}
                  className="flex-row items-center bg-white/20 px-6 py-4 rounded-full border border-white/30 backdrop-blur-md shadow-lg active:bg-white/30"
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
      </WizardLayout>
    </View>
  );
}
