/**
 * notificationService.ts
 *
 * Service สำหรับ business logic การแจ้งเตือน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - สร้าง notification สำหรับ fall detection และพยายามส่ง push ผ่าน Expo token
 * - ดึง / อ่าน / นับ notification ที่ยังไม่อ่าน (API user-scoped)
 * - แนบข้อมูล event กลับเข้า notification สำหรับหน้าแสดงรายการ
 */

import createDebug from 'debug';

import { sendNotification } from '../utils/pushNotification';
import prisma from '../prisma';
import { getHrStatus } from '../constants/heartRate';
import { Notification, Prisma } from '../generated/prisma/client';

const log = createDebug('fallhelp:notification');

const isValidExpoPushToken = (token: string | null | undefined): token is string =>
  // รองรับรูปแบบ token ของ Expo ทั้งชื่อเก่าและชื่อใหม่
  typeof token === 'string' &&
  (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

type EventSummary = {
  id: string;
  fallStage: string;
  timestamp: Date;
};

type NotificationWithEvent<T extends { eventId: string }> = T & {
  event: EventSummary | null;
};

interface ListNotificationsOptions {
  page?: number;
  pageSize?: number;
  isRead?: boolean;
}

interface ListNotificationsResult {
  notifications: Array<NotificationWithEvent<Notification>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const notifyFallDetection = async (
  elderId: string,
  eventId: string,
  heartRateAtFall: number | null = null,
) => {
  // หา elder พร้อม owner เพื่อรู้ว่าต้องสร้าง notification ให้ user คนใด
  const elder = await prisma.elder.findUnique({ where: { id: elderId }, include: { user: true } });

  if (!elder) return;

  let resolvedBpm = heartRateAtFall;

  if (resolvedBpm === null) {
    // ถ้า caller ไม่ส่ง BPM มา ให้ fallback ไปอ่านจาก event ที่บันทึกไว้
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { bpm: true },
    });

    if (event?.bpm) {
      resolvedBpm = event.bpm;
    }
  }

  const elderName = `${elder.firstName} ${elder.lastName}`;

  let messageBody = `${elderName} ต้องการความช่วยเหลือด่วน! กรุณาตรวจสอบทันที`;

  if (resolvedBpm !== null) {
    const bpm = Math.round(resolvedBpm);

    // แนบสถานะชีพจร ณ ตอนล้ม เพื่อให้ caregiver เห็นบริบทเพิ่มใน notification
    messageBody += ` ชีพจรขณะล้ม: ${bpm} BPM (${getHrStatus(bpm)})`;
  }

  // สร้าง notification ใน DB ก่อน แล้วค่อยพยายามส่ง push ไปยังผู้ดูแล
  await createNotification(
    {
      userId: elder.user.id,
      eventId,
      title: '🚨 แจ้งเตือนฉุกเฉิน! ตรวจพบการหกล้ม',
      message: messageBody,
      ...(resolvedBpm !== null
        ? { pushData: { bpm: Math.round(resolvedBpm), heartRateAtFall: Math.round(resolvedBpm) } }
        : {}),
    },
    elder.user.pushToken ?? undefined,
  );
};

export const createNotification = async (
  data: {
    userId: string;
    eventId: string;
    title: string;
    message: string;
    pushData?: Record<string, unknown>;
  },
  pushToken?: string,
) => {
  // บันทึก notification ลงฐานข้อมูลก่อนเสมอ เพราะ in-app notification คือ source หลัก
  const { pushData, ...dbData } = data;
  const notification = await prisma.notification.create({ data: dbData });

  if (pushToken) {
    // push เป็น side effect เสริม ถ้า token ไม่ถูกต้องให้ข้าม ไม่ทำให้ notification ล้ม
    if (!isValidExpoPushToken(pushToken)) {
      log('⚠️ ข้าม push: token ไม่ถูกต้องสำหรับ user %s — "%s"', data.userId, pushToken);
    } else {
      // ส่ง push ไปยังอุปกรณ์ของผู้ใช้
      // ไฟล์ถัดไป: utils/pushNotification.ts
      const sent = await sendNotification(pushToken, {
        title: data.title,
        body: data.message,
        data: { notificationId: notification.id, eventId: data.eventId, ...(pushData ?? {}) },
      });

      if (!sent) {
        log('❌ ส่ง push ล้มเหลวสำหรับ user %s — บันทึกในแอปเท่านั้น', data.userId);
      }
    }
  }

  return notification;
};

export const listNotifications = async (
  userId: string,
  options: ListNotificationsOptions = {},
): Promise<ListNotificationsResult> => {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.NotificationWhereInput = { userId };

  if (options.isRead !== undefined) {
    where.isRead = options.isRead;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.notification.count({ where }),
  ]);

  // แนบ event summary ให้ mobile แสดงรายละเอียดได้โดยไม่ต้องเรียก event แยก
  const notificationsWithEvents = await attachEventsToNotifications(notifications);

  return {
    notifications: notificationsWithEvents,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
};

export const attachEventsToNotifications = async <T extends { eventId: string }>(
  notifications: T[],
): Promise<Array<NotificationWithEvent<T>>> => {
  if (notifications.length === 0) {
    return [];
  }

  // ลบ eventId ซ้ำก่อน query เพื่อลดจำนวน id ที่ส่งเข้า where IN
  const uniqueEventIds = Array.from(new Set(notifications.map((n) => n.eventId)));

  // ดึง event ที่เกี่ยวข้องทั้งหมดในครั้งเดียว แล้ว map กลับเข้า notification ทีหลัง
  const events = await prisma.event.findMany({
    where: {
      id: { in: uniqueEventIds },
    },
    select: { id: true, fallStage: true, timestamp: true },
  });

  const eventMap = new Map<string, EventSummary>();

  for (const e of events) {
    eventMap.set(e.id, e);
  }

  return notifications.map((n) => {
    return { ...n, event: eventMap.get(n.eventId) || null };
  });
};

export const markNotificationRead = async (
  userId: string,
  notificationId: string,
  isRead: boolean,
): Promise<void> => {
  // updateMany ผูก id + userId เพื่อให้ user แก้ได้เฉพาะ notification ของตัวเอง
  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      isRead,
      readAt: isRead ? new Date() : null,
    },
  });
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  // จำกัดเฉพาะ unread notification ของ user ปัจจุบัน ลดการเขียนซ้ำโดยไม่จำเป็น
  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
};

export const getUnreadCount = async (userId: string): Promise<number> => {
  // ใช้กับ badge ของ mobile เพื่อแสดงจำนวนแจ้งเตือนที่ยังไม่อ่าน
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
};
