/**
 * setupStorage.ts
 *
 * จัดการข้อมูล setup ที่ผูกกับผู้ใช้ปัจจุบัน และ cache สำหรับ cold start
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - อ่าน/เขียน setup state ลง SecureStore และ AsyncStorage
 * - แยก storage key ตามผู้ใช้ เพื่อกันข้อมูล setup ปนกันหลัง logout/login
 * - ทำ boot cache สำหรับให้ route guard ตัดสิน route ได้เร็วขึ้นตอนเปิดแอป
 * - รองรับ migration จาก key เก่าที่ไม่มี scope หรือใช้ delimiter เก่า
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';

const TOKEN_KEY = 'fallhelp_auth_token';

const SECURE_KEYS = {
  step: 'setup_step',
  elderId: 'setup_elderId',
  deviceId: 'setup_deviceId',
  serialNumber: 'setup_serialNumber',
  lastRoute: 'setup_lastRoute',
} as const;

const ASYNC_KEYS = {
  step1FormData: 'setup_step1_form_data',
} as const;

type SecureKeyName = keyof typeof SECURE_KEYS;
type AsyncKeyName = keyof typeof ASYNC_KEYS;

const FALLBACK_SCOPE = 'anonymous';

// cache scope ของผู้ใช้ปัจจุบัน เพื่อลดการอ่าน token จาก storage ซ้ำใน session เดียว
let _cachedScope: string | null = null;
let _cachedScopeToken: string | null = null;

export function clearScopeCache(): void {
  _cachedScope = null;
  _cachedScopeToken = null;
}

export interface BootData {
  hasToken: boolean;
  setupStep: string | null;
  elderId: string | null;
  deviceId: string | null;
  serialNumber: string | null;
  lastRoute: string | null;
}

const EMPTY_BOOT_DATA: BootData = {
  hasToken: false,
  setupStep: null,
  elderId: null,
  deviceId: null,
  serialNumber: null,
  lastRoute: null,
};

// boot cache ใช้ให้ root layout / route guard อ่านข้อมูลตั้งต้นได้เร็วตอน cold start
let _bootPromise: Promise<BootData> | null = null;
let _bootData: BootData | null = null;
let _bootGeneration = 0;

export function readBootData(): Promise<BootData> {
  if (_bootData) return Promise.resolve(_bootData);

  if (!_bootPromise) {
    const gen = _bootGeneration;

    _bootPromise = _readBootDataImpl()
      .then((data) => {
        // กัน promise เก่าทับ cache หลังมี clearBootCache ระหว่างทาง
        if (_bootGeneration === gen) _bootData = data;
        return data;
      })
      .catch(() => {
        const empty = EMPTY_BOOT_DATA;

        if (_bootGeneration === gen) _bootData = empty;
        return empty;
      });
  }

  return _bootPromise;
}

export function getBootDataSync(): BootData | null {
  // ใช้ fast path ได้เฉพาะเมื่อ readBootData เคย resolve แล้ว
  return _bootData;
}

export function clearBootCache(): void {
  // เพิ่ม generation เพื่อ invalidate promise/cache เก่าที่ยัง resolve ไม่เสร็จ
  _bootGeneration++;
  _bootPromise = null;
  _bootData = null;
}

async function _readBootDataImpl(): Promise<BootData> {
  // อ่าน token ก่อน เพราะ setup data ทั้งหมดต้องผูกกับ user scope
  const token = await getStoredToken();

  if (!token) return EMPTY_BOOT_DATA;

  // decode user id จาก token เพื่อทำ scoped storage key
  const userId = decodeUserIdFromToken(token);
  const scope = userId ?? fallbackScopeFromToken(token);
  const fingerprint = token.slice(-32);

  _cachedScope = scope;
  _cachedScopeToken = fingerprint;

  const encodedScope = encodeScopeForStorageKey(scope);
  const suffix = `.u_${encodedScope}`;

  // อ่าน setup keys หลักพร้อมกัน เพื่อลดเวลาตอน cold start
  const [step, elderId, deviceId, serialNumber, lastRoute] = await Promise.all([
    SecureStore.getItemAsync(SECURE_KEYS.step + suffix),
    SecureStore.getItemAsync(SECURE_KEYS.elderId + suffix),
    SecureStore.getItemAsync(SECURE_KEYS.deviceId + suffix),
    SecureStore.getItemAsync(SECURE_KEYS.serialNumber + suffix),
    SecureStore.getItemAsync(SECURE_KEYS.lastRoute + suffix),
  ]);

  return {
    hasToken: true,
    setupStep: sanitizeStoredValue(step),
    elderId: sanitizeStoredValue(elderId),
    deviceId: sanitizeStoredValue(deviceId),
    serialNumber: sanitizeStoredValue(serialNumber),
    lastRoute: sanitizeStoredValue(lastRoute),
  };
}

function sanitizeStoredValue(value: string | null): string | null {
  // กันค่าที่เคยถูก stringify เป็นข้อความแล้วหลุดมาเป็นค่าจริงใน storage
  if (value === null || value === 'undefined' || value === 'null') return null;

  return value;
}

async function getStoredToken(): Promise<string | null> {
  // web ใช้ localStorage ส่วน native ใช้ SecureStore
  if (Platform.OS === 'web') return localStorage.getItem(TOKEN_KEY);

  return SecureStore.getItemAsync(TOKEN_KEY);
}

function decodeUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const payloadPart = parts[1];
    if (!payloadPart) return null;

    const payloadBase64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadBase64 + '='.repeat((4 - (payloadBase64.length % 4)) % 4);
    const decoded =
      typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf-8');

    const payload = JSON.parse(decoded) as Record<string, unknown>;

    // รองรับหลายชื่อ field เผื่อ backend/token version ต่างกัน
    const rawUserId = payload['userId'] ?? payload['id'] ?? payload['sub'];

    if (typeof rawUserId === 'string' || typeof rawUserId === 'number') return String(rawUserId);
  } catch {
    return null;
  }

  return null;
}

function fallbackScopeFromToken(token: string): string {
  // ถ้า decode user id ไม่ได้ ใช้ท้าย token เป็น scope ชั่วคราวเพื่อยังแยกผู้ใช้ได้ระดับหนึ่ง
  const compact = token.slice(-16).replace(/[^a-zA-Z0-9]/g, '');

  return compact || FALLBACK_SCOPE;
}

function encodeScopeForStorageKey(scope: string): string {
  try {
    // encode scope ให้ปลอดภัยสำหรับใช้เป็นส่วนหนึ่งของ storage key
    const encoded = Buffer.from(scope, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    if (encoded) return encoded;
  } catch {
    // ถ้า encode ไม่ได้ จะ fallback ไป sanitize ด้านล่าง
  }

  const sanitized = scope.replace(/[^a-zA-Z0-9._-]/g, '_');

  return sanitized || FALLBACK_SCOPE;
}

async function getCurrentSetupScope(): Promise<string> {
  const token = await getStoredToken();

  if (!token) {
    _cachedScope = null;
    _cachedScopeToken = null;
    return FALLBACK_SCOPE;
  }

  const fingerprint = token.slice(-32);

  // ใช้ cache เดิมถ้า token fingerprint ยังตรงกัน
  if (_cachedScope && _cachedScopeToken === fingerprint) return _cachedScope;

  const userId = decodeUserIdFromToken(token);
  const scope = userId ?? fallbackScopeFromToken(token);

  _cachedScope = scope;
  _cachedScopeToken = fingerprint;

  return scope;
}

async function getScopedSecureKey(keyName: SecureKeyName): Promise<string> {
  const scope = await getCurrentSetupScope();

  return `${SECURE_KEYS[keyName]}.u_${encodeScopeForStorageKey(scope)}`;
}

async function getScopedAsyncKey(keyName: AsyncKeyName): Promise<string> {
  const scope = await getCurrentSetupScope();

  return `${ASYNC_KEYS[keyName]}.u_${encodeScopeForStorageKey(scope)}`;
}

async function getLegacyScopedAsyncKey(keyName: AsyncKeyName): Promise<string> {
  const scope = await getCurrentSetupScope();

  // key format เก่าใช้ ":" delimiter เก็บไว้เพื่อ migrate ข้อมูลเดิม
  return `${ASYNC_KEYS[keyName]}:${scope}`;
}

async function getSecureValue(keyName: SecureKeyName): Promise<string | null> {
  const scopedKey = await getScopedSecureKey(keyName);
  const scopedValue = sanitizeStoredValue(await SecureStore.getItemAsync(scopedKey));

  if (scopedValue !== null) return scopedValue;

  // migration: key เก่าที่ไม่มี user scope ให้ย้ายเข้า scoped key แล้วลบ key เดิม
  const legacyKey = SECURE_KEYS[keyName];
  const legacyValue = sanitizeStoredValue(await SecureStore.getItemAsync(legacyKey));

  if (legacyValue !== null) {
    await SecureStore.setItemAsync(scopedKey, legacyValue);
    await SecureStore.deleteItemAsync(legacyKey);
    return legacyValue;
  }

  return null;
}

async function setSecureValue(keyName: SecureKeyName, value: string): Promise<void> {
  const scopedKey = await getScopedSecureKey(keyName);

  await SecureStore.setItemAsync(scopedKey, value);

  // ลบ legacy key เพื่อป้องกันข้อมูลของ user เก่าถูกอ่านข้าม session
  await SecureStore.deleteItemAsync(SECURE_KEYS[keyName]);
}

async function deleteSecureValue(keyName: SecureKeyName): Promise<void> {
  const scopedKey = await getScopedSecureKey(keyName);

  // ลบทั้ง scoped key และ legacy key เพื่อ cleanup ให้ครบ
  await Promise.all([
    SecureStore.deleteItemAsync(scopedKey),
    SecureStore.deleteItemAsync(SECURE_KEYS[keyName]),
  ]);
}

async function getAsyncValue(keyName: AsyncKeyName): Promise<string | null> {
  const scopedKey = await getScopedAsyncKey(keyName);
  const scopedValue = sanitizeStoredValue(await AsyncStorage.getItem(scopedKey));

  if (scopedValue !== null) return scopedValue;

  // migration: key scoped format เก่าที่ใช้ ":" delimiter
  const legacyScopedKey = await getLegacyScopedAsyncKey(keyName);
  const legacyScopedValue = sanitizeStoredValue(await AsyncStorage.getItem(legacyScopedKey));

  if (legacyScopedValue !== null) {
    await AsyncStorage.setItem(scopedKey, legacyScopedValue);
    await AsyncStorage.removeItem(legacyScopedKey);
    return legacyScopedValue;
  }

  // migration: key เก่าที่ไม่มี user scope
  const legacyKey = ASYNC_KEYS[keyName];
  const legacyValue = sanitizeStoredValue(await AsyncStorage.getItem(legacyKey));

  if (legacyValue !== null) {
    await AsyncStorage.setItem(scopedKey, legacyValue);
    await AsyncStorage.removeItem(legacyKey);
    return legacyValue;
  }

  return null;
}

async function setAsyncValue(keyName: AsyncKeyName, value: string): Promise<void> {
  const scopedKey = await getScopedAsyncKey(keyName);
  const legacyScopedKey = await getLegacyScopedAsyncKey(keyName);

  await AsyncStorage.setItem(scopedKey, value);

  // ลบ key format เก่าเพื่อไม่ให้ข้อมูลเก่าถูกอ่านซ้ำใน session ถัดไป
  await AsyncStorage.removeItem(legacyScopedKey);
  await AsyncStorage.removeItem(ASYNC_KEYS[keyName]);
}

async function deleteAsyncValue(keyName: AsyncKeyName): Promise<void> {
  const scopedKey = await getScopedAsyncKey(keyName);
  const legacyScopedKey = await getLegacyScopedAsyncKey(keyName);

  await Promise.all([
    AsyncStorage.removeItem(scopedKey),
    AsyncStorage.removeItem(legacyScopedKey),
    AsyncStorage.removeItem(ASYNC_KEYS[keyName]),
  ]);
}

export async function setSetupStep(step: string): Promise<void> {
  await setSecureValue('step', step);
}

export async function clearSetupStep(): Promise<void> {
  await deleteSecureValue('step');
}

export async function getSetupElderId(): Promise<string | null> {
  return getSecureValue('elderId');
}

export async function setSetupElderId(elderId: string): Promise<void> {
  await setSecureValue('elderId', elderId);
}

export async function clearSetupElderId(): Promise<void> {
  await deleteSecureValue('elderId');
}

export async function getSetupDeviceId(): Promise<string | null> {
  return getSecureValue('deviceId');
}

export async function setSetupDeviceId(id: string): Promise<void> {
  await setSecureValue('deviceId', id);
}

export async function clearSetupDeviceId(): Promise<void> {
  await deleteSecureValue('deviceId');
}

export async function getSetupSerialNumber(): Promise<string | null> {
  return getSecureValue('serialNumber');
}

export async function setSetupSerialNumber(sn: string): Promise<void> {
  await setSecureValue('serialNumber', sn);
}

export async function clearSetupSerialNumber(): Promise<void> {
  await deleteSecureValue('serialNumber');
}

export async function getSetupStep1FormData(): Promise<string | null> {
  return getAsyncValue('step1FormData');
}

export async function setSetupStep1FormData(data: string): Promise<void> {
  await setAsyncValue('step1FormData', data);
}

export async function clearSetupStep1FormData(): Promise<void> {
  await deleteAsyncValue('step1FormData');
}

export async function setLastResolvedRoute(route: string): Promise<void> {
  // lastRoute ใช้เป็น fast path/fallback ให้ route guard ตอนเปิดแอปรอบถัดไป
  await setSecureValue('lastRoute', route);
}

export async function clearLastResolvedRoute(): Promise<void> {
  await deleteSecureValue('lastRoute');
}

export async function clearSetupTransientForCurrentUser(): Promise<void> {
  // ลบข้อมูล setup ชั่วคราว แต่เก็บ step และ lastRoute ไว้ให้ route guard ใช้ต่อ
  await Promise.all([
    clearSetupElderId(),
    clearSetupDeviceId(),
    clearSetupSerialNumber(),
    clearSetupStep1FormData(),
  ]);
}

export async function clearAllSetupForCurrentUser(): Promise<void> {
  // ใช้ตอน logout หรือเริ่ม session ใหม่ เพื่อล้าง setup state ทั้งหมดของ user ปัจจุบัน
  await Promise.all([
    clearSetupStep(),
    clearLastResolvedRoute(),
    clearSetupTransientForCurrentUser(),
  ]);
}
