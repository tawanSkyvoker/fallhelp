/**
 * useDeviceSetupStore.ts
 *
 * Store สำหรับเก็บ config ของผู้สูงอายุและอุปกรณ์ที่แอปกำลังใช้งาน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เก็บ elderId และ deviceId ที่เลือกไว้
 * - ใช้ให้ socket และ sensor รู้ว่าต้องฟังข้อมูลของอุปกรณ์ไหน
 * - แยกออกจาก realtime store เพราะค่านี้เปลี่ยนไม่บ่อย
 * - เคลียร์ config ตอน logout หรือเปลี่ยน session
 */

import { create } from 'zustand';

interface DeviceSetupState {
  elderId: string | undefined;
  deviceId: string | undefined;

  setElderConfig: (elderId: string | undefined, deviceId: string | undefined) => void;
  clearConfig: () => void;
}

export const useDeviceSetupStore = create<DeviceSetupState>((set) => ({
  elderId: undefined,
  deviceId: undefined,

  // ตั้งค่า elder/device ปัจจุบันให้ realtime flow ใช้งานต่อ
  // จุดที่ถูกเรียกใช้หลัก: setup flow และ socket connection
  setElderConfig: (elderId, deviceId) => {
    set({ elderId, deviceId });
  },

  // เคลียร์ config เมื่อออกจากระบบหรือเริ่ม session ใหม่
  clearConfig: () => {
    set({ elderId: undefined, deviceId: undefined });
  },
}));
