/**
 * elderRoutes.ts
 *
 * เส้นทาง API สำหรับข้อมูลผู้สูงอายุ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - บังคับทุก endpoint ให้ผ่าน JWT
 * - สร้างข้อมูลผู้สูงอายุของผู้ใช้ปัจจุบัน
 * - อ่านข้อมูลผู้สูงอายุปัจจุบันหรืออ่านตาม id
 * - แก้ไขข้อมูลผู้สูงอายุโดยให้ controller/service ตรวจสิทธิ์ต่อ
 */

import { Router } from 'express';
import * as elderController from '../controllers/elderController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// ผู้ใช้เข้าถึงได้เฉพาะข้อมูลผู้สูงอายุของตัวเอง
router.use(authenticate);

// จัดการข้อมูลผู้สูงอายุ
// ไฟล์ถัดไป: controllers/elderController.ts
router.post('/', elderController.createElder);
router.get('/current', elderController.getCurrentElder);
router.get('/:id', elderController.getElderById);
router.put('/:id', elderController.updateElder);

export default router;
