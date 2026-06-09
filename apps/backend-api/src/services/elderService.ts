/**
 * elderService.ts
 *
 * Service สำหรับจัดการข้อมูลผู้สูงอายุ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - สร้างข้อมูลผู้สูงอายุของผู้ใช้ปัจจุบัน
 * - ดึงข้อมูลผู้สูงอายุพร้อม device และ emergency contacts
 * - แก้ไขข้อมูลผู้สูงอายุโดยตรวจสิทธิ์เจ้าของก่อน
 * - normalize date-only และเติม device connectivity semantics ก่อนส่ง response
 */

import prisma from '../prisma';
import { createError } from '../utils/ApiError';
import { attachNestedDeviceSemantics } from '../utils/deviceSemantics';

// online/offline เป็น derived state ของ response เท่านั้น
// ใช้ helper กลางเพื่อให้ elder/device/admin endpoints ส่ง semantics ชุดเดียวกัน
const attachDeviceConnectivity = attachNestedDeviceSemantics;

function ensureOptionalInteger(value: number | undefined, fieldLabel: string): number | undefined {
  if (value === undefined) return undefined;

  // field บางตัว เช่น ส่วนสูง ต้องเป็นจำนวนเต็มก่อนบันทึกลงฐานข้อมูล
  if (!Number.isInteger(value)) {
    throw createError.validationError(`${fieldLabel}ต้องเป็นจำนวนเต็ม`);
  }

  return value;
}

function normalizeOptionalDateOnly(value: Date | string | undefined): Date | undefined {
  if (value === undefined) return undefined;

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);

    if (dateOnlyMatch) {
      // date-only จาก client จะถูกแปลงเป็น UTC date เพื่อลดปัญหา timezone เลื่อนวัน
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]) - 1;
      const day = Number(dateOnlyMatch[3]);

      return new Date(Date.UTC(year, month, day));
    }

    return new Date(trimmedValue);
  }

  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
}

function formatDateOnlyForResponse(
  value: Date | string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedValue);

    if (dateOnlyMatch) {
      return trimmedValue;
    }

    value = new Date(trimmedValue);
  }

  // ส่ง dateOfBirth กลับเป็น YYYY-MM-DD เสมอ เพราะเป็น date-only ไม่ใช่ timestamp
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function serializeElderDateOfBirth<T extends { dateOfBirth?: Date | string | null }>(
  elder: T,
): Omit<T, 'dateOfBirth'> & { dateOfBirth?: string | null } {
  const formattedDateOfBirth = formatDateOnlyForResponse(elder.dateOfBirth);

  return {
    ...elder,
    ...(formattedDateOfBirth !== undefined ? { dateOfBirth: formattedDateOfBirth } : {}),
  };
}

export const createElder = async (
  userId: string,
  data: {
    firstName: string;
    lastName: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfBirth?: Date | string;
    height?: number;
    weight?: number;
    diseases?: string | null;
    phone?: string | null;
    houseNumber?: string;
    villageNumber?: string;
    villageName?: string | null;
    subdistrict?: string;
    district?: string;
    province?: string;
    zipcode?: string;
  },
) => {
  const normalizedHeight = ensureOptionalInteger(data.height, 'ส่วนสูง');
  const normalizedDateOfBirth = normalizeOptionalDateOnly(data.dateOfBirth);

  // สร้างผู้สูงอายุใหม่โดยผูกกับ userId ของผู้ใช้ปัจจุบัน
  const elder = await prisma.elder.create({
    data: {
      userId: userId,
      firstName: data.firstName,
      lastName: data.lastName,
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
      ...(normalizedHeight !== undefined ? { height: normalizedHeight } : {}),
      ...(data.weight !== undefined ? { weight: data.weight } : {}),
      ...(data.diseases !== undefined ? { diseases: data.diseases } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.houseNumber !== undefined ? { houseNumber: data.houseNumber } : {}),
      ...(data.villageNumber !== undefined ? { villageNumber: data.villageNumber } : {}),
      ...(data.villageName !== undefined ? { villageName: data.villageName } : {}),
      ...(data.subdistrict !== undefined ? { subdistrict: data.subdistrict } : {}),
      ...(data.district !== undefined ? { district: data.district } : {}),
      ...(data.province !== undefined ? { province: data.province } : {}),
      ...(data.zipcode !== undefined ? { zipcode: data.zipcode } : {}),
      ...(normalizedDateOfBirth !== undefined ? { dateOfBirth: normalizedDateOfBirth } : {}),
    },
    include: {
      device: true,
    },
  });

  // เติมสถานะ device แบบ semantic และแปลง dateOfBirth กลับเป็น date-only string
  return serializeElderDateOfBirth(attachDeviceConnectivity(elder));
};

