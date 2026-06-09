/**
 * deviceService.ts
 *
 * ไฟล์นี้ใช้จัดการอุปกรณ์ FallHelp
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดึงข้อมูลอุปกรณ์จาก deviceCode
 * - จับคู่อุปกรณ์กับผู้สูงอายุ
 * - ยกเลิกการจับคู่อุปกรณ์
 * - อ่านและบันทึกค่า WiFi ของอุปกรณ์
 *
 * หน้าจอจะเรียกฟังก์ชันในไฟล์นี้
 * จากนั้นไฟล์นี้จะเรียก apiClient ใน api.ts เพื่อส่ง request ต่อ
 */

import { apiClient, toApiError } from './api';

import type { ApiResponse, Device } from './types';

export type PairDevicePayload = { deviceCode: string; elderId: string };
export type UnpairDevicePayload = { deviceId: string };
export type WifiConfigPayload = { ssid: string; wifiPassword: string };

// ดึงข้อมูลอุปกรณ์จาก deviceCode
// มักถูกเรียกหลังผู้ใช้สแกน QR Code
export async function getDeviceByCode(deviceCode: string): Promise<Device> {
  try {
    // ขอข้อมูลอุปกรณ์จาก apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.get<ApiResponse<Device>>(`/api/devices/by-code/${deviceCode}`);

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// จับคู่อุปกรณ์กับผู้สูงอายุ
// ถูกเรียกหลังเลือกอุปกรณ์และเลือกผู้สูงอายุแล้ว
export async function pairDevice(payload: PairDevicePayload): Promise<Device> {
  try {
    // ส่งข้อมูลจับคู่อุปกรณ์ไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.post<ApiResponse<Device>>('/api/device-pairings', payload);

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// ยกเลิกการจับคู่อุปกรณ์
// ใช้เมื่อต้องการถอดอุปกรณ์ออกจากผู้สูงอายุ
export async function unpairDevice(payload: UnpairDevicePayload): Promise<Device> {
  try {
    // ส่งคำขอยกเลิกการจับคู่อุปกรณ์ไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.delete<ApiResponse<Device>>(
      `/api/device-pairings/${payload.deviceId}`,
    );

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// ดึงค่า WiFi config ของอุปกรณ์
// ใช้เมื่อหน้าจอต้องการดูหรือเตรียมข้อมูลการตั้งค่า WiFi
export async function getDeviceConfig(deviceId: string): Promise<Device> {
  try {
    // ขอข้อมูล WiFi config จาก apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.get<ApiResponse<Device>>(
      `/api/devices/${deviceId}/wifi-config`,
    );

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// บันทึกค่า WiFi ของอุปกรณ์
// มักถูกเรียกหลัง BLE provisioning สำเร็จ
export async function configureWifi(deviceId: string, payload: WifiConfigPayload) {
  try {
    // ส่งค่า WiFi ไปบันทึกที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.put<ApiResponse<{ success: boolean }>>(
      `/api/devices/${deviceId}/wifi-config`,
      payload,
    );

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}
