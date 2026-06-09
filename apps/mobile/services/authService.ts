/**
 * authService.ts
 *
 * ไฟล์นี้รวม service ที่เกี่ยวกับการยืนยันตัวตน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - Login
 * - Register
 * - ขอ OTP
 * - ตรวจ OTP
 * - Reset Password
 * - ดึง Profile ผู้ใช้เพื่อกู้ session และข้อมูลบัญชี
 * - Logout
 *
 * หน้าจอจะเรียกฟังก์ชันในไฟล์นี้
 * จากนั้นไฟล์นี้จะเรียก apiClient ใน api.ts เพื่อส่ง request ต่อ
 */

import { apiClient, toApiError } from './api';
import { clearToken, setToken } from './tokenStorage';
import Logger from '../utils/logger';

import type { UserProfile } from './types';
import type { ApiResponse } from './types';

export type AuthResponse = { token: string; user: UserProfile };
export type BackendAuthResponse = ApiResponse<AuthResponse>;

export type LoginPayload = {
  email?: string;
  identifier?: string;
  password: string;
};

export type RegisterPayload = LoginPayload & {
  firstName: string;
  lastName: string;
  gender: string;
  phone?: string;
};

export type RequestOtpPayload = { email: string };
export type VerifyOtpPayload = { email: string; code: string };

export type ResetPasswordPayload = {
  email: string;
  code: string;
  newPassword: string;
};

// Login ผู้ใช้
// ถูกเรียกจากหน้า login.tsx
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  try {
    // ส่งข้อมูล Login ไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อแนบ token และส่ง request ออกไป
    const { data } = await apiClient.post<BackendAuthResponse>('/api/auth/login', payload);

    // เก็บ token ไว้ในเครื่อง หลัง Login สำเร็จ
    await setToken(data.data.token);

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// สมัครสมาชิกผู้ใช้ใหม่
// ถูกเรียกจากหน้า register.tsx
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  try {
    // ส่งข้อมูลสมัครสมาชิกไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.post<BackendAuthResponse>('/api/auth/register', payload);

    // เก็บ token ไว้ในเครื่อง หลัง Register สำเร็จ
    await setToken(data.data.token);

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

export type OtpResponse = {
  message: string;
  referenceCode: string;
  expiresInMinutes: number;
};

// ขอ OTP สำหรับรีเซ็ตรหัสผ่าน
// ถูกเรียกจากหน้า forgot-password.tsx และ verify-otp.tsx
export async function requestOtp(payload: RequestOtpPayload): Promise<OtpResponse> {
  try {
    // ส่งคำขอ OTP ไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.post<ApiResponse<OtpResponse>>(
      '/api/auth/request-otp',
      payload,
    );

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

export type VerifyOtpResponse = { valid: boolean; message: string };

// ตรวจสอบ OTP
// ถูกเรียกจากหน้า verify-otp.tsx
export async function verifyOtp(payload: VerifyOtpPayload): Promise<VerifyOtpResponse> {
  try {
    // ส่งรหัส OTP ไปตรวจที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.post<ApiResponse<VerifyOtpResponse>>(
      '/api/auth/verify-otp',
      payload,
    );

    // ถ้า Backend ตอบว่า OTP ไม่ถูกต้อง ให้โยน error กลับไปหน้าที่เรียกใช้
    if (!data.data.valid) {
      throw new Error(data.data.message || 'รหัส OTP ไม่ถูกต้อง');
    }

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// ตั้งรหัสผ่านใหม่
// ถูกเรียกจากหน้า reset-password.tsx
export async function resetPassword(payload: ResetPasswordPayload) {
  try {
    // ส่งรหัสผ่านใหม่ไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    await apiClient.post('/api/auth/reset-password', payload);
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// ดึงข้อมูลโปรไฟล์ของผู้ใช้ปัจจุบัน
// ถูกเรียกจากส่วนที่ต้องการข้อมูล user หลัง Login
export async function fetchProfile(): Promise<UserProfile> {
  try {
    // ขอข้อมูลผู้ใช้จาก apiClient
    // ถัดไปไปที่ api.ts เพื่อแนบ token และส่ง request ออกไป
    const { data } = await apiClient.get<UserProfile>('/api/users/me');

    return data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// Logout ผู้ใช้
// ถูกเรียกตอนผู้ใช้ต้องการออกจากระบบ
export async function logout() {
  try {
    // แจ้ง Backend ก่อน logout
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    await apiClient.post('/api/auth/logout');
  } catch (error) {
    // ถ้าแจ้ง Backend ไม่สำเร็จ ยังต้อง logout ฝั่งเครื่องต่อ
    Logger.warn('Backend logout failed; continuing local signout', error);
  } finally {
    // ลบ token ออกจากเครื่องเสมอ ไม่ว่า Backend จะตอบสำเร็จหรือไม่
    await clearToken();
  }
}
