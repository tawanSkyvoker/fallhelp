/**
 * logger.ts
 *
 * ระบบ logging กลางของ mobile app สำหรับใส่ timestamp และแยกระดับ log ให้สม่ำเสมอ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ครอบ console ให้ทุก log มีรูปแบบ prefix เดียวกัน
 * - แยกระดับ debug, info, warn และ error
 * - จำกัด debug เฉพาะ dev build เพื่อลด noise ใน production
 * - รองรับ error object และ meta เพิ่มเติมสำหรับช่วย trace ปัญหา
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private static isDev = __DEV__;

  private static formatMessage(
    level: LogLevel,
    message: string,
    data?: unknown,
  ): { prefix: string; message: string; data?: unknown } {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    return { prefix, message, data };
  }

  static debug(message: string, data?: unknown): void {
    // debug ใช้เฉพาะตอน dev เพื่อดูรายละเอียด flow เช่น auth, socket, BLE และ network
    if (this.isDev) {
      const { prefix } = this.formatMessage('debug', message, data);

      if (data !== undefined) {
        console.debug(prefix, message, data);
      } else {
        console.debug(prefix, message);
      }
    }
  }

  static info(message: string, data?: unknown): void {
    const { prefix } = this.formatMessage('info', message, data);

    if (data !== undefined) {
      console.info(prefix, message, data);
    } else {
      console.info(prefix, message);
    }
  }

  static warn(message: string, data?: unknown): void {
    const { prefix } = this.formatMessage('warn', message, data);

    if (data !== undefined) {
      console.warn(prefix, message, data);
    } else {
      console.warn(prefix, message);
    }
  }

  static error(message: string, error?: unknown, meta?: unknown): void {
    const { prefix } = this.formatMessage('error', message, error);

    // meta ใช้แนบ context เพิ่ม เช่น request payload หรือ route params โดยไม่กลบ error หลัก
    if (error) {
      if (meta !== undefined) {
        console.error(prefix, message, error, meta);
      } else {
        console.error(prefix, message, '\n', error);
      }
    } else {
      console.error(prefix, message);
    }
  }
}

export default Logger;
