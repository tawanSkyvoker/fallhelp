/**
 * queryKeys.ts
 *
 * ศูนย์กลาง React Query key factory สำหรับทุก query ใน mobile app
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รวม cache key ของ React Query ไว้ที่เดียว
 * - ลดการ hardcode string ซ้ำในหลายไฟล์
 * - ช่วยให้ invalidate/refetch query ทำงานตรง cache เดียวกัน
 * - แยก key ตาม entity และ parameter สำคัญ เช่น elderId, month, year
 */

// นำเข้าจากไฟล์นี้แทนการเขียน string ตรง ๆ เพื่อป้องกัน cache key ชนกัน
export const queryKeys = {
  currentElder: () => ['currentElder'] as const,
  userProfile: () => ['userProfile'] as const,
  unreadCount: () => ['unreadCount'] as const,
  initialEvents: (elderId?: string) => ['initialEvents', elderId] as const,
  notifications: () => ['notifications'] as const,
  emergencyContacts: (elderId?: string) => ['emergencyContacts', elderId] as const,
  monthlySummary: (elderId?: string, month?: number, year?: number) =>
    ['monthlySummary', elderId, month, year] as const,
  historyEvents: (elderId?: string) => ['historyEvents', elderId] as const,
  repairHistory: () => ['repairHistory'] as const,
  members: (elderId?: string) => ['members', elderId] as const,
};
