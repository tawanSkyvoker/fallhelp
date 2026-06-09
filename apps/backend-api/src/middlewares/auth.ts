/**
 * auth.ts
 *
 * Middleware สำหรับตรวจสอบตัวตนและสิทธิ์การเข้าถึง
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจ Bearer token จาก Authorization header
 * - verify JWT และตรวจว่าบัญชียังมีอยู่ในฐานข้อมูล
 * - แนบ decoded user เข้า req.user ให้ controller/service ใช้ต่อ
 * - ตรวจสิทธิ์ ADMIN สำหรับ route หลังบ้าน
 */

import { Request, Response, NextFunction } from 'express';
import debug from 'debug';

import { verifyToken } from '../utils/jwt';
import prisma from '../prisma';

const authDebug = debug('fallhelp:auth');

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // ต้องมี Authorization header รูปแบบ Bearer token ก่อนถึงจะเข้าถึง route ที่ล็อกอินได้
    const authHeader = req.headers.authorization;
    authDebug('Auth header present:', !!authHeader, 'Path:', req.path);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      authDebug('No token provided for path:', req.path);

      res.status(401).json({
        success: false,
        error: {
          code: 'missing_token',
          message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
        },
      });

      return;
    }

    // ตัด prefix Bearer ออก แล้วตรวจลายเซ็นและวันหมดอายุของ JWT
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    authDebug('Token verified for user:', decoded?.userId, 'path:', req.path);

    // ตรวจซ้ำกับฐานข้อมูล เพื่อกัน token ที่ยังไม่หมดอายุแต่บัญชีถูกลบไปแล้ว
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true },
    });

    if (!user) {
      authDebug('User account no longer exists:', decoded.userId);

      res.status(401).json({
        success: false,
        error: {
          code: 'invalid_token',
          message: 'Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
        },
      });

      return;
    }

    // แนบข้อมูล user จาก token ไว้ให้ controller/service ชั้นถัดไปใช้งาน
    req.user = decoded;

    next();
  } catch (error) {
    authDebug('Token verification failed:', (error as Error).message);

    res.status(401).json({
      success: false,
      error: {
        code: 'invalid_token',
        message: 'Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
      },
    });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  // middleware นี้ต้องใช้หลัง authenticate เพราะต้องอาศัย req.user
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
    });

    return;
  }

  // 403 คือยืนยันตัวตนแล้ว แต่ไม่มีสิทธิ์ ADMIN
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (ต้องการสิทธิ์ Admin)',
    });

    return;
  }

  next();
};
