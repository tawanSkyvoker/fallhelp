/**
 * param.ts
 *
 * Utility สำหรับแปลง Express route/query params ให้เป็น string เสมอ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รองรับค่าจาก Express ที่อาจเป็น string, string[] หรือ undefined
 * - ดึงค่าแรกเมื่อ param เป็น array
 * - คืน string ว่างเมื่อไม่มีค่า เพื่อให้ controller ส่งต่อ service ได้อย่างคงที่
 */

export function toStringParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';

  return val ?? '';
}
