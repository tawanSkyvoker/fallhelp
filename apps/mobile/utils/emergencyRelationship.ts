/**
 * emergencyRelationship.ts
 *
 * Helper สำหรับจัดการค่าความสัมพันธ์กับผู้สูงอายุในฟอร์มผู้ติดต่อฉุกเฉิน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนด option กลางของความสัมพันธ์ที่เลือกได้
 * - แยกค่าที่เป็น preset กับค่าที่ผู้ใช้กรอกเอง
 * - normalize ข้อความก่อนนำไปบันทึกหรือแสดงผล
 * - รวมค่าจาก select และ custom input ให้เป็นค่าจริงที่ส่งต่อได้
 */

export const EMERGENCY_RELATIONSHIP_OTHER = '__OTHER__';

// ใช้ชุดคำกลาง ๆ เพื่อหลีกเลี่ยงการตีความจากมุมของผู้กรอกฟอร์ม
export const EMERGENCY_RELATIONSHIP_OPTIONS = [
  { label: 'ครอบครัว', value: 'ครอบครัว' },
  { label: 'ญาติ', value: 'ญาติ' },
  { label: 'เพื่อนบ้าน', value: 'เพื่อนบ้าน' },
  { label: 'ผู้ดูแล', value: 'ผู้ดูแล' },
  { label: 'เพื่อน', value: 'เพื่อน' },
  { label: 'อื่น ๆ', value: EMERGENCY_RELATIONSHIP_OTHER },
] as const;

const PRESET_VALUES = new Set<string>(
  EMERGENCY_RELATIONSHIP_OPTIONS.filter(
    (option) => option.value !== EMERGENCY_RELATIONSHIP_OTHER,
  ).map((option) => option.value),
);

export const normalizeEmergencyRelationship = (value?: string | null): string =>
  // trim ก่อนใช้ทุกครั้ง เพื่อไม่ให้ช่องว่างกลายเป็นค่าความสัมพันธ์คนละค่า
  (value ?? '').trim();

export const isPresetEmergencyRelationship = (value?: string | null): boolean =>
  PRESET_VALUES.has(normalizeEmergencyRelationship(value));

export const getEmergencyRelationshipSelectValue = (value?: string | null): string => {
  const normalized = normalizeEmergencyRelationship(value);

  if (!normalized) return '';

  // ถ้าค่าตรงกับ preset ให้เลือก option นั้น ถ้าไม่ตรงให้เลือก “อื่น ๆ”
  return isPresetEmergencyRelationship(normalized) ? normalized : EMERGENCY_RELATIONSHIP_OTHER;
};

export const getEmergencyRelationshipCustomValue = (value?: string | null): string => {
  const normalized = normalizeEmergencyRelationship(value);

  // custom input ใช้เฉพาะค่าที่ไม่ใช่ preset
  if (!normalized || isPresetEmergencyRelationship(normalized)) return '';

  return normalized;
};

export const buildEmergencyRelationshipValue = (
  selectedValue: string,
  customValue: string,
): string => {
  if (selectedValue === EMERGENCY_RELATIONSHIP_OTHER) {
    return normalizeEmergencyRelationship(customValue);
  }

  return normalizeEmergencyRelationship(selectedValue);
};
