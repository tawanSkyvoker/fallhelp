/**
 * topics.ts
 *
 * MQTT topic constants และ payload type definitions สำหรับ FallHelp IoT
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวม topic wildcard ที่ backend subscribe
 * - รวม helper สำหรับสร้าง topic config ของอุปกรณ์แต่ละตัว
 * - กำหนด payload shape กลางหลังผ่าน normalization/validation
 * - แยก type ของ fall, heart rate, device status และ config ACK
 */

export const MQTT_TOPICS = {
  HEART_RATE_WILDCARD: 'device/+/heartrate',
  DEVICE_STATUS_WILDCARD: 'device/+/status',
  DEVICE_EVENTS_WILDCARD: 'device/+/event',
  CONFIG_ACK_WILDCARD: 'device/+/config/ack',
  EVENTS_WILDCARD: 'events/+',
  DEVICE_LWT_WILDCARD: 'device/+/lwt',

  // backend publish คำสั่ง config/RESET_WIFI ไปยังอุปกรณ์ผ่าน topic นี้
  getConfigTopic: (deviceId: string) => `device/${deviceId}/config`,

  // ESP32 ตอบ ACK กลับผ่าน topic นี้หลังรับคำสั่ง config
  getConfigAckTopic: (deviceId: string) => `device/${deviceId}/config/ack`,
} as const;

export interface FallDetectionPayload {
  // ESP32 อาจส่ง millis() แต่ backend ใช้ server time ใน handler เป็นหลัก
  timestamp: number | string;

  // evidence หลักของการล้ม
  magnitude: number;
  postureDelta: number;

  // BPM ณ ขณะล้ม: 0 หรือ null = sensor ไม่มีสัญญาณ
  bpm?: number | null;
}

export interface HeartRatePayload {
  // ใช้สำหรับ realtime UI update ไม่ได้สร้าง Event แยกใน DB
  timestamp: number | string;
  heartRate: number;
  zone?: 'low' | 'normal' | 'high';
  confidence?: 'none' | 'low' | 'medium' | 'high';
  isAbnormal?: boolean;
  alertType?: 'LOW' | 'HIGH';
}

export interface DeviceStatusPayload {
  // ใช้กับ heartbeat, LWT และ WiFi connectivity flow
  timestamp: number | string;
  online: boolean;
  signalStrength?: number;
  ip?: string;
  wifiSSID?: string;
}

export interface DeviceConfigAckPayload {
  // ACK แปลว่าอุปกรณ์รับคำสั่งแล้ว ไม่ได้แปลว่าเชื่อม WiFi สำเร็จจริง
  requestId: string;
  success: boolean;
  timestamp: number | string;
  reason?: string;
  ip?: string;
}
