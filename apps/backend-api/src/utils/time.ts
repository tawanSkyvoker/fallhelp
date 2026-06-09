/**
 * time.ts
 *
 * Utility สำหรับจัดการวันที่และเวลา
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - format วันที่เป็นภาษาไทยหรือ ISO string
 * - ตรวจวันหมดอายุและสร้างวันหมดอายุจากนาที/วัน
 * - คำนวณอายุจากวันเกิด
 * - สร้าง start/end range สำหรับ query ตามวันหรือจำนวนวันย้อนหลัง
 */

export const formatDateThai = (date: Date): string => {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatDateISO = (date: Date): string => {
  return date.toISOString();
};

export const isExpired = (expiryDate: Date): boolean => {
  return new Date() > expiryDate;
};

export const addMinutes = (minutes: number): Date => {
  const date = new Date();

  // ใช้กับ OTP expiry และ flow ที่ต้องเพิ่มเวลาจากปัจจุบัน
  date.setMinutes(date.getMinutes() + minutes);

  return date;
};

export const addDays = (days: number): Date => {
  const date = new Date();

  date.setDate(date.getDate() + days);

  return date;
};

export const calculateAge = (birthDate: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  // ถ้ายังไม่ถึงวันเกิดของปีนี้ ต้องลดอายุลง 1 ปี
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

export const getStartOfDay = (date: Date): Date => {
  const start = new Date(date);

  start.setHours(0, 0, 0, 0);

  return start;
};

export const getEndOfDay = (date: Date): Date => {
  const end = new Date(date);

  end.setHours(23, 59, 59, 999);

  return end;
};

export const getDateRange = (days: number): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date();

  start.setDate(start.getDate() - days);

  return { start, end };
};
