/**
 * userService.ts
 *
 * ไฟล์นี้ใช้จัดการข้อมูลผู้ใช้
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดึงข้อมูลโปรไฟล์
 * - แก้ไขข้อมูลโปรไฟล์
 * - เปลี่ยนรหัสผ่าน
 * - อัปเดต Expo Push Token
 *
 * หน้าจอหรือ hook จะเรียกฟังก์ชันในไฟล์นี้
 * จากนั้นไฟล์นี้จะเรียก apiClient ใน api.ts เพื่อส่ง request ต่อ
 */

import { apiClient, toApiError } from './api';

import type { ApiResponse, UserProfile } from './types';

export type UpdateProfilePayload = Partial<
  Pick<UserProfile, 'firstName' | 'lastName' | 'phone' | 'profileImage' | 'email' | 'gender'>
>;

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type UpdatePushTokenPayload = {
  pushToken: string;
};

// ดึงข้อมูลโปรไฟล์ของผู้ใช้ปัจจุบัน
export async function getProfile(): Promise<UserProfile> {
  try {
    // ขอข้อมูลโปรไฟล์จาก apiClient
    // ถัดไปไปที่ api.ts เพื่อแนบ token และส่ง request ออกไป
    const response = await apiClient.get<ApiResponse<UserProfile>>('/api/users/me');

    return response.data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// แก้ไขข้อมูลโปรไฟล์ของผู้ใช้ปัจจุบัน
export async function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  try {
    // ส่งข้อมูลโปรไฟล์ที่ต้องการแก้ไขไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const response = await apiClient.patch<ApiResponse<UserProfile>>('/api/users/me', payload);

    return response.data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// เปลี่ยนรหัสผ่านของผู้ใช้ปัจจุบัน
export async function changePassword(payload: ChangePasswordPayload) {
  try {
    // ส่งรหัสผ่านเดิมและรหัสผ่านใหม่ไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    await apiClient.put('/api/users/me/password', payload);
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// อัปเดต Expo Push Token ของผู้ใช้ปัจจุบัน
export async function updatePushToken(payload: UpdatePushTokenPayload) {
  try {
    // ส่ง push token ไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    await apiClient.put('/api/users/me/push-token', payload);
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}
