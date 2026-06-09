/**
 * eventController.ts
 *
 * Controller สำหรับเหตุการณ์จากอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับ query สำหรับดูรายการเหตุการณ์และสรุปรายเดือน
 * - แปลง page, limit, year และ month เป็น number
 * - ส่ง userId และ elderId ให้ service ตรวจสิทธิ์
 * - ส่ง response พร้อม pagination หรือ summary กลับให้ client
 */

import { Request, Response } from 'express';

import { toStringParam } from '../utils/param';
import { createError } from '../utils/ApiError';
import * as eventService from '../services/eventService';
import { asyncHandler } from '../middlewares/errorHandler';

const safeParseInt = (value: unknown, fallback?: number): number | undefined => {
  if (value === undefined || value === null) return fallback;

  const parsed = parseInt(value as string, 10);
  return isNaN(parsed) ? fallback : parsed;
};

// GET /api/events
export const getEvents = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const { elderId, startDate, endDate, page, limit } = req.query;

  // แปลง query filter ให้เป็นชนิดข้อมูลที่ service ใช้ได้
  const startDateValue = startDate ? new Date(startDate as string) : undefined;
  const endDateValue = endDate ? new Date(endDate as string) : undefined;
  const pageValue = safeParseInt(page, 1);
  const limitValue = safeParseInt(limit, 20);

  /* istanbul ignore next — safeParseInt always returns a number when fallback is given; else branches are unreachable */
  const result = await eventService.getEventsByElder(userId, elderId as string, {
    ...(startDateValue !== undefined ? { startDate: startDateValue } : {}),
    ...(endDateValue !== undefined ? { endDate: endDateValue } : {}),
    ...(pageValue !== undefined ? { page: pageValue } : {}),
    ...(limitValue !== undefined ? { limit: limitValue } : {}),
  });

  res.json({
    success: true,
    data: result.events,
    pagination: result.pagination,
  });
});

// GET /api/events/:id
export const getEventById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const id = toStringParam(req.params['id']);

  // ดึงรายละเอียด event รายตัว โดย service จะตรวจ ownership ผ่าน elderId ของ event
  // ไฟล์ถัดไป: services/eventService.ts
  const event = await eventService.getEventById(userId, id);

  res.json({
    success: true,
    data: event,
  });
});

// GET /api/events/summary/monthly
export const getMonthlySummary = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const { elderId, year, month } = req.query;

  const now = new Date();

  // ถ้าไม่ส่งปี/เดือนมา จะใช้เดือนปัจจุบันเป็นค่า default
  const yearValue = safeParseInt(year, now.getFullYear()) ?? now.getFullYear();
  const monthValue = safeParseInt(month, now.getMonth() + 1) ?? now.getMonth() + 1;

  // สรุปเหตุการณ์รายเดือนของ elder ที่ระบุ
  // ไฟล์ถัดไป: services/eventService.ts
  const summary = await eventService.getMonthlySummary(
    userId,
    elderId as string,
    yearValue,
    monthValue,
  );

  res.json({
    success: true,
    data: summary,
  });
});
