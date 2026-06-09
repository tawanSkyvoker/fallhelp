/**
 * heartRate.ts
 *
 * ค่าเกณฑ์ชีพจรกลางสำหรับ mobile app
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด threshold ของชีพจรสูงและต่ำ
 * - แปลงค่า BPM เป็น label และสีที่ใช้แสดงใน UI
 * - ใช้ร่วมกันระหว่าง history และหน้าที่แสดงสถานะชีพจร
 */

export const HR_HIGH_THRESHOLD = 100;
export const HR_LOW_THRESHOLD = 60;

export interface HrStatusStyle {
  label: string;
  color: string;
  bg: string;
}

export function getHrStatus(bpm: number): HrStatusStyle {
  // BPM สูงกว่าเกณฑ์ แสดงเป็นสถานะสูงกว่าปกติ
  if (bpm > HR_HIGH_THRESHOLD) return { label: 'สูงกว่าปกติ', color: '#EF4444', bg: '#FEF2F2' };

  // BPM ต่ำกว่าเกณฑ์ แสดงเป็นสถานะต่ำกว่าปกติ
  if (bpm < HR_LOW_THRESHOLD) return { label: 'ต่ำกว่าปกติ', color: '#3B82F6', bg: '#EFF6FF' };

  return { label: 'ปกติ', color: '#065F46', bg: '#D1FAE5' };
}
