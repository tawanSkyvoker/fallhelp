/**
 * eventService.ts
 *
 * Service สำหรับจัดการเหตุการณ์จากอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - สร้าง / ค้นหา / ยืนยัน / ยกเลิก fall event ผ่าน MQTT lifecycle
 * - ดึง event ของผู้สูงอายุแบบแบ่งหน้าและตรวจสิทธิ์เจ้าของ
 * - สรุปเหตุการณ์รายเดือนสำหรับหน้า report
 */

import prisma from '../prisma';
import { createError } from '../utils/ApiError';
import { HR_HIGH_THRESHOLD, HR_LOW_THRESHOLD } from '../constants/heartRate';

import { Prisma } from '../generated/prisma/client';
import type { FallStage } from '../constants/domain';

/** lookback window สำหรับหา pending fall event ที่ยังอยู่ในระยะยกเลิก/ยืนยันได้ */
const FALL_PENDING_LOOKBACK_MS = 120_000;

/** จุดกลางสำหรับสร้าง event เพื่อให้ field ที่บันทึกลง DB สม่ำเสมอทั้งระบบ */
export const createEvent = async (data: {
  elderId: string;
  deviceId: string;
  fallStage: FallStage;
  bpm?: number;
  magnitude?: number;
  postureDelta?: number;
  cancelledAt?: Date | null;
  timestamp?: Date;
}) => {
  const event = await prisma.event.create({
    data: {
      elderId: data.elderId,
      deviceId: data.deviceId,
      fallStage: data.fallStage,
      timestamp: data.timestamp || new Date(),
      ...(data.bpm !== undefined ? { bpm: data.bpm } : {}),
      ...(data.magnitude !== undefined ? { magnitude: data.magnitude } : {}),
      ...(data.postureDelta !== undefined ? { postureDelta: data.postureDelta } : {}),
      ...(data.cancelledAt !== undefined ? { cancelledAt: data.cancelledAt } : {}),
    },
    include: {
      elder: { select: { id: true, firstName: true, lastName: true } },
      device: { select: { id: true, deviceCode: true, serialNumber: true } },
    },
  });

  return event;
};

/**
 * ค้นหา pending fall event ล่าสุดของ device
 * ใช้ทั้ง suspected flow (ตรวจ dedup) และ confirmed flow (หา event ที่จะ confirm)
 */
export const findPendingFallEvent = async (
  deviceId: string,
): Promise<{ id: string; bpm: number | null; timestamp: Date } | null> => {
  return prisma.event.findFirst({
    where: {
      deviceId,
      fallStage: 'PENDING_CONFIRMATION',
      cancelledAt: null,
      timestamp: { gte: new Date(Date.now() - FALL_PENDING_LOOKBACK_MS) },
    },
    orderBy: { timestamp: 'desc' },
    select: { id: true, bpm: true, timestamp: true },
  });
};

/**
 * อัปเดต pending fall event เป็น CONFIRMED พร้อมข้อมูล sensor
 * เรียกหลัง ESP32 ส่ง fall_confirmed เท่านั้น
 */
export const confirmPendingFallEvent = async (
  eventId: string,
  data: { magnitude?: number; postureDelta?: number },
): Promise<{ id: string; timestamp: Date }> => {
  return prisma.event.update({
    where: { id: eventId },
    data: {
      fallStage: 'CONFIRMED',
      ...(data.magnitude !== undefined ? { magnitude: data.magnitude } : {}),
      ...(data.postureDelta !== undefined ? { postureDelta: data.postureDelta } : {}),
    },
    select: { id: true, timestamp: true },
  });
};

