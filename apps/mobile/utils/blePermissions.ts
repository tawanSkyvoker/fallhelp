/**
 * blePermissions.ts
 *
 * จัดการ BLE permission ตาม platform สำหรับ flow ค้นหาและเชื่อมต่ออุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ขอสิทธิ์ Bluetooth และ Location ตาม version ของ Android
 * - คืนผลลัพธ์แบบอ่านง่ายให้หน้าจอ setup นำไปแสดงต่อ
 * - ตรวจสอบสิทธิ์เดิมก่อนเริ่ม scan อุปกรณ์
 * - แยก logic ของ iOS และ Android ออกจากหน้าจอ setup
 */

import { Platform, PermissionsAndroid } from 'react-native';

import Logger from './logger';

export interface PermissionResult {
  granted: boolean;
  message?: string;
  missing?: string[];
}

export async function requestBLEPermissions(): Promise<PermissionResult> {
  if (Platform.OS === 'android') return await requestAndroidBLEPermissions();

  // iOS ใช้ permission จาก Info.plist จึงไม่ต้อง request ผ่าน PermissionsAndroid
  if (Platform.OS === 'ios') return { granted: true };

  return { granted: false, message: 'Unsupported platform' };
}

async function requestAndroidBLEPermissions(): Promise<PermissionResult> {
  try {
    const androidVersion = Platform.Version as number;

    if (androidVersion >= 31) {
      Logger.info('Requesting Android 12+ BLE permissions...');

      // Android 12+ ต้องขอ permission ชุดใหม่สำหรับ BLE scan/connect
      const requiredPermissions = [
        {
          permission: PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          label: 'Bluetooth Scan',
        },
        {
          permission: PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          label: 'Bluetooth Connect',
        },
        {
          permission: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          label: 'ตำแหน่ง',
        },
      ] as const;

      const granted = await PermissionsAndroid.requestMultiple(
        requiredPermissions.map(({ permission }) => permission),
      );

      // รวมชื่อสิทธิ์ที่ยังไม่ได้รับอนุญาต เพื่อให้หน้าจอแสดงข้อความบอกผู้ใช้ได้
      const missing = requiredPermissions
        .filter(({ permission }) => granted[permission] !== PermissionsAndroid.RESULTS.GRANTED)
        .map(({ label }) => label);

      if (missing.length > 0) {
        Logger.warn('Some BLE permissions were denied', { missing });

        return {
          granted: false,
          missing,
          message: `ต้องอนุญาตสิทธิ์ ${missing.join(', ')} เพื่อค้นหาและเชื่อมต่ออุปกรณ์`,
        };
      }

      Logger.info('All BLE permissions granted');
      return { granted: true };
    } else {
      Logger.info('Requesting Android 11 BLE permissions...');

      // Android 11 และต่ำกว่าใช้ Location permission สำหรับ Bluetooth scanning
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Bluetooth scanning requires location permission',
          buttonPositive: 'OK',
        },
      );

      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        return {
          granted: false,
          missing: ['ตำแหน่ง'],
          message: 'ต้องอนุญาตสิทธิ์ตำแหน่งเพื่อค้นหาอุปกรณ์ผ่าน Bluetooth',
        };
      }

      return { granted: true };
    }
  } catch (error) {
    Logger.error('Error requesting BLE permissions:', error);
    return { granted: false, message: 'Failed to request permissions' };
  }
}

export async function checkBLEPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') return true;

  if (Platform.OS === 'android') {
    const androidVersion = Platform.Version as number;

    if (androidVersion >= 31) {
      // Android 12+ ต้องมีครบทั้ง scan, connect และ location ก่อนเริ่ม BLE flow
      const [scan, connect, location] = await Promise.all([
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
      ]);

      return scan && connect && location;
    } else {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }
  }

  return false;
}
