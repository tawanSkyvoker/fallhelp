/**
 * otpScheduler.ts
 *
 * Scheduler สำหรับล้าง OTP ที่หมดอายุ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เรียก cleanup OTP ทันทีตอน startup
 * - ตั้ง interval ให้ cleanup ซ้ำทุก 1 ชั่วโมง
 * - log error ของ scheduler โดยไม่ทำให้ server หลักล้ม
 * - export initSchedulers ให้ server.ts เรียกหลัง bootstrap เสร็จ
 */

import { cleanupExpiredOtps } from '../services/authService';
import { recoverInconsistentDevices } from '../services/adminService';
import logger from '../utils/logger';
import createDebug from 'debug';

const log = createDebug('fallhelp:scheduler:otp');

const OTP_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const scheduleOtpCleanup = (): void => {
  // cleanup รอบแรกทันที เพื่อไม่ปล่อย OTP เก่าค้างหลังเปิด server
  // ไฟล์ถัดไป: services/authService.ts
  cleanupExpiredOtps().catch((error) => {
    log('Error in initial OTP cleanup: %O', error);
  });

  setInterval(async () => {
    try {
      await cleanupExpiredOtps();
    } catch (error) {
      // scheduler ไม่ควรทำให้ process หลักล้มจาก cleanup รอบเดียว
      log('Error cleaning up expired OTPs: %O', error);
    }
  }, OTP_CLEANUP_INTERVAL_MS);

  logger.info('OTP cleanup scheduler registered', { schedule: 'every 1 hour + on startup' });
};

export const initSchedulers = (): void => {
  scheduleOtpCleanup();

  // กู้คืนสถานะอุปกรณ์ที่ข้อมูลไม่สอดคล้อง (PAIRED แต่ไม่มี elderId) ตอนเปิด server
  recoverInconsistentDevices().catch((error) => {
    logger.error('Error running initial inconsistent devices recovery:', error);
  });

  logger.info('OTP scheduler initialized');
};
