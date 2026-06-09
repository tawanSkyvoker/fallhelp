/**
 * logger.ts
 *
 * Utility logging กลางของ FallHelp backend
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง log แบบ JSON ใน production และแบบอ่านง่ายใน development
 * - รองรับระดับ debug, info, warn และ error
 * - format error object ให้มี name, message และ stack ตาม environment
 * - มี audit log สำหรับ operation สำคัญที่ต้องบันทึกเสมอ
 */

import { backendEnv, type BackendLogLevel } from '../config/env';

type LogLevel = BackendLogLevel;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[backendEnv.logLevel];
}

function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: backendEnv.isProduction ? undefined : error.stack,
    };
  }

  return { errorMessage: String(error) };
}

function writeLog(entry: LogEntry): void {
  const output = backendEnv.isProduction
    ? JSON.stringify(entry)
    : `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${
        entry.context ? ' ' + JSON.stringify(entry.context) : ''
      }`;

  switch (entry.level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'debug':
      console.debug(output);
      break;
    default:
      console.log(output);
  }
}

function createLogEntry(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  };

  writeLog(entry);
}

const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    createLogEntry('debug', message, context);
  },

  info: (message: string, context?: Record<string, unknown>) => {
    createLogEntry('info', message, context);
  },

  warn: (message: string, context?: Record<string, unknown>) => {
    createLogEntry('warn', message, context);
  },

  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    // รวม error detail กับ context เพิ่มเติม เช่น requestId หรือ userId
    const errorContext = error ? { ...formatError(error), ...context } : context;

    createLogEntry('error', message, errorContext);
  },

  audit: (action: string, context: Record<string, unknown>) => {
    // audit log บันทึกเสมอ ไม่ขึ้นกับ LOG_LEVEL ปกติ
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[AUDIT] ${action}`,
      context: { ...context, audit: true },
    };

    writeLog(entry);
  },
};

export default logger;
