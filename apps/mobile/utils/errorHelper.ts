/**
 * errorHelper.ts
 *
 * Helper สำหรับแปลง error จาก API ให้เป็นข้อความไทยที่ผู้ใช้เข้าใจ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - อ่าน error จาก response ของ API หรือ message ของ library
 * - เลือกข้อความจาก backend ก่อน ถ้ามีข้อความที่แสดงกับผู้ใช้ได้
 * - fallback เป็นข้อความไทยตาม HTTP status หรือ network error
 * - log error แล้วแสดง dialog กลางของแอป
 */

import Logger from './logger';
import { showDialog } from './dialogService';

type ErrorWithResponse = {
  response?: {
    status?: number;
    data?: { error?: string | { code?: string; message?: string } };
  };
};

type ErrorWithMessage = {
  message?: string;
  code?: string;
};

function isErrorWithResponse(error: unknown): error is ErrorWithResponse {
  return typeof error === 'object' && error !== null && ('response' in error || 'data' in error);
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return typeof error === 'object' && error !== null && 'message' in error;
}

export const getErrorMessage = (error: unknown): string => {
  if (isErrorWithResponse(error)) {
    const apiError = error.response?.data?.error;

    // backend รูปแบบหลัก: { error: { code, message } }
    if (
      apiError &&
      typeof apiError === 'object' &&
      'message' in apiError &&
      typeof apiError.message === 'string'
    ) {
      return apiError.message;
    }

    // backend แบบเก่าบางจุดยังส่งข้อความไทยมาเป็น string ตรง ๆ
    if (typeof apiError === 'string' && /[\u0E00-\u0E7F]/.test(apiError)) {
      return apiError;
    }

    // ถ้า backend ไม่ส่งข้อความมา ให้ fallback ตาม HTTP status
    if (error.response?.status) {
      return httpStatusMessage(error.response.status);
    }
  }

  if (isErrorWithMessage(error)) {
    const message = error.message;

    if (typeof message === 'string') {
      // ถ้าข้อความเป็นไทยอยู่แล้ว ใช้ต่อได้ทันที
      if (/[\u0E00-\u0E7F]/.test(message)) return message;

      // แปลง network error ให้เป็นข้อความที่ผู้ใช้เข้าใจง่าย
      if (message.includes('Network Error') || error.code === 'ERR_NETWORK') {
        return 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต';
      }

      if (message.includes('timeout') || error.code === 'ECONNABORTED') {
        return 'การเชื่อมต่อหมดเวลา กรุณาลองใหม่อีกครั้ง';
      }

      // รองรับข้อความมาตรฐานของ Axios ที่คืนมาเป็นอังกฤษล้วน
      if (
        message.includes('Request failed with status code') &&
        isErrorWithResponse(error) &&
        error.response?.status
      ) {
        return httpStatusMessage(error.response.status);
      }
    }
  }

  return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
};

function httpStatusMessage(status: number): string {
  switch (status) {
    case 401:
      return 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง';
    case 403:
      return 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้';
    case 404:
      return 'ไม่พบข้อมูลที่ร้องขอ';
    case 409:
      return 'ข้อมูลซ้ำกับที่มีอยู่แล้ว';
    case 500:
      return 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง';
    default:
      return 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง';
  }
}

export const showErrorMessage = (title: string, error: unknown) => {
  const message = getErrorMessage(error);

  Logger.error(`${title}:`, error);

  // แสดง dialog กลางด้วยข้อความที่แปลงแล้ว
  // ไฟล์ถัดไป: utils/dialogService.ts
  showDialog(title, message);
};
