/**
 * useSensorStore.ts
 *
 * Store สำหรับสถานะการเชื่อมต่อและข้อมูล sensor แบบ realtime
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เก็บสถานะ socket และสถานะ online/offline ของอุปกรณ์
 * - เก็บค่า heart rate, confidence, signal strength และ SSID ล่าสุด
 * - แยก telemetry ออกจาก fall alert เพื่อลด re-render ของ component ที่ไม่เกี่ยวกัน
 * - reset state ทั้งหมดตอน logout หรือ disconnect session
 */

import { create } from 'zustand';

export type RealtimeHeartConfidence = 'none' | 'low' | 'medium' | 'high' | null;

interface SensorState {
  // สถานะว่าอุปกรณ์กำลัง online ตาม realtime signal หรือไม่
  isConnected: boolean;

  // สถานะว่า socket ผ่านการเชื่อมต่อและ auth แล้วหรือยัง
  socketConnected: boolean;

  // ใช้แยกว่าเคยต่อสำเร็จแล้วหรือยัง เพื่อช่วยแสดง reconnect/debug flow
  wasEverConnected: boolean;

  // ค่า heart rate ล่าสุดจาก sensor
  heartRate: number | null;

  // ความน่าเชื่อถือของค่า heart rate ล่าสุด
  heartConfidence: RealtimeHeartConfidence;

  // เวลาที่ได้รับ heart rate ล่าสุด ใช้ตัดสินว่าข้อมูลยังสดหรือเก่าแล้ว
  lastHeartUpdate: Date | null;

  // เวลาที่ได้รับ status update ล่าสุดจากอุปกรณ์
  lastStatusUpdate: Date | null;

  // ความแรงสัญญาณ WiFi ล่าสุดของอุปกรณ์
  signalStrength: number | null;

  // SSID ที่อุปกรณ์กำลังเชื่อมต่ออยู่
  currentSSID: string | null;

  setIsConnected: (connected: boolean) => void;
  setSocketConnected: (connected: boolean) => void;
  setWasEverConnected: (connected: boolean) => void;
  setHeartRate: (rate: number | null) => void;
  setHeartConfidence: (confidence: RealtimeHeartConfidence) => void;
  setLastHeartUpdate: (date: Date | null) => void;
  setLastStatusUpdate: (date: Date | null) => void;
  setSignalStrength: (strength: number | null) => void;
  setCurrentSSID: (ssid: string | null) => void;
  resetSensorState: () => void;
}

export const useSensorStore = create<SensorState>((set) => ({
  isConnected: false,
  socketConnected: false,
  wasEverConnected: false,
  heartRate: null,
  heartConfidence: null,
  lastHeartUpdate: null,
  lastStatusUpdate: null,
  signalStrength: null,
  currentSSID: null,

  // อัปเดตสถานะ online/offline ของอุปกรณ์จาก socket หรือ watchdog
  setIsConnected: (isConnected) => set({ isConnected }),

  // อัปเดตสถานะ socket หลัง connect/authenticate
  setSocketConnected: (socketConnected) => set({ socketConnected }),

  // จำว่า session นี้เคยเชื่อมต่อสำเร็จแล้วหรือยัง
  setWasEverConnected: (wasEverConnected) => set({ wasEverConnected }),

  // อัปเดตค่า heart rate ล่าสุด
  setHeartRate: (heartRate) => set({ heartRate }),

  // อัปเดตความน่าเชื่อถือของ heart rate
  setHeartConfidence: (heartConfidence) => set({ heartConfidence }),

  // เก็บเวลาที่ได้รับ heart rate ล่าสุด
  setLastHeartUpdate: (lastHeartUpdate) => set({ lastHeartUpdate }),

  // เก็บเวลาที่ได้รับ status update ล่าสุด
  setLastStatusUpdate: (lastStatusUpdate) => set({ lastStatusUpdate }),

  // อัปเดตความแรงสัญญาณ WiFi ของอุปกรณ์
  setSignalStrength: (signalStrength) => set({ signalStrength }),

  // อัปเดตชื่อ WiFi ที่อุปกรณ์เชื่อมต่ออยู่
  setCurrentSSID: (currentSSID) => set({ currentSSID }),

  // เคลียร์ realtime sensor state ทั้งหมดเมื่อออกจาก session
  resetSensorState: () =>
    set({
      isConnected: false,
      socketConnected: false,
      wasEverConnected: false,
      heartRate: null,
      heartConfidence: null,
      lastHeartUpdate: null,
      lastStatusUpdate: null,
      signalStrength: null,
      currentSSID: null,
    }),
}));
