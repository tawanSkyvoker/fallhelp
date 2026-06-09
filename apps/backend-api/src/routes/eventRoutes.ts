/**
 * eventRoutes.ts
 *
 * เส้นทาง API สำหรับเหตุการณ์จากอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - บังคับทุก endpoint ให้ผ่าน JWT
 * - เปิด endpoint สำหรับดูรายการเหตุการณ์
 * - เปิด endpoint สำหรับสรุปรายเดือน
 * - เปิด endpoint สำหรับดูรายละเอียดเหตุการณ์รายตัว
 */

import { Router } from 'express';
import * as eventController from '../controllers/eventController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// ผู้ใช้ดูได้เฉพาะ event ของผู้สูงอายุที่ตัวเองดูแล
router.use(authenticate);

// ดูรายการเหตุการณ์แบบ filter/pagination
// ไฟล์ถัดไป: controllers/eventController.ts
router.get('/', eventController.getEvents);

// ต้องประกาศก่อน /:id เพื่อไม่ให้ Express ตีความ summary เป็น id
router.get('/summary/monthly', eventController.getMonthlySummary);

// ดูรายละเอียดเหตุการณ์ตาม id
router.get('/:id', eventController.getEventById);

export default router;
