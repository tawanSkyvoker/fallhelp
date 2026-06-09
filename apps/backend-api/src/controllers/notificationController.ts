/**
 * notificationController.ts
 *
 * Controller สำหรับการแจ้งเตือน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดูรายการ notification ของผู้ใช้ปัจจุบัน
 * - นับจำนวน notification ที่ยังไม่อ่าน
 * - mark read ได้ทั้งรายการเดียวและทั้งหมด
 * - ส่งต่อ database work ทั้งหมดให้ notificationService
 */

import { Request, Response } from 'express';

import { toStringParam } from '../utils/param';
import { asyncHandler } from '../middlewares/errorHandler';
import { createError } from '../utils/ApiError';
import * as notificationService from '../services/notificationService';

// GET /api/notifications
export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw createError.accessDenied();
  }

  const page = parseInt(req.query['page'] as string) || 1;
  const pageSize = parseInt(req.query['pageSize'] as string) || 20;

  // แปลง query isRead ให้เป็น boolean หรือ undefined เพื่อใช้ filter
  const isRead =
    req.query['isRead'] === 'true' ? true : req.query['isRead'] === 'false' ? false : undefined;

  // Service เป็นเจ้าของ query, pagination และ event summary enrichment
  // ไฟล์ถัดไป: services/notificationService.ts
  const result = await notificationService.listNotifications(userId, {
    page,
    pageSize,
    ...(isRead !== undefined ? { isRead } : {}),
  });

  res.json({
    success: true,
    data: result.notifications,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  });
});

// GET /api/notifications/unread-count
export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw createError.accessDenied();
  }

  // นับจำนวนแจ้งเตือนที่ยังไม่อ่านของ user ปัจจุบัน
  // ไฟล์ถัดไป: services/notificationService.ts
  const count = await notificationService.getUnreadCount(userId);

  res.json({ success: true, data: { count } });
});

// PATCH /api/notifications/:id
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const id = toStringParam(req.params['id']);

  if (!userId) {
    throw createError.accessDenied();
  }

  const { isRead } = req.body;

  if (typeof isRead !== 'boolean') {
    throw createError.validationError('isRead ต้องเป็น boolean');
  }

  // Service ใช้ updateMany คู่กับ userId เพื่อกันแก้ notification ของ user อื่น
  await notificationService.markNotificationRead(userId, id, isRead);

  res.json({ success: true, message: 'Notification updated' });
});

// PATCH /api/notifications
export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw createError.accessDenied();
  }

  const { action } = req.body;

  if (action !== 'mark_all_read') {
    throw createError.validationError('action ไม่ถูกต้อง');
  }

  // mark เฉพาะ notification ที่ยังไม่อ่านของ user ปัจจุบัน
  await notificationService.markAllNotificationsRead(userId);

  res.json({ success: true, message: 'All notifications marked as read' });
});
