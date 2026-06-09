/**
 * adminRoutes.ts
 *
 * เส้นทาง API สำหรับผู้ดูแลระบบ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด route กลุ่ม /api/admin
 * - บังคับทุก endpoint ให้ผ่าน authenticate และ requireAdmin
 * - ส่ง request ต่อไปยัง adminController
 * - ใช้ validation เฉพาะ endpoint ที่ต้องรับข้อมูลจาก body
 */

import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middlewares/auth';
import { validateCreateDevice } from '../middlewares/validation';

const router = Router();

// ทุก route ในไฟล์นี้ต้องเป็นผู้ใช้ที่ login แล้ว และมีสิทธิ์ ADMIN เท่านั้น
router.use(authenticate);
router.use(requireAdmin);

// จัดการอุปกรณ์
router.post('/devices', validateCreateDevice, adminController.createDevice);
router.get('/devices', adminController.getAllDevices);
router.delete('/devices/:id', adminController.deleteDevice);
router.post('/devices/:id/unpair', adminController.forceUnpairDevice);

export default router;
