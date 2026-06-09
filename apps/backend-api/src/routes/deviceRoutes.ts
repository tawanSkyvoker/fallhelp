/**
 * deviceRoutes.ts
 *
 * เส้นทาง API สำหรับข้อมูลอุปกรณ์และ WiFi config
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - บังคับทุก endpoint ให้ผ่าน JWT
 * - เปิด endpoint สำหรับดูข้อมูลอุปกรณ์จาก deviceCode
 * - ส่งค่า WiFi config ไปยังอุปกรณ์ผ่าน backend
 * - อ่านสถานะ WiFi config ปัจจุบันของอุปกรณ์
 */

import { Router } from 'express';
import * as deviceController from '../controllers/deviceController';
import { authenticate } from '../middlewares/auth';
import { validateWiFiConfig } from '../middlewares/validation';

const router = Router();

// ต้องล็อกอินทุก endpoint เพราะข้อมูลอุปกรณ์ผูกกับผู้ใช้และผู้สูงอายุ
router.use(authenticate);

// ดูข้อมูลอุปกรณ์จาก deviceCode สำหรับขั้นตอนจับคู่
// ไฟล์ถัดไป: controllers/deviceController.ts
router.get('/by-code/:deviceCode', deviceController.getDeviceByCode);

// ส่งค่า WiFi ไปยังอุปกรณ์ผ่าน MQTT flow ฝั่ง backend
router.put('/:id/wifi-config', validateWiFiConfig, deviceController.configureWiFi);

// ดูสถานะ WiFi config ปัจจุบัน เช่น CONFIGURING, ERROR หรือ CONNECTED
router.get('/:id/wifi-config', deviceController.getDeviceConfig);

export default router;
