/**
 * searchParams.ts
 *
 * Helper กลางสำหรับอ่าน Expo Router search params ให้ปลอดภัยขึ้น
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - normalize query param ที่อาจเป็น string, string[] หรือ undefined
 * - อ่านค่า string โดยตัดค่าว่างออก
 * - อ่านค่า number โดยกัน NaN และค่าที่แปลงไม่ได้
 * - รวม helper ไว้ใน useAppSearchParams เพื่อให้หน้าจอเรียกใช้สั้นลง
 */

import { useLocalSearchParams } from 'expo-router';

import type { UnknownOutputParams } from 'expo-router';

type SearchParamValue = string | string[] | undefined;
type SearchParamRecord = Record<string, SearchParamValue>;

const toFirstString = (value: SearchParamValue): string | undefined => {
  // Expo Router อาจส่ง param เป็น array ได้ จึงใช้ค่าแรกเป็นค่าหลักของหน้าจอ
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
};

export const getSearchParamString = (
  params: SearchParamRecord,
  key: string,
): string | undefined => {
  const value = toFirstString(params[key]);

  // คืนเฉพาะ string ที่มีค่า เพื่อไม่ให้ค่าว่างถูกใช้เป็น param จริง
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export const getSearchParamStringOrEmpty = (params: SearchParamRecord, key: string): string =>
  getSearchParamString(params, key) ?? '';

export const getSearchParamNumber = (
  params: SearchParamRecord,
  key: string,
): number | undefined => {
  const rawValue = getSearchParamString(params, key);

  if (!rawValue) {
    return undefined;
  }

  const parsed = Number(rawValue);

  // กัน NaN และ Infinity ก่อนส่งให้หน้าจอใช้ต่อ
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const getSearchParamNumberWithFallback = (
  params: SearchParamRecord,
  key: string,
  fallback: number,
): number => getSearchParamNumber(params, key) ?? fallback;

export const useAppSearchParams = <TParams extends UnknownOutputParams = UnknownOutputParams>() => {
  const params = useLocalSearchParams<TParams>();

  // cast เป็นรูปแบบกลาง เพื่อให้ helper ทุกตัวอ่าน key แบบเดียวกัน
  const normalizedParams = params as SearchParamRecord;

  return {
    raw: params,
    getString: (key: string): string | undefined => getSearchParamString(normalizedParams, key),
    getStringOrEmpty: (key: string): string => getSearchParamStringOrEmpty(normalizedParams, key),
    getNumber: (key: string): number | undefined => getSearchParamNumber(normalizedParams, key),
    getNumberWithFallback: (key: string, fallback: number): number =>
      getSearchParamNumberWithFallback(normalizedParams, key, fallback),
  };
};
