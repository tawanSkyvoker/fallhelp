/**
 * thailandAddress Utility Tests
 * Tests: province/amphoe/district/zipcode lookups
 */
import { getAmphoes, getDistricts, getProvinces, getZipcode } from '../../utils/thailandAddress';

describe('thailandAddress utils', () => {
  it('returns provinces list', () => {
    const provinces = getProvinces();
    expect(provinces.length).toBeGreaterThan(0);
    expect(provinces).toContain('กระบี่');
  });

  it('groups provinces by region while keeping source order inside each region', () => {
    const provinces = getProvinces();
    expect(provinces.slice(0, 10)).toEqual([
      'กรุงเทพมหานคร',
      'สมุทรปราการ',
      'นนทบุรี',
      'ปทุมธานี',
      'พระนครศรีอยุธยา',
      'อ่างทอง',
      'ลพบุรี',
      'สิงห์บุรี',
      'ชัยนาท',
      'สระบุรี',
    ]);
  });

  it('keeps northeastern provinces together', () => {
    const provinces = getProvinces();
    expect(provinces.indexOf('บึงกาฬ')).toBe(provinces.indexOf('มุกดาหาร') + 1);
    expect(provinces.indexOf('บึงกาฬ')).toBeLessThan(provinces.indexOf('ชลบุรี'));
  });

  it('returns amphoes for a province', () => {
    const amphoes = getAmphoes('กระบี่');
    expect(amphoes.length).toBeGreaterThan(0);
    expect(amphoes).toContain('คลองท่อม');
  });

  it('keeps amphoe order from the address dataset', () => {
    expect(getAmphoes('กระบี่').slice(0, 4)).toEqual([
      'เมืองกระบี่',
      'เขาพนม',
      'เกาะลันตา',
      'คลองท่อม',
    ]);
  });

  it('returns districts for amphoe', () => {
    const districts = getDistricts('กระบี่', 'คลองท่อม');
    expect(districts).toContain('คลองท่อมเหนือ');
  });

  it('returns zipcode for district', () => {
    expect(getZipcode('กระบี่', 'คลองท่อม', 'คลองท่อมเหนือ')).toBe(81120);
  });

  it('returns null for missing district', () => {
    expect(getZipcode('กระบี่', 'คลองท่อม', 'ไม่พบเขต')).toBeNull();
  });
});
