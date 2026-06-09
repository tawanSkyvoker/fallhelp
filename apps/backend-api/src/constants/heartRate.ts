/**
 * heartRate.ts
 *
 * ค่าเกณฑ์ชีพจรกลางสำหรับ backend
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด threshold ของชีพจรสูงและต่ำ
 * - แปลงค่า BPM เป็นสถานะภาษาไทย
 * - ใช้ร่วมกันระหว่าง notificationService และ eventService
 */

export const HR_HIGH_THRESHOLD = 100;
export const HR_LOW_THRESHOLD = 60;

export type HrStatus = 'สูงกว่าปกติ' | 'ปกติ' | 'ต่ำกว่าปกติ';

export function getHrStatus(bpm: number): HrStatus {
  // BPM สูงกว่าเกณฑ์ แสดงเป็นสถานะสูงกว่าปกติ
  if (bpm > HR_HIGH_THRESHOLD) return 'สูงกว่าปกติ';

  // BPM ต่ำกว่าเกณฑ์ แสดงเป็นสถานะต่ำกว่าปกติ
  if (bpm < HR_LOW_THRESHOLD) return 'ต่ำกว่าปกติ';

  return 'ปกติ';
}
