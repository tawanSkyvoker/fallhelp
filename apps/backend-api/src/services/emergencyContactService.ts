/**
 * emergencyContactService.ts
 *
 * Service สำหรับจัดการผู้ติดต่อฉุกเฉินของผู้สูงอายุ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ตรวจสอบ ownership ของ elder ก่อนทำทุก operation
 * - สร้าง อ่าน แก้ไข และลบ emergency contact
 * - คำนวณ priority ถัดไปตอนสร้างผู้ติดต่อใหม่
 * - จัดเรียงลำดับผู้ติดต่อใหม่ด้วย transaction
 */

import prisma from '../prisma';
import { createError, ApiError } from '../utils/ApiError';

const verifyElderOwnership = async (userId: string, elderId: string) => {
  // ตรวจว่า elder มีอยู่จริงและเป็นของ user ปัจจุบัน
  const elder = await prisma.elder.findUnique({ where: { id: elderId } });

  if (!elder) throw new ApiError('resource_not_found', 'ไม่พบข้อมูลผู้สูงอายุ');
  if (elder.userId !== userId) throw createError.accessDenied();

  return elder;
};

const getContactOrThrow = async (contactId: string) => {
  // ดึง contact ตาม id และ throw error กลางถ้าไม่พบ
  const contact = await prisma.emergencyContact.findUnique({ where: { id: contactId } });

  if (!contact) throw new ApiError('resource_not_found', 'ไม่พบข้อมูลผู้ติดต่อฉุกเฉิน');

  return contact;
};

export const createEmergencyContact = async (
  userId: string,
  elderId: string,
  data: { name: string; phone: string; relationship: string },
) => {
  await verifyElderOwnership(userId, elderId);

  // priority ใหม่ต่อจาก record ล่าสุด เพื่อให้รายการเรียงตามลำดับที่ผู้ใช้เพิ่ม
  const lastContact = await prisma.emergencyContact.findFirst({
    where: { elderId },
    orderBy: { priority: 'desc' },
  });

  const nextPriority = (lastContact?.priority || 0) + 1;

  const contact = await prisma.emergencyContact.create({
    data: {
      elderId,
      name: data.name,
      phone: data.phone,
      relationship: data.relationship,
      priority: nextPriority,
    },
  });

  return contact;
};

export const getEmergencyContacts = async (userId: string, elderId: string) => {
  await verifyElderOwnership(userId, elderId);

  // คืนผู้ติดต่อฉุกเฉินตาม priority ที่ผู้ใช้จัดเรียงไว้
  const contacts = await prisma.emergencyContact.findMany({
    where: { elderId },
    orderBy: { priority: 'asc' },
  });

  return contacts;
};

export const updateEmergencyContact = async (
  userId: string,
  elderId: string,
  contactId: string,
  data: { name?: string; phone?: string; relationship?: string; priority?: number },
) => {
  await verifyElderOwnership(userId, elderId);

  const contact = await getContactOrThrow(contactId);

  // แม้ user จะเป็นเจ้าของ elder แล้ว ก็ต้องเช็กว่า contact นี้อยู่ใต้ elder เดียวกันจริง
  if (contact.elderId !== elderId) {
    throw createError.accessDenied();
  }

  const updated = await prisma.emergencyContact.update({
    where: { id: contactId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.relationship !== undefined ? { relationship: data.relationship } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
    },
  });

  return updated;
};

export const deleteEmergencyContact = async (
  userId: string,
  elderId: string,
  contactId: string,
) => {
  await verifyElderOwnership(userId, elderId);

  const contact = await getContactOrThrow(contactId);

  // กันการลบ contact ที่ไม่ได้อยู่ใต้ elder ของ route นี้
  if (contact.elderId !== elderId) {
    throw createError.accessDenied();
  }

  await prisma.emergencyContact.delete({
    where: { id: contactId },
  });
};

export const reorderEmergencyContacts = async (
  userId: string,
  elderId: string,
  contactIds: string[],
) => {
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw createError.validationError('รหัสผู้ติดต่อไม่ถูกต้อง');
  }

  await verifyElderOwnership(userId, elderId);

  await prisma.$transaction(async (tx) => {
    // เพิ่ม priority ชั่วคราวก่อน เพื่อหลบ unique constraint ระหว่างสลับลำดับหลายรายการ
    for (const id of contactIds) {
      await tx.emergencyContact.update({
        where: { id },
        data: { priority: { increment: 1000 } },
      });
    }

    // ตั้ง priority จริงตามลำดับใหม่ที่ client ส่งมา
    for (const [index, id] of contactIds.entries()) {
      await tx.emergencyContact.update({
        where: { id },
        data: { priority: index + 1 },
      });
    }
  });
};
