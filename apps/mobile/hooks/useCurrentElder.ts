/**
 * useCurrentElder.ts
 *
 * Hook สำหรับดึงข้อมูลผู้สูงอายุที่ผูกกับ caregiver ปัจจุบัน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เรียก service เพื่อโหลด elder ปัจจุบัน
 * - ใช้ query key กลางจาก queryKeys
 * - คืนค่า Elder หรือ null ตามข้อมูลที่ backend ส่งกลับมา
 * - เปิดให้หน้าที่เรียกใช้ส่ง options ของ React Query เพิ่มเติมได้
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { getCurrentElder } from '../services/elderService';

import { queryKeys } from './queryKeys';

import type { Elder } from '../services/types';

type CurrentElderOptions = Omit<
  UseQueryOptions<Elder | null, unknown, Elder | null, ReturnType<typeof queryKeys.currentElder>>,
  'queryKey' | 'queryFn'
>;

export const useCurrentElder = (options?: CurrentElderOptions) => {
  return useQuery({
    queryKey: queryKeys.currentElder(),

    // เรียก service สำหรับดึงผู้สูงอายุที่ผูกกับ caregiver ปัจจุบัน
    // ไฟล์ถัดไป: services/elderService.ts
    queryFn: getCurrentElder,

    // ต้องการข้อมูลสดทุกครั้งที่ mount เพราะ elder ปัจจุบันมีผลกับ route และ dashboard
    staleTime: 0,

    // เก็บ cache ไว้ 10 นาทีสำหรับ background tabs
    gcTime: 10 * 60 * 1000,

    refetchOnReconnect: true,
    refetchOnMount: true,
    ...options,
  });
};
