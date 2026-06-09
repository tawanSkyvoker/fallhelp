/**
 * authRoutes.ts
 *
 * เส้นทาง API สำหรับยืนยันตัวตน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด endpoint สำหรับ register, login, OTP และ reset password
 * - ใส่ rate limit ให้ endpoint ที่เสี่ยงถูกยิงซ้ำ
 * - validate request body ก่อนส่งต่อเข้า controller
 * - แยก logout เป็น endpoint ที่ต้องผ่าน JWT
 */

import { Router } from 'express';
import * as authController from '../controllers/authController';
import {
  validateLogin,
  validateRegister,
  validateOtpRequest,
  validateOtpVerification,
  validateResetPassword,
} from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import { authLimiter, loginLimiter, otpLimiter } from '../middlewares/rateLimit';

const router = Router();

// เส้นทางสาธารณะ ไม่ต้องมี JWT
// ไฟล์ถัดไป: controllers/authController.ts
router.post('/register', authLimiter, validateRegister, authController.register);
router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/admin-login', loginLimiter, validateLogin, authController.adminLogin);
router.post('/request-otp', otpLimiter, validateOtpRequest, authController.requestOtp);
router.post('/verify-otp', otpLimiter, validateOtpVerification, authController.verifyOtp);
router.post('/reset-password', otpLimiter, validateResetPassword, authController.resetPassword);

// logout ต้องมี JWT เพื่อรู้ว่า session นี้เป็นของ user คนใด
router.post('/logout', authenticate, authController.logout);

export default router;
