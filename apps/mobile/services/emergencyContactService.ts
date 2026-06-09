/**
 * emergencyContactService.ts
 *
 * ไฟล์นี้ใช้จัดการรายชื่อผู้ติดต่อฉุกเฉินของผู้สูงอายุ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดึงรายชื่อผู้ติดต่อฉุกเฉิน
 * - เพิ่มผู้ติดต่อฉุกเฉิน
 * - แก้ไขผู้ติดต่อฉุกเฉิน
 * - เรียงลำดับผู้ติดต่อฉุกเฉิน
 * - ลบผู้ติดต่อฉุกเฉิน
 *
 * หน้าจอจะเรียกฟังก์ชันในไฟล์นี้
 * จากนั้นไฟล์นี้จะเรียก apiClient ใน api.ts เพื่อส่ง request ต่อ
 */

import { apiClient, toApiError } from './api';

import type { ApiResponse, EmergencyContact } from './types';

export type CreateContactPayload = {
  name: string;
  phone: string;
  relationship?: string;
  priority?: number;
};

// ดึงรายชื่อผู้ติดต่อฉุกเฉินของผู้สูงอายุ
// ใช้ elderId เพื่อบอกว่าต้องการรายชื่อของผู้สูงอายุคนไหน
export async function listContacts(elderId: string): Promise<EmergencyContact[]> {
  try {
    // ขอรายชื่อผู้ติดต่อฉุกเฉินจาก apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.get<ApiResponse<EmergencyContact[]>>(
      `/api/elders/${elderId}/emergency-contacts`,
    );

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// เพิ่มผู้ติดต่อฉุกเฉินใหม่
// ใช้ตอนผู้ใช้กรอกข้อมูลผู้ติดต่อแล้วกดบันทึก
export async function createContact(
  elderId: string,
  payload: CreateContactPayload,
): Promise<EmergencyContact> {
  try {
    // ส่งข้อมูลผู้ติดต่อใหม่ไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.post<ApiResponse<EmergencyContact>>(
      `/api/elders/${elderId}/emergency-contacts`,
      payload,
    );

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// แก้ไขข้อมูลผู้ติดต่อฉุกเฉิน
// ใช้เมื่อต้องการแก้ชื่อ เบอร์โทร ความสัมพันธ์ หรือ priority
export async function updateContact(
  elderId: string,
  contactId: string,
  payload: Partial<CreateContactPayload>,
): Promise<EmergencyContact> {
  try {
    // ส่งข้อมูลที่ต้องการแก้ไขไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    const { data } = await apiClient.patch<ApiResponse<EmergencyContact>>(
      `/api/elders/${elderId}/emergency-contacts/${contactId}`,
      payload,
    );

    return data.data;
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// เรียงลำดับผู้ติดต่อฉุกเฉินใหม่
// contactIds คือรายชื่อ id ที่เรียงตามลำดับใหม่แล้ว
export async function reorderContacts(elderId: string, contactIds: string[]): Promise<void> {
  try {
    // ส่งลำดับใหม่ไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    await apiClient.patch(`/api/elders/${elderId}/emergency-contacts/order`, { contactIds });
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}

// ลบผู้ติดต่อฉุกเฉิน
// ใช้เมื่อต้องการเอาผู้ติดต่อออกจากรายชื่อของผู้สูงอายุ
export async function deleteContact(elderId: string, contactId: string) {
  try {
    // ส่งคำขอลบผู้ติดต่อไปที่ apiClient
    // ถัดไปไปที่ api.ts เพื่อส่ง request ออกไป
    await apiClient.delete(`/api/elders/${elderId}/emergency-contacts/${contactId}`);
  } catch (error) {
    // แปลง error ให้เป็นรูปแบบเดียวก่อนส่งกลับไปหน้าที่เรียกใช้
    throw toApiError(error);
  }
}