export const getCurrentElder = async (userId: string) => {
  // ดึง elder คนเดียวที่ผูกกับ user ปัจจุบัน
  // Elder.userId เป็น @unique ตาม single-caregiver model
  const elder = await prisma.elder.findUnique({
    where: { userId: userId },
    include: {
      device: true,
      emergencyContacts: { orderBy: { priority: 'asc' } },
    },
  });

  return elder ? serializeElderDateOfBirth(attachDeviceConnectivity(elder)) : null;
};

export const getElderById = async (userId: string, elderId: string) => {
  const elder = await prisma.elder.findUnique({
    where: { id: elderId },
    include: {
      device: true,
      emergencyContacts: { orderBy: { priority: 'asc' } },
    },
  });

  // กันการอ่านข้อมูลผู้สูงอายุข้ามบัญชี
  if (!elder || elder.userId !== userId) {
    throw createError.elderNotFound();
  }

  return serializeElderDateOfBirth(attachDeviceConnectivity(elder));
};

export const updateElder = async (
  userId: string,
  elderId: string,
  data: {
    firstName?: string;
    lastName?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    dateOfBirth?: Date | string;
    height?: number;
    weight?: number;
    diseases?: string | null;
    phone?: string | null;
    houseNumber?: string;
    villageNumber?: string;
    villageName?: string | null;
    subdistrict?: string;
    district?: string;
    province?: string;
    zipcode?: string;
  },
) => {
  const normalizedHeight = ensureOptionalInteger(data.height, 'ส่วนสูง');
  const normalizedDateOfBirth = normalizeOptionalDateOnly(data.dateOfBirth);

  // ตรวจสิทธิ์เจ้าของก่อนแก้ไขข้อมูลผู้สูงอายุ
  const existing = await prisma.elder.findUnique({ where: { id: elderId } });
  if (!existing || existing.userId !== userId) throw createError.accessDenied();

  const elder = await prisma.elder.update({
    where: { id: elderId },
    data: {
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
      ...(normalizedHeight !== undefined ? { height: normalizedHeight } : {}),
      ...(data.weight !== undefined ? { weight: data.weight } : {}),
      ...(data.diseases !== undefined ? { diseases: data.diseases } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.houseNumber !== undefined ? { houseNumber: data.houseNumber } : {}),
      ...(data.villageNumber !== undefined ? { villageNumber: data.villageNumber } : {}),
      ...(data.villageName !== undefined ? { villageName: data.villageName } : {}),
      ...(data.subdistrict !== undefined ? { subdistrict: data.subdistrict } : {}),
      ...(data.district !== undefined ? { district: data.district } : {}),
      ...(data.province !== undefined ? { province: data.province } : {}),
      ...(data.zipcode !== undefined ? { zipcode: data.zipcode } : {}),
      ...(normalizedDateOfBirth !== undefined ? { dateOfBirth: normalizedDateOfBirth } : {}),
    },
    include: { device: true, emergencyContacts: { orderBy: { priority: 'asc' } } },
  });

  return serializeElderDateOfBirth(attachDeviceConnectivity(elder));
};
