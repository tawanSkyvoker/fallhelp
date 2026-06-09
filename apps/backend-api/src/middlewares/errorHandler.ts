/**
 * errorHandler.ts
 *
 * Middleware สำหรับจัดการ error ของ backend
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แปลง error ภายในให้เป็น response มาตรฐาน
 * - แยก ApiError, Prisma error, JWT error และ fallback 500
 * - มี notFoundHandler สำหรับ route ที่ไม่พบ
 * - มี asyncHandler สำหรับห่อ async route/controller
 */

import { Request, Response, NextFunction } from 'express';
import createDebug from 'debug';

import { Prisma } from '../generated/prisma/client';
import { ApiError, ErrorMessages } from '../utils/ApiError';

const log = createDebug('fallhelp:error');

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // ApiError แบบ operational คือ error ที่ระบบคาดการณ์ไว้ จึง log แบบ warn
  // error อื่นถือเป็น error ที่ไม่คาดคิด จึง log object เต็มเพื่อช่วย debug
  if (error instanceof ApiError && error.isOperational) {
    log('[Warn]: %s', error.message);
  } else {
    log('[Error]: %O', error);
  }

  if (error instanceof ApiError) {
    // Error ที่สร้างจากระบบเองสามารถส่ง code/message ภาษาไทยกลับไป client ได้ตรง ๆ
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.messageTh,
      },
    });

    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // P2002 = ชน unique constraint เช่น email, phone, serialNumber หรือ deviceCode ซ้ำ
      const target = error.meta?.['target'] as string[] | undefined;
      let rawField = target?.[0];
      if (!rawField && error.meta?.['driverAdapterError']) {
        const adapterError = error.meta['driverAdapterError'] as Record<string, unknown>;
        const cause = adapterError['cause'] as Record<string, unknown> | undefined;
        const constraint = cause?.['constraint'] as Record<string, unknown> | undefined;
        const fields = constraint?.['fields'] as string[] | undefined;
        if (fields?.[0]) {
          rawField = fields[0].replace(/"/g, '');
        }
      }
      const field = rawField || 'unknown';

      const fieldMessages: Record<string, { code: string; message: string }> = {
        email: { code: 'email_already_exists', message: ErrorMessages.email_already_exists.th },
        phone: { code: 'phone_already_exists', message: 'หมายเลขโทรศัพท์นี้ถูกใช้งานแล้ว' },
        serialNumber: { code: 'serial_number_exists', message: 'หมายเลขซีเรียลนี้ถูกใช้งานแล้ว' },
        deviceCode: { code: 'device_code_exists', message: 'รหัสอุปกรณ์นี้ถูกใช้งานแล้ว' },
        ticketNumber: { code: 'ticket_number_exists', message: 'หมายเลขตั๋วนี้ถูกใช้งานแล้ว' },
      };

      const errorInfo = fieldMessages[field] || {
        code: 'duplicate_entry',
        message: `ข้อมูลซ้ำ: ${field} นี้ถูกใช้งานแล้ว`,
      };

      res.status(409).json({
        success: false,
        error: {
          code: errorInfo.code,
          message: errorInfo.message,
        },
      });

      return;
    }

    if (error.code === 'P2025') {
      // P2025 = query/update/delete หา record ที่ต้องใช้ไม่เจอ
      res.status(404).json({
        success: false,
        error: {
          code: 'resource_not_found',
          message: ErrorMessages.resource_not_found.th,
        },
      });

      return;
    }

    if (error.code === 'P2003') {
      // P2003 = foreign key ไม่สอดคล้อง เช่น อ้างอิง id ที่ไม่มีอยู่จริง
      res.status(400).json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'ข้อมูลที่อ้างอิงไม่ถูกต้อง',
        },
      });

      return;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    // เกิดจาก query shape ไม่ถูกต้อง เช่น type ผิดหรือ field ไม่ตรง schema
    res.status(400).json({
      success: false,
      error: {
        code: 'validation_error',
        message: ErrorMessages.validation_error.th,
      },
    });

    return;
  }

  if (error.name === 'JsonWebTokenError') {
    // token ถูกแก้ไขหรือไม่ถูกต้อง ให้ client กลับไป login ใหม่
    res.status(401).json({
      success: false,
      error: {
        code: 'invalid_token',
        message: ErrorMessages.invalid_token.th,
      },
    });

    return;
  }

  if (error.name === 'TokenExpiredError') {
    // token หมดอายุ แยก message ออกจาก invalid token เพื่อให้ client แสดงผลได้ถูกต้อง
    res.status(401).json({
      success: false,
      error: {
        code: 'session_expired',
        message: ErrorMessages.session_expired.th,
      },
    });

    return;
  }

  // fallback สำหรับ error ที่ไม่เข้าเงื่อนไขใดเลย ไม่เปิดเผยรายละเอียดภายในให้ client
  res.status(500).json({
    success: false,
    error: {
      code: 'internal_server_error',
      message: ErrorMessages.internal_server_error.th,
    },
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  // ใช้เมื่อไม่มี route ไหน match กับ request นี้
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
  });
};

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => unknown) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // ห่อ async controller เพื่อลด try/catch ซ้ำ และส่ง error ไป global errorHandler อัตโนมัติ
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
