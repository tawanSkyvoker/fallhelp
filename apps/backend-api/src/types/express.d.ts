/**
 * express.d.ts
 *
 * Type declaration สำหรับขยาย Express Request ของ FallHelp
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เพิ่ม req.user สำหรับข้อมูลจาก JWT หลังผ่าน authenticate middleware
 * - เพิ่ม req.elderId สำหรับ route บางตัวที่อ่าน elderId จาก path param
 * - ทำให้ controller เรียกใช้ค่าที่ middleware เติมไว้ได้แบบ type-safe
 */

import { JwtPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      elderId?: string;
    }
  }
}
