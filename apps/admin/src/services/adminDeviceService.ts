/**
 * adminDeviceService.ts
 *
 * Service สำหรับเรียก API จัดการอุปกรณ์ของ Admin Panel
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดึงรายการ devices สำหรับหน้า Admin
 * - เรียก endpoint สำหรับสร้าง ลบ และยกเลิกการผูกอุปกรณ์
 * - ซ่อนรายละเอียด path ของ backend ไม่ให้กระจายอยู่ในหน้า UI
 */

import api from "./api";

import type { CreateDevicePayload, Device } from "../types";

export const getAllDevices = async (): Promise<Device[]> => {
  // โหลดรายการอุปกรณ์พร้อมสถานะสำหรับหน้า Devices
  // Endpoint ถัดไป: GET /admin/devices
  const response = await api.get("/admin/devices");
  return response.data.data as Device[];
};

export const createDevice = async (data: CreateDevicePayload): Promise<void> => {
  // ลงทะเบียนอุปกรณ์ใหม่จาก serialNumber
  // Endpoint ถัดไป: POST /admin/devices
  await api.post("/admin/devices", data);
};

export const deleteDevice = async (id: string): Promise<void> => {
  // ลบอุปกรณ์ที่ backend อนุญาตให้ลบได้
  // Endpoint ถัดไป: DELETE /admin/devices/:id
  await api.delete(`/admin/devices/${id}`);
};

export const unpairDevice = async (id: string): Promise<void> => {
  // บังคับยกเลิกการผูกอุปกรณ์จากฝั่ง Admin
  // Endpoint ถัดไป: POST /admin/devices/:id/unpair
  await api.post(`/admin/devices/${id}/unpair`);
};
