/**
 * routes/index.ts
 *
 * จุดรวมเส้นทาง API หลักของ backend
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวม route ย่อยของแต่ละ domain
 * - กำหนด base path ใต้ /api ให้แต่ละ route group
 * - แยก route ปกติ, nested route และ admin route ให้ดูง่าย
 * - ส่ง router กลับให้ app.ts นำไป mount
 */

import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import elderRoutes from './elderRoutes';
import deviceRoutes from './deviceRoutes';
import devicePairingRoutes from './devicePairingRoutes';
import eventRoutes from './eventRoutes';
import emergencyContactRoutes from './emergencyContactRoutes';
import adminRoutes from './adminRoutes';
import notificationRoutes from './notificationRoutes';

const router = Router();

// หมวด auth
router.use('/auth', authRoutes);

// หมวดผู้ใช้และผู้สูงอายุ
router.use('/users', userRoutes);
router.use('/elders', elderRoutes);

// หมวดอุปกรณ์และเหตุการณ์
router.use('/devices', deviceRoutes);
router.use('/device-pairings', devicePairingRoutes);
router.use('/events', eventRoutes);

// หมวด notification
router.use('/notifications', notificationRoutes);

// Nested route สำหรับผู้ติดต่อฉุกเฉินของ elder แต่ละคน
router.use('/elders/:elderId/emergency-contacts', emergencyContactRoutes);

// หมวดแอดมิน
router.use('/admin', adminRoutes);

export default router;
