/**
 * tokenStorage.ts
 *
 * ไฟล์นี้ใช้จัดการ JWT token ของผู้ใช้
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - บันทึก token
 * - อ่าน token
 * - ลบ token
 *
 * Native จะใช้ SecureStore
 * Web จะใช้ sessionStorage เป็น fallback
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'fallhelp_auth_token';

// บันทึก token ลง storage ของเครื่อง
export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') sessionStorage.setItem(TOKEN_KEY, token);
  else await SecureStore.setItemAsync(TOKEN_KEY, token);
}

// อ่าน token จาก storage ของเครื่อง
// ถูกใช้ใน api.ts ก่อนส่ง request เพื่อแนบ Authorization header
export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return sessionStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

// ลบ token ออกจาก storage ของเครื่อง
// ใช้ตอน logout หรือ token ใช้ไม่ได้แล้ว
export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') sessionStorage.removeItem(TOKEN_KEY);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}
