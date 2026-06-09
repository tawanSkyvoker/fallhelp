/**
 * notificationRoutes.ts
 *
 * เส้นทาง API สำหรับการแจ้งเตือน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - บังคับทุก endpoint ให้ผ่าน JWT
 * - ดูรายการแจ้งเตือนของผู้ใช้ปัจจุบัน
 * - ดูจำนวนแจ้งเตือนที่ยังไม่อ่าน
 * - mark read ได้ทั้งทีละรายการและทั้งหมด
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController';

const router = Router();

// notification ทุก endpoint อิง userId จาก JWT
router.use(authenticate);

// จัดการสถานะการอ่านแจ้งเตือน
// ไฟล์ถัดไป: controllers/notificationController.ts
router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/', markAllAsRead);
router.patch('/:id', markAsRead);

export default router;
