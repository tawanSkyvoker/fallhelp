/**
 * Device Info Screen
 *
 * หน้านี้ใช้แสดงรายละเอียดและสถานะของอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลผู้สูงอายุและอุปกรณ์ที่ผูกอยู่
 * - แสดงสถานะออนไลน์/ออฟไลน์ของอุปกรณ์
 * - ให้ผู้ใช้ไปตั้งค่า WiFi ใหม่ได้
 * - ให้ผู้ใช้ยกเลิกการเชื่อมต่ออุปกรณ์ได้
 */

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { View, BackHandler, ScrollView, StyleSheet } from 'react-native';
import { ModernSpinner } from '../../../components/ModernSpinner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { MaterialSymbol } from '../../../components/MaterialSymbol';
import { MaterialIconSolid } from '../../../components/MaterialIconSolid';

import KanitText from '../../../components/KanitText';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { Bounceable } from '../../../components/Bounceable';
import { LoadingScreen } from '../../../components/LoadingScreen';

import { unpairDevice } from '../../../services/deviceService';
import { showErrorMessage } from '../../../utils/errorHelper';
import { showDialog } from '../../../utils/dialogService';
import { showSuccessToast } from '../../../utils/toast';
import { safeRouter as router } from '../../../utils/safeRouter';
import {
  getDeviceLastOnlineAt,
  getEffectiveDeviceOnline,
  hasRealtimeDeviceSignal,
  isDeviceMarkedOnlineByApi,
} from '../../../utils/deviceConnectivity';

import { useSensorStore } from '../../../store/useSensorStore';
import { useDeviceSetupStore } from '../../../store/useDeviceSetupStore';
import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { queryKeys } from '../../../hooks/queryKeys';
import type { Elder } from '../../../services/types';

