/**
 * adminAuthService.ts
 *
 * Service สำหรับเรียก API ยืนยันตัวตนของ Admin Panel
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ส่งอีเมลและรหัสผ่านไปยัง backend admin login endpoint
 * - รับ token และข้อมูลผู้ดูแลระบบกลับมาให้หน้า Login บันทึก session ต่อ
 */

import api from "./api";

export interface AdminUser {
  id: string;
  email: string;
  role: "ADMIN";
  firstName: string;
  lastName: string;
}

export interface AdminLoginResult {
  token: string;
  user: AdminUser;
}

export const loginAdmin = async (email: string, password: string): Promise<AdminLoginResult> => {
  // Endpoint นี้ให้ backend ตรวจ role ADMIN ก่อนคืน token สำหรับ Admin Panel
  // Endpoint ถัดไป: POST /auth/admin-login
  const response = await api.post<{ success: boolean; data: AdminLoginResult }>(
    "/auth/admin-login",
    {
      email: email.trim(),
      password,
    }
  );

  return response.data.data;
};
