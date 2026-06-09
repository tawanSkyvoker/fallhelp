/**
 * WiFiNetworkList.tsx
 *
 * รายชื่อ WiFi ที่สแกนได้สำหรับ flow ตั้งค่าอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดงสถานะกำลังสแกน WiFi
 * - แสดงรายการเครือข่ายพร้อมระดับสัญญาณและสถานะ lock
 * - จัดลำดับเครือข่ายที่เชื่อมต่ออยู่และสัญญาณแรงไว้ด้านบน
 * - เปิดให้ผู้ใช้สแกนใหม่หรือกรอกชื่อเครือข่ายเอง
 */

import React, { ComponentProps } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import KanitText from './KanitText';
import { ModernSpinner } from './ModernSpinner';
import { MaterialIconSolid } from './MaterialIconSolid';

import { wifiScannerService, WiFiNetwork } from '../services/wifiScannerService';

const SIGNAL_COLOR = '#1F2937';
const WIFI_SIGNAL_THRESHOLDS = {
  excellent: -55,
  good: -70,
  fair: -80,
} as const;

interface WiFiNetworkListProps {
  networks: WiFiNetwork[];
  isScanning: boolean;
  onNetworkSelect: (network: WiFiNetwork) => void;
  onScanAgain: () => void;
  onManualInput: () => void;
  currentSSID?: string | undefined;
}

// แปลงค่า RSSI เป็น icon ระดับสัญญาณ WiFi
// ใช้ MaterialCommunityIcons เพื่อให้แสดงไอคอนระดับสัญญาณพร้อมโครงร่างจาง (Ghost Waves) ด้านหลัง
// อย่างสวยงาม คมชัด เป็นเวกเตอร์แท้ และไม่มีปัญหากับ ligature font
const getSignalIcon = (level: number): string => {
  if (level >= WIFI_SIGNAL_THRESHOLDS.excellent) return 'wifi-strength-4';
  if (level >= WIFI_SIGNAL_THRESHOLDS.good) return 'wifi-strength-3';
  if (level >= WIFI_SIGNAL_THRESHOLDS.fair) return 'wifi-strength-2';
  return 'wifi-strength-1';
};

interface WiFiNetworkItemProps {
  readonly item: WiFiNetwork;
  readonly isLast: boolean;
  readonly isConnected: boolean;
  readonly isSecured: boolean;
  readonly signalIcon: string;
  readonly onNetworkSelect: (network: WiFiNetwork) => void;
}

// ใช้ React.memo เพื่อหลีกเลี่ยงการ re-render ตัวลูกที่ซ้ำซ้อน ช่วยให้ UI ลื่นไหลและประมวลผลเร็วขึ้น
const WiFiNetworkItem = React.memo(function WiFiNetworkItem({
  item,
  isLast,
  isConnected,
  isSecured,
  signalIcon,
  onNetworkSelect,
}: WiFiNetworkItemProps) {
  return (
    <TouchableOpacity
      onPress={() => onNetworkSelect(item)}
      className={`py-4 flex-row items-center justify-between ${isLast ? '' : 'border-b border-gray-100'}`}
      activeOpacity={0.7}
    >
      <View className="flex-1 mr-4">
        <View className="flex-row items-center">
          <KanitText className={`text-lg ${isConnected ? 'text-[#16AD78]' : 'text-gray-900'}`}>
            {item.SSID || 'เครือข่ายที่ซ่อนไว้'}
          </KanitText>
        </View>
      </View>
      <View className="flex-row items-center">
        {isConnected && (
          <MaterialIconSolid name="check" size={20} color="#16AD78" style={{ marginRight: 12 }} />
        )}
        {isSecured && (
          <MaterialIconSolid name="lock" size={16} color="#6B7280" style={{ marginRight: 8 }} />
        )}

        <MaterialCommunityIcons
          name={signalIcon as ComponentProps<typeof MaterialCommunityIcons>['name']}
          size={20}
          color={SIGNAL_COLOR}
          testID={`wifi-signal-${signalIcon}`}
        />
      </View>
    </TouchableOpacity>
  );
});

export function WiFiNetworkList({
  networks,
  isScanning,
  onNetworkSelect,
  onScanAgain,
  onManualInput,
  currentSSID,
}: WiFiNetworkListProps) {
  const renderNetworkItem = (item: WiFiNetwork, isLast: boolean) => {
    const isSecured = wifiScannerService.isSecured(item);
    const isConnected = currentSSID && item.SSID === currentSSID;
    const signalIcon = getSignalIcon(item.level);

    return (
      <WiFiNetworkItem
        item={item}
        isLast={isLast}
        isConnected={!!isConnected}
        isSecured={isSecured}
        signalIcon={signalIcon}
        onNetworkSelect={onNetworkSelect}
      />
    );
  };

  if (isScanning) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ModernSpinner size={48} color="#16AD78" />
        <KanitText className="text-gray-500 text-base mt-4">กำลังค้นหา WiFi ใกล้เคียง...</KanitText>
      </View>
    );
  }

  // เรียงเครือข่ายที่เชื่อมต่ออยู่ไว้บนสุด แล้วตามด้วยสัญญาณแรงไปอ่อน
  const sortedNetworks = [...networks].sort((a, b) => {
    const isAConnected = currentSSID && a.SSID === currentSSID;
    const isBConnected = currentSSID && b.SSID === currentSSID;

    if (isAConnected && !isBConnected) return -1;
    if (!isAConnected && isBConnected) return 1;

    return b.level - a.level;
  });

  const renderEmptyState = () => {
    return (
      <View className="items-center justify-center py-12">
        <MaterialIconSolid name="wifi_off" size={64} color="#D1D5DB" />
        <KanitText className="text-gray-500 text-base mt-4 text-center">
          ไม่พบ WiFi ใกล้เคียง
        </KanitText>
        <KanitText className="text-gray-400 text-sm mt-2 text-center px-6">
          ลองสแกนใหม่อีกครั้ง หรือกรอก WiFi ด้วยตนเอง
        </KanitText>
      </View>
    );
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator
        persistentScrollbar
        bounces={true}
        nestedScrollEnabled={true}
      >
        {networks.length === 0
          ? renderEmptyState()
          : sortedNetworks.map((item, index) => (
              <View key={item.BSSID}>
                {renderNetworkItem(item, index === sortedNetworks.length - 1)}
              </View>
            ))}

        {!isScanning && (
          <KanitText
            className="text-[#16AD78] text-center text-base mt-3 mb-6"
            onPress={onManualInput}
          >
            กรอกชื่อเครือข่ายด้วยตนเอง
          </KanitText>
        )}

        <View className="mt-6 pb-4">
          {isScanning ? (
            <View className="flex-row justify-center items-center">
              <ModernSpinner size={20} color="#16AD78" />
              <KanitText className="text-gray-500 ml-2">กำลังอัปเดตรายการ...</KanitText>
            </View>
          ) : (
            <View className="flex-row justify-center">
              <TouchableOpacity
                onPress={onScanAgain}
                className="bg-gray-100 rounded-full px-6 py-2 flex-row items-center"
                activeOpacity={0.7}
              >
                <MaterialIconSolid name="refresh" size={18} color="#4B5563" />
                <KanitText className="text-gray-600 ml-2">สแกนใหม่</KanitText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
