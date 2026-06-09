/**
 * devicePairingRoutes.ts
 *
 * เส้นทาง API สำหรับการจับคู่และยกเลิกจับคู่อุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - บังคับทุก endpoint ให้ผ่าน JWT
 * - ส่ง request จับคู่อุปกรณ์เข้า deviceController
 * - ส่ง request ยกเลิกจับคู่อุปกรณ์เข้า deviceController
 */

import { Router } from 'express';
import * as deviceController from '../controllers/deviceController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// ทุก endpoint ในกลุ่มนี้ต้องรู้ userId จาก JWT ก่อนจัดการ pairing
router.use(authenticate);

// จัดการ pairing ของอุปกรณ์
// ไฟล์ถัดไป: controllers/deviceController.ts
router.post('/', deviceController.pairDevice);
router.delete('/:deviceId', deviceController.unpairDevice);

export default router;