export default function DeviceInfoScreen() {
  // ใช้จัดการ cache ของ React Query หลังแก้ไขข้อมูลอุปกรณ์
  const queryClient = useQueryClient();

  // ใช้กันการอัปเดต state หลังออกจากหน้าแล้ว
  const isMounted = useRef(false);

  // กันกดปุ่มผูกอุปกรณ์ซ้ำ รีเซ็ตเมื่อ screen focus กลับมา
  const [isPairing, setIsPairing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsPairing(false);
    }, []),
  );

  // โหลดข้อมูลผู้สูงอายุและอุปกรณ์ที่ผูกอยู่
  const { data: elderInfo, isLoading } = useCurrentElder({
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const isInitialLoading = isLoading && !elderInfo;
  const rawDevice = elderInfo?.device;

  // อ่านสถานะ realtime จาก socket/store
  const { lastHeartUpdate, lastStatusUpdate, isConnected, socketConnected } = useSensorStore();

  useEffect(() => {
    if (!elderInfo?.id || !rawDevice?.id) return;

    // ตั้งค่า store เพื่อให้ realtime/socket รู้ว่าต้องติดตาม elder/device ตัวไหน
    useDeviceSetupStore.getState().setElderConfig(elderInfo.id, rawDevice.id);
  }, [rawDevice?.id, elderInfo?.id]);

  useEffect(() => {
    // บอกว่าหน้านี้ยัง mounted อยู่
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    // เมื่อเข้าหน้านี้ ให้ refresh ข้อมูลผู้สูงอายุและอุปกรณ์
    queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });

    const timer = setTimeout(() => {
      if (isMounted.current) {
        // refresh ซ้ำอีกครั้ง เพื่อให้ข้อมูลจาก server อัปเดตทันหลังเปลี่ยนหน้า
        queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [queryClient]);

  // จัดการขั้นตอนยกเลิกการผูกอุปกรณ์
  // เมื่อเรียก mutate() ระบบจะเข้ามาทำงานที่ mutationFn
  const unpairMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      // เรียก service สำหรับยกเลิกการผูกอุปกรณ์
      // ไฟล์ถัดไป: services/deviceService.ts
      return await unpairDevice({ deviceId });
    },
    onSuccess: () => {
      if (!isMounted.current) return;

      // อัปเดต cache ทันทีเพื่อให้หน้า Dashboard เห็นว่าไม่มีอุปกรณ์แล้ว ลดอาการกระพริบ
      queryClient.setQueryData(queryKeys.currentElder(), (oldData: Elder | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          device: null,
          deviceId: null,
        };
      });

      // รีเฟรชข้อมูลผู้สูงอายุ เพราะ device ถูกยกเลิกการผูกแล้ว
      queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });

      // กลับ Dashboard แล้วค่อยแสดง toast (หน่วงเวลาให้ Animation เปลี่ยนหน้าเสร็จก่อน)
      router.dismissTo('/(tabs)/dashboard');
      setTimeout(() => {
        showSuccessToast('ยกเลิกการเชื่อมต่อแล้ว');
      }, 300);
    },
    onError: (error) => {
      if (isMounted.current) {
        showErrorMessage('เกิดข้อผิดพลาด', error);
      }
    },
  });

  // ใช้ ref เพื่อจำ device ล่าสุดไว้ไม่ให้หน้าจอกระพริบเป็นหน้า "ยังไม่ได้ผูกอุปกรณ์" ตอนกำลังจะ navigate กลับ
  const lastDeviceRef = useRef(rawDevice);
  useEffect(() => {
    if (rawDevice) {
      lastDeviceRef.current = rawDevice;
    }
  }, [rawDevice]);

  // ถ้ายกเลิกสำเร็จแล้ว ให้ใช้ device จาก ref แทนเพื่อตรึงหน้าจอเดิมไว้ระหว่าง transition กลับ dashboard
  const device = unpairMutation.isSuccess ? lastDeviceRef.current : rawDevice;

  const handleUnpair = () => {
    if (!device?.id) return;

    showDialog(
      'ยืนยันการยกเลิกเชื่อมต่อ',
      'คุณแน่ใจหรือไม่ที่จะยกเลิกการเชื่อมต่ออุปกรณ์นี้? คุณต้องทำการผูกใหม่หากต้องการใช้งานอีกครั้ง',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          style: 'destructive',
          onPress: () => {
            // เริ่มยกเลิกการผูกอุปกรณ์
            // ถัดไปไปที่ unpairMutation ด้านบน
            unpairMutation.mutate(device.id);
          },
        },
      ],
    );
  };

  const handleWifiConfig = () => {
    if (!device?.serialNumber) return;

    // ไปหน้ากลางสำหรับเลือก flow ตั้งค่า WiFi
    // ถัดไปไปที่ device-wifi-setup.tsx
    router.push({
      pathname: '/(features)/(device)/device-wifi-setup',
      params: {
        serialNumber: device.serialNumber,
        deviceCode: device.deviceCode,
        from: 'device-info',
      },
    });
  };

  const navigateBackFromDeviceInfo = useCallback(() => {
    // กลับไปหน้า Dashboard
    router.dismissTo('/(tabs)/dashboard');
  }, []);

  useFocusEffect(
    useCallback(() => {
      // คุมปุ่ม back ของ Android ให้กลับ Dashboard เหมือนปุ่ม back บน header
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        navigateBackFromDeviceInfo();
        return true;
      });

      return () => sub.remove();
    }, [navigateBackFromDeviceInfo]),
  );

  // เช็กว่ามีอุปกรณ์ผูกอยู่หรือไม่
  const hasDevice = !!device;

  // อ่านเวลาที่อุปกรณ์ออนไลน์ล่าสุดจากข้อมูล API
  const deviceLastOnlineAt = useMemo(() => getDeviceLastOnlineAt(device), [device]);

  // เช็กว่า API บอกว่าอุปกรณ์ออนไลน์หรือไม่
  const apiReportsOnline = isDeviceMarkedOnlineByApi(device);

  // เช็กว่ามีสัญญาณ realtime ล่าสุดจาก socket หรือไม่
  const hasRealtimeSignal = hasRealtimeDeviceSignal({ lastHeartUpdate, lastStatusUpdate });

  // ใช้เวลา current time เพื่อคำนวณสถานะ online/offline ให้เปลี่ยนเองได้
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!hasDevice || !apiReportsOnline || !deviceLastOnlineAt || hasRealtimeSignal) return;

    // ถ้าใช้ข้อมูลจาก API เป็นหลัก ให้ขยับเวลาเรื่อย ๆ เพื่อประเมินว่า online ยังสดอยู่ไหม
    const id = setInterval(() => setNowMs(Date.now()), 5000);

    return () => clearInterval(id);
  }, [hasDevice, apiReportsOnline, deviceLastOnlineAt, hasRealtimeSignal]);

  const isOnline = hasDevice
    ? getEffectiveDeviceOnline({
        device,
        now: nowMs,
        realtimeConnected: isConnected,
        socketConnected,
        hasRealtimeSignal,
      })
    : false;

  // เลือกสี badge ตามสถานะอุปกรณ์
  const colors = hasDevice
    ? isOnline
      ? { badgeBg: 'bg-green-100', badgeText: 'text-green-700', gradientOpacity: 'opacity-50' }
      : { badgeBg: 'bg-red-100', badgeText: 'text-red-600', gradientOpacity: 'opacity-50' }
    : { badgeBg: 'bg-gray-100', badgeText: 'text-gray-500', gradientOpacity: 'opacity-30' };

  if (isInitialLoading) {
    return <LoadingScreen useScreenWrapper />;
  }

  return (
    <ScreenWrapper
      edges={['top']}
      useScrollView={false}
      style={{ backgroundColor: '#FFFFFF' }}
      header={
        <ScreenHeader
          title={hasDevice ? 'รายละเอียดอุปกรณ์' : 'เชื่อมต่ออุปกรณ์'}
          onBack={navigateBackFromDeviceInfo}
        />
      }
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1">
          {hasDevice ? (
            <View
              className="bg-white rounded-[24px] border border-gray-100 mb-6 overflow-hidden"
              style={styles.cardShadow}
            >
              <View className="p-7 items-center relative">
                <View
                  className={`absolute top-0 left-0 w-full h-2 bg-linear-to-r from-blue-400 to-teal-400 ${colors.gradientOpacity}`}
                />

                <KanitText
                  weight="regular"
                  className="text-sm text-gray-400 uppercase tracking-widest mb-1.5"
                >
                  รหัสอุปกรณ์
                </KanitText>

                <KanitText
                  weight="regular"
                  className="text-[32px] text-gray-900 mb-2 tracking-tighter"
                >
                  {device.deviceCode}
                </KanitText>

                {/* Badge แสดงสถานะออนไลน์/ออฟไลน์ */}
                <View className={`px-4 py-1.5 rounded-full mb-3 ${colors.badgeBg}`}>
                  <KanitText weight="regular" className={`text-sm ${colors.badgeText}`}>
                    {isOnline ? '● ออนไลน์' : '● ออฟไลน์'}
                  </KanitText>
                </View>

                <View className="w-full h-[1px] bg-gray-100 my-4" />

                {/* แสดง Serial Number ของอุปกรณ์ */}
                <View className="items-center w-full">
                  <KanitText
                    weight="regular"
                    className="text-[11px] text-gray-400 mb-0.5 uppercase tracking-wider"
                  >
                    หมายเลขซีเรียล
                  </KanitText>
                  <KanitText weight="regular" className="text-gray-800 text-base text-center">
                    {device.serialNumber || '-'}
                  </KanitText>
                </View>
              </View>
            </View>
          ) : (
            <View
              style={{
                alignItems: 'center',
                marginBottom: 32,
                paddingHorizontal: 8,
                paddingTop: 16,
              }}
            >
              {/* ยังไม่มีอุปกรณ์ ให้ผู้ใช้เริ่มผูกอุปกรณ์ */}
              <KanitText className="text-xl text-gray-800 mb-2 text-center" weight="regular">
                ยังไม่ได้ผูกอุปกรณ์
              </KanitText>

              <KanitText
                className="text-sm text-gray-500 mb-6 text-center"
                style={{
                  paddingHorizontal: 16,
                  lineHeight: 20,
                }}
                weight="regular"
              >
                สแกน QR Code บนอุปกรณ์เพื่อเริ่มใช้งานระบบตรวจจับการล้ม
              </KanitText>

              <Bounceable
                onPress={() => {
                  if (isPairing) return;
                  setIsPairing(true);
                  router.push('/(features)/(device)/device-pairing');
                }}
                disabled={isPairing}
                className="rounded-2xl"
                scale={0.96}
                style={{
                  shadowColor: '#16AD78',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  backgroundColor: '#16AD78',
                }}
              >
                <View className="px-8 py-3.5 flex-row items-center gap-2">
                  <MaterialSymbol name="qr_code_scanner" size={22} color="#FFFFFF" />
                  <KanitText weight="regular" className="text-white text-base">
                    ผูกอุปกรณ์
                  </KanitText>
                </View>
              </Bounceable>
            </View>
          )}

          {hasDevice && elderInfo && (
            <>
              <KanitText weight="regular" className="text-lg text-gray-800 mb-4 ml-2">
                การจัดการอุปกรณ์
              </KanitText>

              <View
                className="bg-white rounded-[28px] border border-gray-100 overflow-hidden"
                style={styles.cardShadow}
              >
                {/* เมนูไปตั้งค่า WiFi */}
                <Bounceable
                  onPress={handleWifiConfig}
                  className="border-b border-gray-100 active:bg-gray-50 bg-white"
                  scale={1}
                >
                  <View className="flex-row items-center py-5 px-6">
                    <View className="w-12 h-12 rounded-2xl bg-gray-50 items-center justify-center mr-4">
                      <MaterialIconSolid name="wifi" size={26} color="#4B5563" />
                    </View>

                    <View className="flex-1">
                      <KanitText weight="regular" className="text-gray-900 text-lg">
                        {isOnline ? 'เปลี่ยน WiFi' : 'ตั้งค่า WiFi ใหม่'}
                      </KanitText>

                      <KanitText weight="regular" className="text-gray-400 text-sm mt-0.5">
                        {device.wifiStatus === 'CONFIGURING'
                          ? 'กำลังตั้งค่า WiFi อยู่ สามารถลองเช็กสถานะอีกครั้งได้'
                          : device.wifiStatus === 'ERROR'
                            ? 'การตั้งค่า WiFi ก่อนหน้าไม่สำเร็จ ให้ลองเชื่อมต่อใหม่อีกครั้ง'
                            : isOnline
                              ? 'เปลี่ยนเครือข่ายหรือรหัสผ่าน WiFi ใหม่ให้อุปกรณ์'
                              : 'แก้ไขเมื่อเปลี่ยนรหัส WiFi บ้าน หรืออุปกรณ์หลุดการเชื่อมต่อ'}
                      </KanitText>
                    </View>

                    <MaterialSymbol name="chevron_right" size={24} color="#D1D5DB" />
                  </View>
                </Bounceable>

                {/* เมนูยกเลิกการเชื่อมต่ออุปกรณ์ */}
                <Bounceable onPress={handleUnpair} className="active:bg-red-50 bg-white" scale={1}>
                  <View className="flex-row items-center py-5 px-6">
                    <View className="w-12 h-12 rounded-2xl bg-red-50 items-center justify-center mr-4">
                      <MaterialIconSolid name="link_off" size={26} color="#EF4444" />
                    </View>

                    <View className="flex-1">
                      <KanitText weight="regular" className="text-red-500 text-lg">
                        ยกเลิกการเชื่อมต่อ
                      </KanitText>

                      <KanitText weight="regular" className="text-red-300 text-sm mt-0.5">
                        ลบอุปกรณ์ปัจจุบันออกจากบัญชีผู้ใช้
                      </KanitText>
                    </View>

                    {unpairMutation.isPending ? (
                      <ModernSpinner size={20} color="#EF4444" />
                    ) : (
                      <MaterialSymbol name="chevron_right" size={24} color="#FCA5A5" />
                    )}
                  </View>
                </Bounceable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
});
