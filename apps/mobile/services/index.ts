/**
 * services/index.ts
 *
 * ไฟล์นี้เป็นจุดรวม export ของ service ทั้งหมด
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวม service หลายไฟล์ให้ import จากที่เดียวได้
 * - รวม type ที่ใช้ร่วมกันในฝั่ง mobile
 * - ช่วยให้ไฟล์อื่น import สั้นลงและเป็นระเบียบขึ้น
 */

export { apiClient, toApiError } from './api';
export type { ApiError } from './api';

export { getToken, setToken, clearToken } from './tokenStorage';

export type {
  Gender,
  UserRole,
  DeviceStatus,
  WifiStatus,
  UserProfile,
  Elder,
  Device,
  Event,
  EmergencyContact,
  Notification,
  ApiResponse,
  Paginated,
  MonthlySummary,
} from './types';

export {
  login,
  register,
  requestOtp,
  verifyOtp,
  resetPassword,
  fetchProfile,
  logout,
} from './authService';
export type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from './authService';

export { getProfile, updateProfile, changePassword, updatePushToken } from './userService';
export type {
  UpdateProfilePayload,
  ChangePasswordPayload,
  UpdatePushTokenPayload,
} from './userService';

export { createElder, getCurrentElder, getElder, updateElder } from './elderService';
export type { CreateElderPayload, UpdateElderPayload } from './elderService';

export {
  getDeviceByCode,
  pairDevice,
  unpairDevice,
  getDeviceConfig,
  configureWifi,
} from './deviceService';
export type { PairDevicePayload, UnpairDevicePayload, WifiConfigPayload } from './deviceService';

export { listEvents, getMonthlySummary } from './eventService';
export type { EventFilters } from './eventService';

export {
  listContacts,
  createContact,
  updateContact,
  reorderContacts,
  deleteContact,
} from './emergencyContactService';
export type { CreateContactPayload } from './emergencyContactService';

export {
  registerPushToken,
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './notificationService';
export type { NotificationFilters } from './notificationService';