export const cancelFallEventByDevice = async (
  deviceId: string,
): Promise<{ id: string; timestamp: Date; elderId: string } | null> => {
  // ยกเลิกได้เฉพาะ event ที่ยังรอยืนยันเท่านั้น
  // CONFIRMED คือแจ้งเตือนออกไปแล้ว จึงไม่ให้ late MQTT ย้อนกลับเป็น CANCELLED
  const pendingFall = await prisma.event.findFirst({
    where: {
      deviceId,
      fallStage: 'PENDING_CONFIRMATION',
      cancelledAt: null,
      timestamp: { gte: new Date(Date.now() - FALL_PENDING_LOOKBACK_MS) },
    },
    orderBy: { timestamp: 'desc' },
  });

  if (pendingFall) {
    // ถือว่าเป็น false alarm ที่ผู้สวมอุปกรณ์กดยกเลิกทันเวลา
    await prisma.event.update({
      where: { id: pendingFall.id },
      data: {
        fallStage: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return { id: pendingFall.id, timestamp: pendingFall.timestamp, elderId: pendingFall.elderId };
  }

  return null;
};

export const getEventsByElder = async (
  userId: string,
  elderId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  } = {},
) => {
  // ผู้ใช้ดู event ได้เฉพาะ elder ที่เป็นของบัญชีตัวเอง
  const elder = await prisma.elder.findFirst({ where: { id: elderId, userId: userId } });
  if (!elder) throw createError.accessDenied();

  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.EventWhereInput = { elderId };

  if (options.startDate || options.endDate) {
    where.timestamp = {};
    if (options.startDate) where.timestamp.gte = options.startDate;
    if (options.endDate) where.timestamp.lte = options.endDate;
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: { device: { select: { deviceCode: true, serialNumber: true } } },
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return { events, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const getEventById = async (userId: string, eventId: string) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      elder: { select: { id: true, firstName: true, lastName: true } },
      device: { select: { deviceCode: true, serialNumber: true } },
    },
  });

  if (!event) throw createError.eventNotFound();

  // แม้รู้ eventId ก็ต้องเป็นเจ้าของ elder ของ event นี้ก่อน
  const elder = await prisma.elder.findFirst({ where: { id: event.elderId, userId: userId } });
  if (!elder) throw createError.accessDenied();

  return event;
};

export const getMonthlySummary = async (
  userId: string,
  elderId: string,
  year: number,
  month: number,
) => {
  // ตรวจสิทธิ์ก่อนอ่านข้อมูลสรุประดับเดือน
  const elder = await prisma.elder.findFirst({ where: { id: elderId, userId: userId } });
  if (!elder) throw createError.accessDenied();

  // ใช้ timezone Asia/Bangkok เป็นขอบเขตของเดือน ไม่ใช่ UTC ล้วน
  const startDate = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+07:00`);
  const nextMonthStart = new Date(
    `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01T00:00:00+07:00`,
  );

  // Query แรกนับ fall, แจกแจง BPM และนับ cancelled
  // Query ที่สองหา peak hour ของเหตุการณ์ล้มในเดือนนั้น
  const [countRows, peakHourRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        fall_count: bigint;
        hr_high_count: bigint;
        hr_normal_count: bigint;
        hr_low_count: bigint;
        hr_unknown_count: bigint;
        cancelled_count: bigint;
      }>
    >`
      SELECT
        COUNT(*) FILTER (WHERE "fallStage" = 'CONFIRMED')                                                                          AS fall_count,
        COUNT(*) FILTER (WHERE "fallStage" = 'CONFIRMED' AND bpm > ${HR_HIGH_THRESHOLD})                                           AS hr_high_count,
        COUNT(*) FILTER (WHERE "fallStage" = 'CONFIRMED' AND bpm >= ${HR_LOW_THRESHOLD} AND bpm <= ${HR_HIGH_THRESHOLD})           AS hr_normal_count,
        COUNT(*) FILTER (WHERE "fallStage" = 'CONFIRMED' AND bpm < ${HR_LOW_THRESHOLD})                                            AS hr_low_count,
        COUNT(*) FILTER (WHERE "fallStage" = 'CONFIRMED' AND bpm IS NULL)                                                          AS hr_unknown_count,
        COUNT(*) FILTER (WHERE "fallStage" = 'CANCELLED')                                                                          AS cancelled_count
      FROM "events"
      WHERE "elderId" = ${elderId}
        AND "timestamp" >= ${startDate}
        AND "timestamp" < ${nextMonthStart}
    `,
    prisma.$queryRaw<Array<{ hour: number; cnt: bigint }>>`
      SELECT EXTRACT(HOUR FROM ("timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::int AS hour, COUNT(*) AS cnt
      FROM "events"
      WHERE "elderId" = ${elderId}
        AND "timestamp" >= ${startDate}
        AND "timestamp" < ${nextMonthStart}
        AND "fallStage" = 'CONFIRMED'
      GROUP BY hour
      ORDER BY cnt DESC
      LIMIT 1
    `,
  ]);

  const countResult = countRows[0];
  const peakHour = peakHourRows.length > 0 ? Number(peakHourRows[0]?.hour ?? 0) : null;

  return {
    year,
    month,
    fallCount: Number(countResult?.fall_count ?? 0),
    heartRateAtFallHigh: Number(countResult?.hr_high_count ?? 0),
    heartRateAtFallNormal: Number(countResult?.hr_normal_count ?? 0),
    heartRateAtFallLow: Number(countResult?.hr_low_count ?? 0),
    heartRateAtFallUnknown: Number(countResult?.hr_unknown_count ?? 0),
    cancelledCount: Number(countResult?.cancelled_count ?? 0),
    peakHour,
  };
};
