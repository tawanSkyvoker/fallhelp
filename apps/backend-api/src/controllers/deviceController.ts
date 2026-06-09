/**
 * deviceController.ts
 *
 * Controller สำหรับอุปกรณ์และการตั้งค่า WiFi
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับ request เกี่ยวกับ deviceCode, pairing และ WiFi config
 * - อ่าน userId จาก JWT เพื่อส่งให้ service ตรวจสิทธิ์
 * - แปลง route params ให้เป็น string ที่ใช้งานได้
 * - ส่ง response กลับให้ mobile ตาม flow การตั้งค่าอุปกรณ์
 */

import { Request, Response } from 'express';

import { toStringParam } from '../utils/param';
import * as deviceService from '../services/deviceService';
import { asyncHandler } from '../middlewares/errorHandler';
import { createError } from '../utils/ApiError';

// endpoint สำหรับ GET /api/devices/by-code/:deviceCode
export const getDeviceByCode = asyncHandler(async (req: Request, res: Response) => {
  const deviceCode = toStringParam(req.params['deviceCode']);

  // ใช้ตรวจอุปกรณ์หลังสแกน QR ก่อนเริ่ม pairing
  // ไฟล์ถัดไป: services/deviceService.ts
  const device = await deviceService.getDeviceByCode(deviceCode);

  res.json({ success: true, data: device });
});

// endpoint สำหรับ POST /api/device-pairings
export const pairDevice = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const { deviceCode, elderId } = req.body;

  // จับคู่อุปกรณ์กับผู้สูงอายุของ user ปัจจุบัน
  // ไฟล์ถัดไป: services/deviceService.ts
  const device = await deviceService.pairDevice(userId, deviceCode, elderId);

  res.json({ success: true, message: 'จับคู่อุปกรณ์สำเร็จ', data: device });
});

// endpoint สำหรับ DELETE /api/device-pairings/:deviceId
export const unpairDevice = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const id = toStringParam(req.params['deviceId']);

  // ยกเลิกการจับคู่ และให้ service จัดการ RESET_WIFI ถ้าจำเป็น
  // ไฟล์ถัดไป: services/deviceService.ts
  const device = await deviceService.unpairDevice(userId, id);

  res.json({ success: true, message: 'ยกเลิกการจับคู่สำเร็จ', data: device });
});

// endpoint สำหรับ PUT /api/devices/:id/wifi-config
export const configureWiFi = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const id = toStringParam(req.params['id']);
  const { ssid, wifiPassword } = req.body;

  // ส่งค่า WiFi ไปยังอุปกรณ์ผ่าน MQTT และรอ ACK จากอุปกรณ์
  // ไฟล์ถัดไป: services/deviceService.ts
  const result = await deviceService.configureWiFi(userId, id, ssid, wifiPassword);

  res.json({
    success: true,
    message: 'ส่งค่า WiFi ให้อุปกรณ์แล้ว (รอสถานะการเชื่อมต่อ)',
    data: result,
  });
});

// endpoint สำหรับ GET /api/devices/:id/wifi-config
export const getDeviceConfig = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const id = toStringParam(req.params['id']);

  // อ่านสถานะ WiFi config ปัจจุบันของอุปกรณ์
  // ไฟล์ถัดไป: services/deviceService.ts
  const config = await deviceService.getDeviceConfig(userId, id);

  res.json({ success: true, data: config });
});
