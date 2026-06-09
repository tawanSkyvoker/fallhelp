/**
 * date.ts
 *
 * Helper สำหรับจัดการวันที่และ timestamp ที่แสดงใน mobile app
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - normalize ปี พ.ศ. ที่อาจหลุดมาในข้อมูลเก่าให้กลับเป็น ค.ศ.
 * - format date-only สำหรับส่งวันเกิดไป backend
 * - parse date-only กลับเป็น Date ใน local timezone
 * - format timestamp เป็นวันที่และเวลาไทยแบบปี พ.ศ.
 */

const BUDDHIST_ERA_OFFSET = 543;
const BUDDHIST_ERA_THRESHOLD_YEAR = 2400;

const THAI_SHORT_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
] as const;

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function normalizeBirthDate(date: Date): Date {
  const normalizedDate = new Date(date);

  // บางข้อมูลเก่าอาจหลุดมาเป็นปี พ.ศ. จึง normalize กลับเป็น ค.ศ. ก่อนใช้งานจริง
  if (normalizedDate.getFullYear() > BUDDHIST_ERA_THRESHOLD_YEAR) {
    normalizedDate.setFullYear(normalizedDate.getFullYear() - BUDDHIST_ERA_OFFSET);
  }

  return normalizedDate;
}

export function formatDateOnly(date: Date): string {
  const normalizedDate = normalizeBirthDate(date);

  // ใช้ส่ง payload วันเกิดให้ backend ในรูปแบบ YYYY-MM-DD
  return `${normalizedDate.getFullYear()}-${padDatePart(normalizedDate.getMonth() + 1)}-${padDatePart(normalizedDate.getDate())}`;
}

export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match) {
    // สร้าง Date ด้วย local timezone เพื่อกัน date-only เลื่อนวันจาก timezone UTC
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);

    return normalizeBirthDate(new Date(year, month, day));
  }

  return normalizeBirthDate(new Date(value));
}

export function parseBirthDate(value: string | Date): Date {
  // helper ที่สื่อชัดว่าใช้กับวันเกิดหรือวันที่ผู้ใช้กรอก ไม่ใช่ timestamp ทั่วไป
  return value instanceof Date ? normalizeBirthDate(value) : parseDateOnly(value);
}

type ThaiBuddhistDateTimeOptions = {
  useTodayLabel?: boolean;
  year?: 'numeric' | '2-digit';
  separator?: string;
};

function formatThaiTime(date: Date): string {
  return `${date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
}

function isSameLocalDate(first: Date, second: Date): boolean {
  return (
    first.getDate() === second.getDate() &&
    first.getMonth() === second.getMonth() &&
    first.getFullYear() === second.getFullYear()
  );
}

export function formatThaiBuddhistDateTime(
  value: string | Date,
  options: ThaiBuddhistDateTimeOptions = {},
): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return '--';

  const timeText = formatThaiTime(date);

  // ใช้กับรายการล่าสุด เช่น notification/event เพื่อให้อ่านง่ายขึ้นเมื่อเป็นวันเดียวกัน
  if (options.useTodayLabel && isSameLocalDate(date, new Date())) {
    return `วันนี้${options.separator ?? ', '}${timeText}`;
  }

  // บังคับปีเป็น พ.ศ. เอง เพื่อให้ผลลัพธ์ตรงกันทุก runtime
  const buddhistYear = date.getFullYear() + BUDDHIST_ERA_OFFSET;
  const yearText =
    options.year === '2-digit' ? String(buddhistYear).slice(-2) : String(buddhistYear);

  const dateText = `${date.getDate()} ${THAI_SHORT_MONTHS[date.getMonth()]} ${yearText}`;

  return `${dateText}${options.separator ?? ' '}${timeText}`;
}
