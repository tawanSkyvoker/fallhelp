/**
 * healthController.ts
 *
 * Controller สำหรับตรวจสุขภาพระบบ backend
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจการเชื่อมต่อ Database
 * - ตรวจสถานะ MQTT client
 * - คำนวณ uptime และ response time ของ process
 * - ส่งสถานะรวมกลับเป็น ok หรือ degraded
 */

import { Request, Response } from 'express';

import prisma from '../../prisma';
import { mqttClient } from '../../iot/mqttClient';
import { backendEnv } from '../../config/env';

// GET /internal/health
export const getHealth = async (_req: Request, res: Response) => {
  const startTime = Date.now();

  let dbStatus: 'connected' | 'disconnected' = 'connected';

  try {
    // ตรวจว่า Database ยังตอบ query พื้นฐานได้หรือไม่
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'disconnected';
  }

  // MQTT เป็น service เสริม ใช้รายงานสถานะ แต่ไม่ทำให้ health endpoint fail โดยตรง
  const mqttStatus = mqttClient.isClientConnected() ? 'connected' : 'disconnected';

  // uptime ใช้บอกว่า process backend รันต่อเนื่องมานานแค่ไหน
  const uptimeSeconds = process.uptime();
  const uptimeFormatted = formatUptime(uptimeSeconds);

  // ตอนนี้ถือว่า database เป็น service หลักที่กำหนด health รวมของระบบ
  const allHealthy = dbStatus === 'connected';

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: uptimeFormatted,
    responseTimeMs: Date.now() - startTime,
    services: {
      database: dbStatus,
      mqtt: mqttStatus,
    },
    version: backendEnv.packageVersion,
  });
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.length > 0 ? parts.join(' ') : '< 1m';
}
