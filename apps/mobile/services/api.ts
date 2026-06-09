/**
 * api.ts
 *
 * ไฟล์นี้เป็น Axios client กลางของแอป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด baseURL และ timeout สำหรับทุก request
 * - แนบ token ให้ request อัตโนมัติ ถ้ามี token อยู่ในเครื่อง
 * - แปลง error จาก API ให้เป็นรูปแบบเดียวกันทั้งแอป
 */

import axios from 'axios';

import { CONFIG } from '../constants/Config';
import { getToken } from './tokenStorage';
import Logger from '../utils/logger';

import type { AxiosRequestHeaders } from 'axios';

export const apiClient = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: CONFIG.REQUEST_TIMEOUT,
});

if (__DEV__) {
  Logger.info('🚀 API Client Initialized with Base URL:', CONFIG.API_URL);
}

// ก่อนส่ง request ออกไป จะเข้ามาที่จุดนี้ก่อน
// ใช้สำหรับแนบ token ไปกับ request ถ้ามี token อยู่ในเครื่อง
apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();

  if (token) {
    const headers = (config.headers ?? {}) as AxiosRequestHeaders;
    headers.Authorization = `Bearer ${token}`;
    config.headers = headers;
  }

  return config;
});

// หลังจาก API ตอบกลับมา จะเข้ามาที่จุดนี้
// ถ้า request สำเร็จ จะส่ง response กลับไปที่ service ที่เรียกใช้
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // แปลง error ให้อยู่ในรูปแบบ ApiError ก่อนส่งกลับไปให้ไฟล์ที่เรียกใช้
    const apiError = toApiError(error);

    if (error.response?.status === 401) {
      Logger.debug(
        `API 401 (Session Expired): ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
      );
    } else if (
      (error.response?.status === 500 && error.response?.data?.error === 'User not found') ||
      (error.response?.status === 404 &&
        (error.response?.data?.error?.code === 'user_not_found' ||
          error.response?.data?.error === 'user_not_found'))
    ) {
      // token ยังมีอยู่ แต่ user ในระบบไม่มีแล้ว
      // ถัดไปจะลบ token เพื่อบังคับให้ผู้ใช้เข้าสู่ระบบใหม่
      Logger.warn('User not found in database - clearing invalid token');
      const { clearToken } = await import('./tokenStorage');
      await clearToken();
    } else if (error.response?.status === 409) {
      Logger.debug(
        `API 409 (Conflict): ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${apiError.message}`,
      );
    } else if (error.code === 'ECONNABORTED' || apiError.message?.includes('timeout')) {
      Logger.warn(`API Timeout: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    } else if (error.code === 'ERR_NETWORK' || !error.response) {
      Logger.warn(`Network Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
    } else if (error.response?.status === 403) {
      Logger.warn(
        `API 403 (Access Denied): ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
      );
    } else if (error.response?.status === 429) {
      Logger.warn(
        `API 429 (Rate Limited): ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
      );
    } else {
      Logger.error(
        `API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        apiError,
      );
    }

    // ส่ง error ที่แปลงแล้วกลับไปให้ service หรือหน้าจอที่เรียกใช้
    return Promise.reject(apiError);
  },
);

export type ApiError = {
  status?: number | undefined;
  code?: string | undefined;
  message: string;
  data?: unknown;
};

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string' &&
    ('status' in error || 'data' in error)
  );
}

// แปลง error ทุกแบบให้เป็น ApiError รูปแบบเดียว
// ถัดไปไฟล์อื่นจะใช้ message, status, code ได้ง่ายขึ้น
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;

  if (axios.isAxiosError(error)) {
    let message = error.message;
    let code: string | undefined;
    const responseData = error.response?.data;

    // รองรับ error รูปแบบหลักจาก Backend: { error: { code, message } }
    if (
      responseData?.error &&
      typeof responseData.error === 'object' &&
      responseData.error.message
    ) {
      message = responseData.error.message;
      code = responseData.error.code;
    }
    // รองรับ error รูปแบบเก่า: { error: "ข้อความ error" }
    else if (typeof responseData?.error === 'string') {
      message = responseData.error;
    }
    // รองรับกรณี Backend ส่ง message ไว้ที่ root
    else if (responseData?.message) {
      message = responseData.message;
    }

    return {
      message,
      ...(error.response?.status !== undefined ? { status: error.response.status } : {}),
      ...(code !== undefined ? { code } : {}),
      ...(error.response?.data !== undefined ? { data: error.response.data } : {}),
    };
  }

  return { message: (error as Error)?.message ?? 'Unknown error' };
}
