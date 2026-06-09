/**
 * Device WiFi Setup Router
 *
 * หน้านี้ใช้เลือกวิธีตั้งค่า WiFi ให้อุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลผู้สูงอายุและอุปกรณ์ที่ผูกอยู่
 * - ตรวจสถานะว่าอุปกรณ์ออนไลน์หรือออฟไลน์
 * - ถ้าออนไลน์ จะใช้ flow เปลี่ยน WiFi ผ่าน Backend/MQTT
 * - ถ้าออฟไลน์ จะใช้ flow ตั้งค่า WiFi ผ่าน BLE
 * - เมื่อเลือก flow แล้ว จะล็อกไว้ ไม่ให้สลับกลางคัน
 */

import React from 'react';
import { View } from 'react-native';
import { ModernSpinner } from '../../../components/ModernSpinner';

import KanitText from '../../../components/KanitText';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';

import DeviceWifiReconfigScreen from './device-wifi-reconfig';
import DeviceBleWifiSetupScreen from './device-ble-wifi-setup';

import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { useSensorStore } from '../../../store/useSensorStore';
import { getEffectiveDeviceOnline } from '../../../utils/deviceConnectivity';
import { useAppSearchParams } from '../../../utils/searchParams';
import Logger from '../../../utils/logger';

export default function DeviceWifiSetupScreen() {
  // from=pairing คือ flow จับคู่อุปกรณ์ใหม่ ต้องเข้าสู่ BLE provisioning ให้ชัดเจน
  const searchParams = useAppSearchParams();
  const from = searchParams.getStringOrEmpty('from');

  // โหลดข้อมูลผู้สูงอายุและอุปกรณ์ปัจจุบัน
  const { data: elderInfo, isLoading } = useCurrentElder();

  // อ่านสถานะ online จาก realtime store
  const { isConnected: realtimeOnline, socketConnected } = useSensorStore();

  // ล็อกเวลาตอนเข้าหน้านี้
  // ใช้ประเมินสถานะ online ให้คงที่ระหว่างเลือก flow
  const [currentTimeMs] = React.useState(() => Date.now());

  // เก็บ flow ที่เลือกแล้ว
  // reconfig = อุปกรณ์ออนไลน์, ble = อุปกรณ์ออฟไลน์
  const [lockedFlow, setLockedFlow] = React.useState<'reconfig' | 'ble' | null>(null);

  const device = elderInfo?.device;

  // ตรวจสถานะ online จากข้อมูลอุปกรณ์ + realtime store
  const isDeviceOnline = getEffectiveDeviceOnline({
    device,
    now: currentTimeMs,
    realtimeConnected: realtimeOnline,
    socketConnected,
    hasRealtimeSignal: false,
  });

  React.useEffect(() => {
    if (lockedFlow || isLoading || !elderInfo) return;

    if (from === 'pairing') {
      Logger.info('[Device WiFi Setup] Pairing flow detected, using BLE provisioning');
      setLockedFlow('ble');
      return;
    }

    // เลือก flow ตามสถานะอุปกรณ์ตอนเข้าหน้านี้
    Logger.info('[Device WiFi Setup] Resolving WiFi setup flow', {
      flow: isDeviceOnline ? 'reconfig' : 'ble',
      realtimeOnline,
      socketConnected,
      lastOnline: device?.lastOnline ?? null,
      onlineStatus: device?.onlineStatus ?? null,
    });
    setLockedFlow(isDeviceOnline ? 'reconfig' : 'ble');
  }, [
    device?.lastOnline,
    device?.onlineStatus,
    elderInfo,
    from,
    isDeviceOnline,
    isLoading,
    lockedFlow,
    realtimeOnline,
    socketConnected,
  ]);

  if (isLoading || !elderInfo || !lockedFlow) {
    return (
      <ScreenWrapper
        header={<ScreenHeader title="ตั้งค่า WiFi" />}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View className="flex-1 justify-center items-center">
          <ModernSpinner size={48} />
          <KanitText weight="medium" className="text-gray-900 text-lg mt-6">
            กำลังตรวจสอบสถานะอุปกรณ์...
          </KanitText>
        </View>
      </ScreenWrapper>
    );
  }

  if (lockedFlow === 'reconfig') {
    // อุปกรณ์ออนไลน์
    // ถัดไปไปที่ device-wifi-reconfig.tsx
    return <DeviceWifiReconfigScreen />;
  }

  // อุปกรณ์ออฟไลน์
  // ถัดไปไปที่ device-ble-wifi-setup.tsx
  return <DeviceBleWifiSetupScreen />;
}
