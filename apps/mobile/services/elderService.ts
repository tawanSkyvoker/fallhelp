/**
 * elderService.ts
 *
 * ไฟล์นี้ใช้จัดการข้อมูลผู้สูงอายุ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - สร้างข้อมูลผู้สูงอายุ
 * - ดึงข้อมูลผู้สูงอายุของผู้ใช้ปัจจุบัน
 * - ดึงข้อมูลผู้สูงอายุตาม id
 * - แก้ไขข้อมูลผู้สูงอายุ
 *
 * หน้าจอจะเรียกฟังก์ชันในไฟล์นี้
 * จากนั้นไฟล์นี้จะเรียก apiClient ใน api.ts เพื่อส่ง request ต่อ
 */

import { apiClient, toApiError } from './api';

import type { ApiResponse, Elder } from './types';

export type CreateElderPayload = {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  weight?: number;
  height?: number;
  diseases?: string | null;
  phone?: string | null;

  // ที่อยู่ของผู้สูงอายุ เก็บแบบแยกฟิลด์
  houseNumber?: string;
  villageNumber?: string;
  villageName?: string | null;
  subdistrict?: string;
  district?: string;
  province?: string;
  zipcode?: string;
};

export type UpdateElderPayload = Partial<CreateElderPayload>;

// สร้างข้อมูลผู้สูงอายุใหม่
// ใช้ตอน setup หรือเพิ่มข้อมูลผู้สูงอายุครั้งแรก
export async function createElder(payload: CreateElderPayload): Promise<Elder> {
  try {
    // ส่งข้อมูลผู้สูงอายุไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const response = await apiClient.post<ApiResponse<Elder>>('/api/elders', payload);

    return response.data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// ดึงข้อมูลผู้สูงอายุของผู้ใช้ปัจจุบัน
// ถ้ายังไม่มีข้อมูลผู้สูงอายุ จะได้ค่า null
export async function getCurrentElder(): Promise<Elder | null> {
  try {
    // ขอข้อมูลผู้สูงอายุปัจจุบันจาก apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const response = await apiClient.get<ApiResponse<Elder | null>>('/api/elders/current');

    return response.data.data ?? null;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// ดึงข้อมูลผู้สูงอายุตาม elderId
// ใช้เมื่อต้องการอ่านข้อมูลผู้สูงอายุแบบเจาะจง
export async function getElder(elderId: string): Promise<Elder> {
  try {
    // ขอข้อมูลผู้สูงอายุจาก apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const response = await apiClient.get<ApiResponse<Elder>>(`/api/elders/${elderId}`);

    return response.data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// แก้ไขข้อมูลผู้สูงอายุ
// ใช้เมื่อต้องการอัปเดตข้อมูลบางส่วนของผู้สูงอายุ
export async function updateElder(elderId: string, payload: UpdateElderPayload): Promise<Elder> {
  try {
    // ส่งข้อมูลที่ต้องการแก้ไขไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const response = await apiClient.put<ApiResponse<Elder>>(`/api/elders/${elderId}`, payload);

    return response.data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}
