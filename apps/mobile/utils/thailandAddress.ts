/**
 * thailandAddress.ts
 *
 * Helper สำหรับดึงข้อมูลที่อยู่ไทยจาก dataset กลาง
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - โหลดข้อมูลจังหวัด อำเภอ ตำบล และรหัสไปรษณีย์จาก JSON
 * - คืนรายการจังหวัดทั้งหมด
 * - คืนรายการอำเภอตามจังหวัด และตำบลตามอำเภอ
 * - ค้นหารหัสไปรษณีย์จากจังหวัด อำเภอ และตำบลที่เลือก
 */

import thailandData from '../assets/thailand-address.json';

export interface ThailandAddress {
  district: string;
  amphoe: string;
  province: string;
  zipcode: number;
}

const data: ThailandAddress[] = thailandData as ThailandAddress[];

const PROVINCE_REGION_GROUPS: readonly (readonly string[])[] = [
  ['กรุงเทพมหานคร', 'สมุทรปราการ', 'นนทบุรี', 'ปทุมธานี'],
  ['พระนครศรีอยุธยา', 'อ่างทอง', 'ลพบุรี', 'สิงห์บุรี', 'ชัยนาท', 'สระบุรี'],
  [
    'เชียงใหม่',
    'ลำพูน',
    'ลำปาง',
    'อุตรดิตถ์',
    'แพร่',
    'น่าน',
    'พะเยา',
    'เชียงราย',
    'แม่ฮ่องสอน',
    'นครสวรรค์',
    'อุทัยธานี',
    'กำแพงเพชร',
    'ตาก',
    'สุโขทัย',
    'พิษณุโลก',
    'พิจิตร',
    'เพชรบูรณ์',
  ],
  [
    'นครราชสีมา',
    'บุรีรัมย์',
    'สุรินทร์',
    'ศรีสะเกษ',
    'อุบลราชธานี',
    'ยโสธร',
    'ชัยภูมิ',
    'อำนาจเจริญ',
    'หนองบัวลำภู',
    'ขอนแก่น',
    'อุดรธานี',
    'เลย',
    'หนองคาย',
    'มหาสารคาม',
    'ร้อยเอ็ด',
    'กาฬสินธุ์',
    'สกลนคร',
    'นครพนม',
    'มุกดาหาร',
    'บึงกาฬ',
  ],
  ['ชลบุรี', 'ระยอง', 'จันทบุรี', 'ตราด', 'ฉะเชิงเทรา', 'ปราจีนบุรี', 'นครนายก', 'สระแก้ว'],
  [
    'ราชบุรี',
    'กาญจนบุรี',
    'สุพรรณบุรี',
    'นครปฐม',
    'สมุทรสาคร',
    'สมุทรสงคราม',
    'เพชรบุรี',
    'ประจวบคีรีขันธ์',
  ],
  [
    'นครศรีธรรมราช',
    'กระบี่',
    'พังงา',
    'ภูเก็ต',
    'สุราษฎร์ธานี',
    'ระนอง',
    'ชุมพร',
    'สงขลา',
    'สตูล',
    'ตรัง',
    'พัทลุง',
    'ปัตตานี',
    'ยะลา',
    'นราธิวาส',
  ],
];

const provinceRegionOrder = new Map<string, number>(
  PROVINCE_REGION_GROUPS.flatMap((group, regionIndex) =>
    group.map((province) => [province, regionIndex] as const),
  ),
);

function uniqueInSourceOrder(items: readonly string[]): string[] {
  return Array.from(new Set(items));
}

export function getProvinces(): string[] {
  const provinces = uniqueInSourceOrder(data.map((item) => item.province));
  const sourceOrder = new Map(provinces.map((province, index) => [province, index] as const));

  return [...provinces].sort((left, right) => {
    const leftRegion = provinceRegionOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightRegion = provinceRegionOrder.get(right) ?? Number.MAX_SAFE_INTEGER;

    if (leftRegion !== rightRegion) return leftRegion - rightRegion;

    // ในแต่ละภาคยังใช้ลำดับจาก dataset เพื่อไม่ผูกกับการเรียงตัวอักษร
    return (sourceOrder.get(left) ?? 0) - (sourceOrder.get(right) ?? 0);
  });
}

export function getAmphoes(province: string): string[] {
  // รักษาลำดับจาก dataset เพื่อให้ wheel picker ตรงกับ province/amphoe code ในไฟล์ JSON
  return uniqueInSourceOrder(
    data.filter((item) => item.province === province).map((item) => item.amphoe),
  );
}

export function getDistricts(province: string, amphoe: string): string[] {
  // รักษาลำดับตำบลจาก dataset หลังกรองจังหวัดและอำเภอที่เลือกไว้
  return uniqueInSourceOrder(
    data
      .filter((item) => item.province === province && item.amphoe === amphoe)
      .map((item) => item.district),
  );
}

export function getZipcode(province: string, amphoe: string, district: string): number | null {
  // หา zipcode จากชุดที่อยู่เต็ม ถ้าไม่พบให้คืน null เพื่อให้ฟอร์มจัดการต่อ
  const found = data.find(
    (item) => item.province === province && item.amphoe === amphoe && item.district === district,
  );

  return found ? found.zipcode : null;
}
