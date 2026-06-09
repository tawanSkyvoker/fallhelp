/**
 * eventService.ts
 *
 * ไฟล์นี้ใช้ดึงข้อมูลเหตุการณ์และสรุปรายงาน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดึงรายการเหตุการณ์ เช่น การหกล้ม
 * - กรองเหตุการณ์ตาม elder, device หรือช่วงวันที่
 * - ดึงสรุปรายเดือนสำหรับหน้า Report
 *
 * หน้าจอจะเรียกฟังก์ชันในไฟล์นี้
 * จากนั้นไฟล์นี้จะเรียก apiClient ใน api.ts เพื่อส่ง request ต่อ
 */

import { apiClient, toApiError } from './api';

import type { Event, MonthlySummary, Paginated } from './types';

export type EventFilters = {
  elderId?: string;
  deviceId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
};

// ดึงรายการเหตุการณ์
// ใช้ filters เพื่อกำหนดว่าจะดูเหตุการณ์ของใคร ช่วงไหน หรือหน้าไหน
export async function listEvents(filters: EventFilters = {}): Promise<Paginated<Event>> {
  try {
    // ขอรายการเหตุการณ์จาก apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.get<Paginated<Event>>('/api/events', { params: filters });

    return data;
  } catch (error) {
    // แปลง error ก่อน เพื่อเช็ค status ได้ง่าย
    const apiErr = toApiError(error);

    // ถ้าได้ 403 แปลว่าผู้ใช้อาจยังไม่มี elder หรือ device
    // กรณีนี้ให้คืน list ว่างแทนการทำให้หน้าจอ error
    if (apiErr.status === 403) {
      return { data: [], page: 1, pageSize: filters.limit ?? 0, total: 0 } as Paginated<Event>;
    }

    throw apiErr;
  }
}

// ดึงสรุปรายเดือนของผู้สูงอายุ
// ใช้สำหรับหน้า Report Summary
export async function getMonthlySummary(
  elderId: string,
  year: number,
  month: number,
): Promise<MonthlySummary> {
  try {
    // ขอข้อมูลสรุปรายเดือนจาก apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.get<{ success: boolean; data: MonthlySummary }>(
      '/api/events/summary/monthly',
      { params: { elderId, year, month } },
    );

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}
