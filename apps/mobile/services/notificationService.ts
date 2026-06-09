/**
 * notificationService.ts
 *
 * ไฟล์นี้ใช้จัดการ notification ภายในแอป
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ลงทะเบียน Expo Push Token กับ Backend
 * - ดึงรายการ notification
 * - อ่านจำนวน notification ที่ยังไม่ได้อ่าน
 * - เปลี่ยนสถานะอ่านแล้วแบบรายรายการ
 * - เปลี่ยนสถานะอ่านแล้วทั้งหมด
 *
 * หน้าจอหรือ hook จะเรียกฟังก์ชันในไฟล์นี้
 * จากนั้นไฟล์นี้จะเรียก apiClient ใน api.ts เพื่อส่ง request ต่อ
 */

import { apiClient, toApiError } from './api';
import Logger from '../utils/logger';

import type { ApiResponse, Notification, Paginated } from './types';

// ลงทะเบียน Expo Push Token
// ใช้กับระบบ push notification ของเครื่องผู้ใช้
export async function registerPushToken(token: string): Promise<void> {
  try {
    // ส่ง push token ไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    await apiClient.put('/api/users/me/push-token', { pushToken: token });
  } catch (error) {
    // ถ้าบันทึก push token ไม่สำเร็จ ไม่ควรทำให้ flow หลักของแอปพัง
    Logger.warn('Failed to register push token:', error);
  }
}

export type NotificationFilters = {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
};

// ดึงรายการ notification
// ใช้ filters เพื่อแบ่งหน้า หรือกรองว่าอ่านแล้ว/ยังไม่อ่าน
export async function listNotifications(
  filters: NotificationFilters = {},
): Promise<Paginated<Notification>> {
  try {
    // ขอรายการ notification จาก apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.get<Paginated<Notification>>('/api/notifications', {
      params: filters,
    });

    return data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// ดึงจำนวน notification ที่ยังไม่ได้อ่าน
// ถ้าเรียกไม่ได้ ให้คืน 0 เพื่อไม่ให้ badge ทำให้หน้าอื่นพัง
export async function getUnreadCount(): Promise<number> {
  try {
    // ขอจำนวน unread notification จาก apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.get<ApiResponse<{ count: number }>>(
      '/api/notifications/unread-count',
    );

    return data.data.count;
  } catch {
    return 0;
  }
}

// เปลี่ยน notification รายการเดียวให้เป็นอ่านแล้ว
export async function markAsRead(id: string): Promise<void> {
  try {
    // ส่งคำขอเปลี่ยนสถานะอ่านแล้วไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    await apiClient.patch(`/api/notifications/${id}`, { isRead: true });
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// เปลี่ยน notification ทั้งหมดให้เป็นอ่านแล้ว
export async function markAllAsRead(): Promise<void> {
  try {
    // ส่งคำขออ่านทั้งหมดไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    await apiClient.patch('/api/notifications', { action: 'mark_all_read' });
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}
