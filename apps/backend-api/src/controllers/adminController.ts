/**
 * adminController.ts
 *
 * Controller สำหรับฟีเจอร์ฝั่งแอดมิน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับ request จาก admin routes
 * - จัดการและควบคุมอุปกรณ์ระดับ admin
 */

import { Request, Response } from 'express';

import { toStringParam } from '../utils/param';
import * as adminService from '../services/adminService';
import { asyncHandler } from '../middlewares/errorHandler';

// endpoint สำหรับ POST /api/admin/devices
export const createDevice = asyncHandler(async (req: Request, res: Response) => {
  const { serialNumber } = req.body;

  // สร้างอุปกรณ์ใหม่หลังผ่าน validateCreateDevice จาก route แล้ว
  // ไฟล์ถัดไป: services/adminService.ts
  const device = await adminService.createDevice({
    serialNumber,
  });

  res.status(201).json({
    success: true,
    message: 'Device created successfully',
    data: device,
  });
});

// endpoint สำหรับ GET /api/admin/devices
export const getAllDevices = asyncHandler(async (req: Request, res: Response) => {
  // ดึงรายการอุปกรณ์ทั้งหมดพร้อม semantic status สำหรับหน้า admin
  // ไฟล์ถัดไป: services/adminService.ts
  const devices = await adminService.getAllDevices();

  res.json({
    success: true,
    data: devices,
  });
});

// endpoint สำหรับ DELETE /api/admin/devices/:id
export const deleteDevice = asyncHandler(async (req: Request, res: Response) => {
  const id = toStringParam(req.params['id']);

  // ลบได้เฉพาะอุปกรณ์ที่ยังไม่ถูกจับคู่
  // ไฟล์ถัดไป: services/adminService.ts
  await adminService.deleteDevice(id);

  res.json({
    success: true,
    message: 'Device deleted successfully',
  });
});

// endpoint สำหรับ POST /api/admin/devices/:id/unpair
export const forceUnpairDevice = asyncHandler(async (req: Request, res: Response) => {
  const actorId = req.user?.userId;
  const id = toStringParam(req.params['id']);

  // บังคับยกเลิกการจับคู่อุปกรณ์ในระดับ admin
  // ไฟล์ถัดไป: services/adminService.ts
  await adminService.forceUnpairDevice(id, actorId);

  res.json({
    success: true,
    message: 'Device unpaired successfully',
  });
});
