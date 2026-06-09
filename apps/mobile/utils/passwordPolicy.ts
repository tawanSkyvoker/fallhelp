/**
 * passwordPolicy.ts
 *
 * Helper สำหรับตรวจสอบกฎรหัสผ่านใน flow สมัครสมาชิกและ reset password
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนดข้อความ error กลางของกฎรหัสผ่าน
 * - ตรวจว่ารหัสผ่านผ่านเงื่อนไขขั้นต่ำหรือไม่
 * - คืนผลลัพธ์แบบ valid/message ให้ฟอร์มนำไปแสดงต่อ
 */

const PASSWORD_POLICY_ERROR_MESSAGE =
  'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และต้องมีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข';

const isPasswordPolicyValid = (password: string): boolean => {
  // กฎกลาง: อย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข
  return (
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
  );
};

export const validatePasswordPolicy = (password: string): { valid: boolean; message?: string } => {
  if (!isPasswordPolicyValid(password)) {
    return { valid: false, message: PASSWORD_POLICY_ERROR_MESSAGE };
  }

  return { valid: true };
};
