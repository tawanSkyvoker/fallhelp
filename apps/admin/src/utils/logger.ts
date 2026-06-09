/**
 * logger.ts
 *
 * Logger กลางของ Admin Panel
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ใส่ timestamp และ log level ให้ข้อความ log
 * - แสดง debug เฉพาะตอนรันบน localhost หรือ LAN dev host
 * - รวม method debug, info, warn และ error ให้เรียกใช้รูปแบบเดียวกัน
 */

type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  private static isDev =
    typeof window !== "undefined" &&
    /^(localhost|127\\.0\\.0\\.1|10\\.|192\\.168\\.|172\\.(1[6-9]|2\\d|3[0-1])\\.)/.test(
      window.location.hostname
    );

  private static formatMessage(level: LogLevel, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    return { prefix, message, data };
  }

  static debug(message: string, data?: unknown) {
    if (this.isDev) {
      const { prefix } = this.formatMessage("debug", message, data);

      if (data) {
        console.debug(prefix, message, data);
      } else {
        console.debug(prefix, message);
      }
    }
  }

  static info(message: string, data?: unknown) {
    const { prefix } = this.formatMessage("info", message, data);

    if (data) {
      console.info(prefix, message, data);
    } else {
      console.info(prefix, message);
    }
  }

  static warn(message: string, data?: unknown) {
    const { prefix } = this.formatMessage("warn", message, data);

    if (data) {
      console.warn(prefix, message, data);
    } else {
      console.warn(prefix, message);
    }
  }

  static error(message: string, error?: unknown) {
    const { prefix } = this.formatMessage("error", message, error);

    if (error) {
      console.error(prefix, message, error);
    } else {
      console.error(prefix, message);
    }
  }
}

export default Logger;
