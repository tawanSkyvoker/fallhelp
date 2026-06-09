/**
 * elderController.ts
 *
 * Controller สำหรับข้อมูลผู้สูงอายุ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับ request สร้าง อ่าน และแก้ไขข้อมูลผู้สูงอายุ
 * - ใช้ userId จาก JWT เพื่อจำกัดข้อมูลเฉพาะเจ้าของ
 * - แปลง id จาก params ก่อนส่งเข้า service
 * - ส่ง response ให้ mobile ใช้ต่อใน setup และ profile flow
 */

import { Request, Response } from 'express';

import { toStringParam } from '../utils/param';
import { createError } from '../utils/ApiError';
import * as elderService from '../services/elderService';
import { asyncHandler } from '../middlewares/errorHandler';

// POST /api/elders
export const createElder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const data = req.body;

  // สร้างผู้สูงอายุใหม่ให้ user ปัจจุบัน
  // ไฟล์ถัดไป: services/elderService.ts
  const elder = await elderService.createElder(userId, data);

  res.status(201).json({ success: true, message: 'สร้างผู้สูงอายุใหม่สำเร็จ', data: elder });
});

// GET /api/elders/current
export const getCurrentElder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  // ดึง elder คนเดียวที่ผูกกับ user ปัจจุบัน
  // ไฟล์ถัดไป: services/elderService.ts
  const elder = await elderService.getCurrentElder(userId);

  res.json({
    success: true,
    data: elder,
  });
});

// GET /api/elders/:id
export const getElderById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const id = toStringParam(req.params['id']);

  // อ่านรายละเอียดผู้สูงอายุ โดย service จะตรวจ ownership อีกชั้น
  // ไฟล์ถัดไป: services/elderService.ts
  const elder = await elderService.getElderById(userId, id);

  res.json({ success: true, data: elder });
});

// PUT /api/elders/:id
export const updateElder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const id = toStringParam(req.params['id']);
  const data = req.body;

  // แก้ไขข้อมูลผู้สูงอายุ โดย service จะตรวจ ownership ก่อน update
  // ไฟล์ถัดไป: services/elderService.ts
  const elder = await elderService.updateElder(userId, id, data);

  res.json({ success: true, message: 'อัปเดตผู้สูงอายุสำเร็จ', data: elder });
});
