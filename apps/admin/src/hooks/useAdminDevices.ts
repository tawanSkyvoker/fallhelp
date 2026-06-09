/**
 * useAdminDevices.ts
 *
 * Hooks สำหรับจัดการอุปกรณ์ใน Admin Panel
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดึงรายการอุปกรณ์ทั้งหมด
 * - สร้างอุปกรณ์ใหม่
 * - ลบอุปกรณ์ที่ยังไม่ถูกผูก
 * - force unpair อุปกรณ์และ invalidate devices query หลัง mutation สำเร็จ
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createDevice,
  deleteDevice,
  getAllDevices,
  unpairDevice,
} from "../services/adminDeviceService";

import { REFETCH_INTERVAL } from "../constants/config";

export const useAdminDevices = () => {
  return useQuery({
    queryKey: ["devices"],

    // โหลดรายการอุปกรณ์พร้อมสถานะจาก backend
    // ไฟล์ถัดไป: services/adminDeviceService.ts
    queryFn: getAllDevices,

    // devices เปลี่ยนสถานะ online/offline บ่อย จึงต้องการการดึงข้อมูลแบบรวดเร็ว (refetchInterval: fast)
    refetchInterval: REFETCH_INTERVAL.fast,
  });
};

export const useCreateDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // สร้างอุปกรณ์ใหม่จาก serial number
    // ไฟล์ถัดไป: services/adminDeviceService.ts
    mutationFn: createDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
};

export const useDeleteDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // ลบอุปกรณ์ที่ยังไม่ถูกผูกกับผู้สูงอายุ
    // ไฟล์ถัดไป: services/adminDeviceService.ts
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
};

export const useUnpairDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // บังคับยกเลิกการผูกอุปกรณ์จากฝั่ง Admin
    // ไฟล์ถัดไป: services/adminDeviceService.ts
    mutationFn: unpairDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
};
