/**
 * wifiScannerService.ts
 *
 * ไฟล์นี้ใช้สแกนหาเครือข่าย WiFi สำหรับขั้นตอนตั้งค่าอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจว่าเครื่องรองรับการสแกน WiFi หรือไม่
 * - ขอ permission ที่ Android ต้องใช้ก่อนสแกน
 * - สแกนรายชื่อ WiFi รอบตัว
 * - เรียง WiFi ตามความแรงสัญญาณ
 * - ลบชื่อ WiFi ที่ซ้ำกันออก
 */

import WifiManager from 'react-native-wifi-reborn';
import { Platform, PermissionsAndroid } from 'react-native';

import Logger from '../utils/logger';

export interface WiFiNetwork {
  SSID: string;
  BSSID: string;
  level: number;
  frequency: number;
  capabilities: string;
  timestamp: number;
}

export interface WiFiScanResult {
  networks: WiFiNetwork[];
  error?: string;
}

const isLikelyEsp32CompatibleFrequency = (frequency: number): boolean =>
  frequency <= 0 || (frequency >= 2400 && frequency < 2500);

const hasSecurityCapabilities = (network: WiFiNetwork): boolean =>
  network.capabilities.trim().length > 0;

class WiFiScannerService {
  /**
   * ตรวจว่าเครื่องนี้สแกน WiFi ได้หรือไม่
   */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      Logger.warn('WiFi scanning is only available on Android');
      return false;
    }

    try {
      // ตรวจว่า WiFi ของเครื่องเปิดอยู่หรือไม่
      const isEnabled = await WifiManager.isEnabled();
      return isEnabled;
    } catch (error) {
      Logger.error('Error checking WiFi availability:', error);
      return false;
    }
  }

  /**
   * สแกนหา WiFi รอบตัว
   */
  async scanNetworks(): Promise<WiFiScanResult> {
    if (Platform.OS !== 'android') {
      return {
        networks: [],
        error: 'WiFi scanning is only available on Android',
      };
    }

    try {
      Logger.info('Starting WiFi scan...');

      // Android ต้องขอ Location permission ก่อน ถึงจะสแกน WiFi ได้
      const hasPermission = await this.requestPermissions();

      if (!hasPermission) {
        return {
          networks: [],
          error: 'Location permission required for WiFi scanning',
        };
      }

      // สั่งให้ระบบเริ่มสแกน WiFi ใหม่ และใช้ผลที่ native ส่งกลับมาโดยตรง
      const freshNetworks = await WifiManager.reScanAndLoadWifiList();

      // อ่านซ้ำจาก cache หลัง scan จบ เพื่อเก็บเครื่องบางรุ่นที่คืนผลสดไม่ครบใน promise แรก
      const cachedNetworks = await WifiManager.loadWifiList();

      const networks = this.mergeNetworks([...freshNetworks, ...cachedNetworks]);

      Logger.info(`Found ${networks.length} WiFi networks`);

      return {
        networks,
      };
    } catch (error) {
      Logger.error('Error scanning WiFi networks:', error);
      const fallbackResult = await this.loadCachedNetworks();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (fallbackResult.networks.length > 0) {
        return {
          networks: fallbackResult.networks,
          error: errorMessage,
        };
      }

      return {
        networks: [],
        error: errorMessage,
      };
    }
  }

  /**
   * โหลดผล WiFi จาก cache ของ Android ให้ UI แสดงรายการได้เร็ว ระหว่างรอ fresh scan
   */
  async loadCachedNetworks(): Promise<WiFiScanResult> {
    if (Platform.OS !== 'android') {
      return {
        networks: [],
        error: 'WiFi scanning is only available on Android',
      };
    }

    try {
      const hasPermission = await this.requestPermissions();

      if (!hasPermission) {
        return {
          networks: [],
          error: 'Location permission required for WiFi scanning',
        };
      }

      const cachedNetworks = await WifiManager.loadWifiList();

      return {
        networks: this.mergeNetworks(cachedNetworks),
      };
    } catch (error) {
      Logger.warn('Error loading cached WiFi networks:', error);

      return {
        networks: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * ดึงชื่อ WiFi ที่มือถือกำลังเชื่อมต่ออยู่
   */
  async getCurrentSSID(): Promise<string | null> {
    if (Platform.OS !== 'android') {
      return null;
    }

    try {
      const ssid = await WifiManager.getCurrentWifiSSID();

      // บางเครื่องจะส่ง SSID พร้อมเครื่องหมายคำพูด จึงลบออกก่อนใช้
      return ssid?.replace(/"/g, '') || null;
    } catch (error) {
      Logger.error('Error getting current SSID:', error);
      return null;
    }
  }

  /**
   * ตรวจว่า WiFi นี้มีรหัสผ่านหรือไม่
   */
  isSecured(network: WiFiNetwork): boolean {
    const capabilities = network.capabilities.trim().toUpperCase();

    return (
      capabilities.includes('WPA') ||
      capabilities.includes('WEP') ||
      capabilities.includes('PSK') ||
      capabilities.includes('EAP')
    );
  }

  /**
   * อ่านประเภทความปลอดภัยของ WiFi
   */
  getSecurityType(network: WiFiNetwork): string {
    const capabilities = network.capabilities.toUpperCase();

    if (capabilities.includes('WPA3')) return 'WPA3';
    if (capabilities.includes('WPA2')) return 'WPA2';
    if (capabilities.includes('WPA')) return 'WPA';
    if (capabilities.includes('WEP')) return 'WEP';

    return 'Open';
  }

  /**
   * แปลงความแรงสัญญาณจาก dBm เป็นเปอร์เซ็นต์
   */
  getSignalStrength(level: number): number {
    // ค่า dBm ใกล้ 0 แปลว่าสัญญาณแรง
    // ช่วงนี้แปลงคร่าว ๆ จาก -90 ถึง -30 ให้กลายเป็น 0 ถึง 100
    const percentage = Math.min(100, Math.max(0, (level + 90) * (100 / 60)));
    return Math.round(percentage);
  }

  /**
   * แปลงความแรงสัญญาณเป็นคำอ่านง่าย
   */
  getSignalStrengthLabel(level: number): 'Excellent' | 'Good' | 'Fair' | 'Weak' {
    if (level > -50) return 'Excellent';
    if (level > -60) return 'Good';
    if (level > -70) return 'Fair';

    return 'Weak';
  }

  /**
   * ลบ WiFi ที่ชื่อซ้ำกันออก
   */
  private mergeNetworks(networks: (WiFiNetwork | null)[]): WiFiNetwork[] {
    const normalizedNetworks = networks.filter(
      (network): network is WiFiNetwork =>
        !!network && !!network.SSID?.trim() && hasSecurityCapabilities(network),
    );

    // เรียงก่อน merge เพื่อให้ duplicate SSID เก็บตัวที่ ESP32 มีโอกาสเห็นมากกว่า
    const sortedNetworks = normalizedNetworks.sort((a, b) => {
      const aCompatible = isLikelyEsp32CompatibleFrequency(a.frequency);
      const bCompatible = isLikelyEsp32CompatibleFrequency(b.frequency);

      if (aCompatible && !bCompatible) return -1;
      if (!aCompatible && bCompatible) return 1;

      return b.level - a.level;
    });

    return this.removeDuplicates(sortedNetworks);
  }

  private removeDuplicates(networks: WiFiNetwork[]): WiFiNetwork[] {
    const seen = new Map<string, WiFiNetwork>();

    for (const network of networks) {
      const existing = seen.get(network.SSID);
      const mergedNetwork = existing
        ? {
            ...network,
            capabilities: network.capabilities || existing.capabilities,
            frequency: network.frequency || existing.frequency,
            BSSID: network.BSSID || existing.BSSID,
          }
        : network;

      const shouldReplace =
        !existing ||
        (!hasSecurityCapabilities(existing) && hasSecurityCapabilities(network)) ||
        (isLikelyEsp32CompatibleFrequency(network.frequency) &&
          !isLikelyEsp32CompatibleFrequency(existing.frequency)) ||
        (isLikelyEsp32CompatibleFrequency(network.frequency) ===
          isLikelyEsp32CompatibleFrequency(existing.frequency) &&
          network.level > existing.level);

      // ถ้า SSID ซ้ำ ให้ prefer 2.4 GHz ก่อน แล้วค่อยเลือกตัวที่สัญญาณแรงกว่า
      if (shouldReplace) {
        seen.set(network.SSID, mergedNetwork);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * ขอ permission ที่ Android ต้องใช้ก่อนสแกน WiFi
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const _androidVersion = Platform.Version as number;

      // Android ต้องใช้ ACCESS_FINE_LOCATION สำหรับ WiFi scanner
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'WiFi scanning requires location permission',
          buttonPositive: 'OK',
        },
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      Logger.error('Error requesting WiFi permissions:', error);
      return false;
    }
  }

  /**
   * ตรวจว่า Location เปิดอยู่หรือไม่
   */
  async isLocationEnabled(): Promise<boolean> {
    // ปลั๊กอินนี้ไม่มี helper สำหรับเช็ค GPS โดยตรง
    // ถ้า GPS ไม่พร้อม ให้ scanNetworks จัดการ error ตอนสแกนแทน
    return true;
  }
}

export const wifiScannerService = new WiFiScannerService();
