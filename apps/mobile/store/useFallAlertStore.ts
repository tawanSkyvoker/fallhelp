/**
 * useFallAlertStore.ts
 *
 * Store สำหรับ Local UI State ของสถานะหกล้มบนหน้า Dashboard
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เก็บสถานะหกล้มล่าสุดจาก realtime flow
 * - เก็บเวลาที่ได้รับ fall event ล่าสุด
 * - เก็บ event id และ BPM ของเหตุล้มที่กำลัง active
 * - reset state ทั้งหมดตอน logout หรือเปลี่ยน elder
 */

import { create } from 'zustand';

// หน้า Home ใช้เฉพาะสถานะที่ผู้ใช้ควรเห็นจริง: ปกติ หรือ ยืนยันแล้วว่าล้ม
export type RealtimeFallStatus = 'NORMAL' | 'FALL' | null;

interface FallAlertState {
  // สถานะ UI ล่าสุดที่ได้รับจาก Socket หรือ API
  fallStatus: RealtimeFallStatus;

  // เวลาที่ได้รับ fall event ล่าสุด ใช้ช่วยตัดสินความสดของข้อมูล
  lastFallUpdate: Date | null;

  // event ที่กำลัง active ใช้สำหรับรับทราบเหตุล้มหรือ track ต่อในหน้า detail
  activeFallEventId: string | null;

  // BPM จาก socket payload ใช้แสดงทันทีโดยไม่ต้องรอ initialEvents cache
  // undefined = ยังไม่ได้รับ socket fall_detected
  // null     = socket ส่งมาแล้วแต่ไม่มีข้อมูล bpm
  // number   = มีข้อมูล bpm (รวม 0 = ไม่พบสัญญาณ)
  activeFallBpm: number | null | undefined;
}

interface FallAlertActions {
  setFallStatus: (status: RealtimeFallStatus) => void;
  setLastFallUpdate: (date: Date | null) => void;
  setActiveFallEventId: (id: string | null) => void;
  setActiveFallBpm: (bpm: number | null | undefined) => void;
  resetFallAlertState: () => void;
}

const initialState: FallAlertState = {
  fallStatus: null,
  lastFallUpdate: null,
  activeFallEventId: null,
  activeFallBpm: undefined,
};

export const useFallAlertStore = create<FallAlertState & FallAlertActions>()((set) => ({
  ...initialState,

  // อัปเดตสถานะหกล้มที่หน้า Dashboard ใช้แสดงผล
  setFallStatus: (status) => set({ fallStatus: status }),

  // เก็บเวลาที่ได้ fall signal ล่าสุด
  setLastFallUpdate: (date) => set({ lastFallUpdate: date }),

  // ผูก UI กับ fall event ที่กำลัง active
  setActiveFallEventId: (id) => set({ activeFallEventId: id }),

  // เก็บ BPM ของเหตุการณ์ล้มล่าสุดเพื่อแสดงใน alert ได้ทันที
  setActiveFallBpm: (bpm) => set({ activeFallBpm: bpm }),

  // เคลียร์ state ทั้งหมดกลับสู่ค่าเริ่มต้น
  resetFallAlertState: () => set(initialState),
}));
