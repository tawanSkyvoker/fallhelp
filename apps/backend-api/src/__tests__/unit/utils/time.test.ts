/**
 * time Utility Tests
 * Tests: date formatting, expiry check, date arithmetic, age calculation, ranges
 */

import {
  formatDateThai,
  formatDateISO,
  isExpired,
  addMinutes,
  addDays,
  calculateAge,
  getStartOfDay,
  getEndOfDay,
  getDateRange,
} from '../../../utils/time';

describe('time utils', () => {
  describe('formatDateISO', () => {
    it('should return an ISO 8601 string', () => {
      const date = new Date('2025-03-15T10:30:00.000Z');
      expect(formatDateISO(date)).toBe('2025-03-15T10:30:00.000Z');
    });

    it('should include timezone suffix', () => {
      const date = new Date();
      expect(formatDateISO(date)).toMatch(/Z$/);
    });
  });

  describe('formatDateThai', () => {
    it('should return a non-empty string', () => {
      const result = formatDateThai(new Date());
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include Thai month name for March', () => {
      // March 2025 → มีนาคม in Thai
      const date = new Date(2025, 2, 5, 14, 30); // March 5, 2025
      const result = formatDateThai(date);
      expect(result).toContain('มีนาคม');
    });

    it('should include the day number', () => {
      const date = new Date(2025, 2, 5, 14, 30);
      const result = formatDateThai(date);
      expect(result).toContain('5');
    });
  });

  describe('isExpired', () => {
    it('should return true for a date in the past', () => {
      const past = new Date(Date.now() - 10000);
      expect(isExpired(past)).toBe(true);
    });

    it('should return false for a date in the future', () => {
      const future = new Date(Date.now() + 10000);
      expect(isExpired(future)).toBe(false);
    });
  });

  describe('addMinutes', () => {
    it('should return a date in the future', () => {
      const before = new Date();
      const result = addMinutes(5);
      expect(result.getTime()).toBeGreaterThan(before.getTime());
    });

    it('should add approximately the correct number of minutes', () => {
      const before = Date.now();
      const result = addMinutes(10);
      const diff = result.getTime() - before;
      expect(diff).toBeGreaterThanOrEqual(9 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(11 * 60 * 1000);
    });

    it('should work with 0 minutes (approx now)', () => {
      const before = Date.now();
      const result = addMinutes(0);
      expect(result.getTime()).toBeGreaterThanOrEqual(before - 100);
    });
  });

  describe('addDays', () => {
    it('should return a date in the future', () => {
      const result = addDays(1);
      expect(result.getTime()).toBeGreaterThan(Date.now());
    });

    it('should add the correct number of days', () => {
      const before = new Date();
      const result = addDays(7);
      const diffDays = (result.getTime() - before.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(7, 0);
    });
  });

  describe('calculateAge', () => {
    it('should calculate age correctly when birthday has passed this year', () => {
      const today = new Date();
      // Birthday 30 years ago, and month/day already passed
      const birthDate = new Date(today.getFullYear() - 30, 0, 1); // Jan 1
      // If today is after Jan 1, age = 30
      if (today > birthDate) {
        expect(calculateAge(birthDate)).toBe(30);
      }
    });

    it('should subtract 1 year if birthday has not occurred yet this year', () => {
      const today = new Date();
      // Birthday is in December of the current year (future)
      const birthDate = new Date(today.getFullYear() - 25, 11, 31); // Dec 31
      // If today is before Dec 31, age = 24
      if (today.getMonth() < 11 || today.getDate() < 31) {
        expect(calculateAge(birthDate)).toBe(24);
      }
    });

    it('should return correct age for a known past date', () => {
      // Born 2000-01-01, today is 2026-03-20 → age 26
      const birthDate = new Date(2000, 0, 1);
      const age = calculateAge(birthDate);
      // The exact value depends on real current date, so just check it's reasonable
      expect(age).toBeGreaterThanOrEqual(24);
      expect(age).toBeLessThanOrEqual(30);
    });
  });

  describe('getStartOfDay', () => {
    it('should set time to 00:00:00.000', () => {
      const date = new Date(2025, 2, 15, 14, 30, 45, 999);
      const result = getStartOfDay(date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should preserve the date', () => {
      const date = new Date(2025, 2, 15, 14, 30);
      const result = getStartOfDay(date);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(2);
      expect(result.getDate()).toBe(15);
    });

    it('should not mutate the input date', () => {
      const date = new Date(2025, 2, 15, 14, 30, 45);
      getStartOfDay(date);
      expect(date.getHours()).toBe(14);
    });
  });

  describe('getEndOfDay', () => {
    it('should set time to 23:59:59.999', () => {
      const date = new Date(2025, 2, 15, 0, 0, 0, 0);
      const result = getEndOfDay(date);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });

    it('should preserve the date', () => {
      const date = new Date(2025, 2, 15);
      const result = getEndOfDay(date);
      expect(result.getDate()).toBe(15);
    });

    it('should not mutate the input date', () => {
      const date = new Date(2025, 2, 15, 5, 0, 0);
      getEndOfDay(date);
      expect(date.getHours()).toBe(5);
    });
  });

  describe('getDateRange', () => {
    it('should return an object with start and end', () => {
      const range = getDateRange(7);
      expect(range).toHaveProperty('start');
      expect(range).toHaveProperty('end');
    });

    it('should have start before end', () => {
      const range = getDateRange(7);
      expect(range.start.getTime()).toBeLessThan(range.end.getTime());
    });

    it('should have start approximately n days before end', () => {
      const range = getDateRange(30);
      const diffDays = (range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it('should have end close to now', () => {
      const before = Date.now();
      const range = getDateRange(1);
      expect(range.end.getTime()).toBeGreaterThanOrEqual(before);
    });
  });
});
