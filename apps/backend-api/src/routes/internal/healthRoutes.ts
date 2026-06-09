/**
 * healthRoutes.ts
 *
 * เส้นทาง API สำหรับตรวจสอบสถานะระบบภายใน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด route ภายในสำหรับ health check
 * - ไม่อยู่ใต้ /api สำหรับผู้ใช้ทั่วไป
 * - ส่ง request ต่อไปยัง healthController
 */

import { Router } from 'express';
import { getHealth } from '../../controllers/internal/healthController';

const router = Router();

// GET /internal/health
// ตรวจสถานะ Database, MQTT, uptime และ version ของ backend
// ไฟล์ถัดไป: controllers/internal/healthController.ts
router.get('/', getHealth);

export default router;
