/**
 * types.ts
 *
 * ไฟล์นี้รวม type กลางที่ service หลายไฟล์ใช้ร่วมกัน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด type ของ user, elder, device, event และ notification
 * - กำหนดรูปแบบ response จาก Backend
 * - ใช้เป็นแหล่งอ้างอิง type หลักของฝั่ง mobile
 */

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type UserRole = 'ADMIN' | 'CAREGIVER';

// DeviceStatus ใช้บอกสถานะของ device ในระบบ
export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'PAIRED' | 'UNPAIRED';

// DeviceOnlineStatus ใช้บอกว่า device online หรือ offline
export type DeviceOnlineStatus = 'ONLINE' | 'OFFLINE';

// WifiStatus ใช้บอกสถานะ WiFi ของ device
export type WifiStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONFIGURING' | 'ERROR';

export type Elder = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  weight?: number | null;
  height?: number | null;
  diseases?: string | null;
  phone?: string | null;

  // ที่อยู่ของผู้สูงอายุ เก็บแบบแยกฟิลด์
  houseNumber?: string | null;
  villageNumber?: string | null;
  villageName?: string | null;
  subdistrict?: string | null;
  district?: string | null;
  province?: string | null;
  zipcode?: string | null;

  // device ที่ผูกกับผู้สูงอายุคนนี้ ถ้ามี
  device?: Device | null;
};

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender?: Gender | null;
  phone?: string | null;
  role: UserRole;

  // รูปโปรไฟล์เก็บเป็น base64 string
  profileImage?: string | null;
};

export type Device = {
  id: string;
  deviceCode: string;
  serialNumber: string;
  elderId?: string | null;
  status?: DeviceStatus;
  pairingStatus?: DeviceStatus;
  onlineStatus?: DeviceOnlineStatus;
  isOnline?: boolean;
  lastOnline?: string | null;
  wifiStatus?: WifiStatus;
};

export type Event = {
  id: string;
  elderId: string;
  deviceId: string;
  fallStage: string;
  bpm?: number | null;
  magnitude?: number | null;
  postureDelta?: number | null;

  // ถ้ามีค่า แปลว่าผู้สูงอายุกดยกเลิกเหตุการณ์จากอุปกรณ์
  cancelledAt?: string | null;

  timestamp: string;
};

export type EmergencyContact = {
  id: string;
  elderId: string;
  name: string;
  phone: string;
  relationship?: string | null;

  // ลำดับการติดต่อฉุกเฉิน 1 = โทรก่อน
  priority: number;
};

// รูปแบบ response มาตรฐานจาก Backend
export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

// รูปแบบ response แบบแบ่งหน้า
export type Paginated<T> = {
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export type MonthlySummary = {
  year: number;
  month: number;
  fallCount: number;
  heartRateAtFallHigh: number;
  heartRateAtFallNormal: number;
  heartRateAtFallLow: number;
  heartRateAtFallUnknown: number;
  cancelledCount: number;
  peakHour: number | null;
};

export type Notification = {
  id: string;
  userId: string;
  eventId: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  event?: Event | null;
};
