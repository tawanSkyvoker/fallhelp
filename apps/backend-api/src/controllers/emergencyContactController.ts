/**
 * emergencyContactController.ts
 *
 * Controller สำหรับผู้ติดต่อฉุกเฉิน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ใช้ nested route ใต้ /api/elders/:elderId/emergency-contacts
 * - อ่าน elderId และ contactId จาก params
 * - ส่ง CRUD และ reorder request เข้า service
 * - ใช้ userId จาก JWT เพื่อให้ service ตรวจ ownership ของ elder
 */

import { Request, Response } from 'express';

import { toStringParam } from '../utils/param';
import { createError } from '../utils/ApiError';
import { asyncHandler } from '../middlewares/errorHandler';
import * as emergencyContactService from '../services/emergencyContactService';

// endpoint สำหรับ POST /api/elders/:elderId/emergency-contacts
export const createEmergencyContact = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const elderId = toStringParam(req.params['elderId']);
  const { name, phone, relationship } = req.body;

  // เพิ่มผู้ติดต่อฉุกเฉินใต้ elder ที่ระบุ
  // ไฟล์ถัดไป: services/emergencyContactService.ts
  const contact = await emergencyContactService.createEmergencyContact(userId, elderId, {
    name,
    phone,
    relationship,
  });

  res.status(201).json({ success: true, message: 'เพิ่มเบอร์ติดต่อฉุกเฉินสำเร็จ', data: contact });
});

// endpoint สำหรับ GET /api/elders/:elderId/emergency-contacts
export const getEmergencyContacts = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const elderId = toStringParam(req.params['elderId']);

  // ดึงผู้ติดต่อฉุกเฉินทั้งหมดโดยเรียงตาม priority
  // ไฟล์ถัดไป: services/emergencyContactService.ts
  const contacts = await emergencyContactService.getEmergencyContacts(userId, elderId);

  res.json({ success: true, data: contacts });
});

// endpoint สำหรับ PATCH /api/elders/:elderId/emergency-contacts/:contactId
export const updateEmergencyContact = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const elderId = toStringParam(req.params['elderId']);
  const contactId = toStringParam(req.params['contactId']);
  const { name, phone, relationship, priority } = req.body;

  // แก้ไขผู้ติดต่อ โดย service จะเช็กว่า contact อยู่ใต้ elder นี้จริง
  // ไฟล์ถัดไป: services/emergencyContactService.ts
  const updated = await emergencyContactService.updateEmergencyContact(userId, elderId, contactId, {
    name,
    phone,
    relationship,
    priority,
  });

  res.json({ success: true, message: 'อัปเดตเบอร์ติดต่อฉุกเฉินสำเร็จ', data: updated });
});

// endpoint สำหรับ DELETE /api/elders/:elderId/emergency-contacts/:contactId
export const deleteEmergencyContact = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const elderId = toStringParam(req.params['elderId']);
  const contactId = toStringParam(req.params['contactId']);

  // ลบผู้ติดต่อฉุกเฉินของ elder ที่ระบุ
  // ไฟล์ถัดไป: services/emergencyContactService.ts
  await emergencyContactService.deleteEmergencyContact(userId, elderId, contactId);

  res.json({ success: true, message: 'ลบเบอร์ติดต่อฉุกเฉินสำเร็จ' });
});

// endpoint สำหรับ PATCH /api/elders/:elderId/emergency-contacts/order
export const reorderEmergencyContacts = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) throw createError.accessDenied();

  const elderId = toStringParam(req.params['elderId']);
  const { contactIds } = req.body;

  // จัดลำดับผู้ติดต่อใหม่ตาม array ที่ client ส่งมา
  // ไฟล์ถัดไป: services/emergencyContactService.ts
  await emergencyContactService.reorderEmergencyContacts(userId, elderId, contactIds);

  res.json({ success: true, message: 'จัดลำดับเบอร์ติดต่อฉุกเฉินสำเร็จ' });
});
