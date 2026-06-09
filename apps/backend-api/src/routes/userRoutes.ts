/**
 * userRoutes.ts
 *
 * เส้นทาง API สำหรับข้อมูลผู้ใช้ปัจจุบัน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - บังคับทุก endpoint ให้ผ่าน JWT
 * - ใช้รูปแบบ /me เพื่อสื่อว่าเป็นข้อมูลของผู้ใช้ที่ล็อกอินอยู่
 * - เปิด endpoint สำหรับดูและแก้ไขโปรไฟล์
 * - เปิด endpoint สำหรับเปลี่ยนรหัสผ่านและอัปเดต push token
 */

import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// ทุก endpoint ใช้ userId จาก JWT เป็นเจ้าของข้อมูล
router.use(authenticate);

// โปรไฟล์ผู้ใช้ปัจจุบัน
// ไฟล์ถัดไป: controllers/userController.ts
router.get('/me', userController.getProfile);
router.patch('/me', userController.updateProfile);
router.put('/me/password', userController.changePassword);
router.put('/me/push-token', userController.updatePushToken);

export default router;
