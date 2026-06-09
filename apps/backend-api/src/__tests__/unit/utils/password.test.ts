/**
 * password Utility Tests
 * Tests: hashing, comparison, strength validation, OTP generation
 */

import {
  hashPassword,
  comparePassword,
  isPasswordStrong,
  generateOtp,
} from '../../../utils/password';

describe('password utils', () => {
  describe('hashPassword', () => {
    it('should return a hashed string different from the original', async () => {
      const hash = await hashPassword('MyPassword1');
      expect(hash).not.toBe('MyPassword1');
    });

    it('should return a bcrypt hash starting with $2', () => {
      return expect(hashPassword('test')).resolves.toMatch(/^\$2[aby]\$/);
    });

    it('should produce different hashes for the same password (different salts)', async () => {
      const hash1 = await hashPassword('SamePass1');
      const hash2 = await hashPassword('SamePass1');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password vs its hash', async () => {
      const password = 'MySecretPass1';
      const hash = await hashPassword(password);
      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for wrong password', async () => {
      const hash = await hashPassword('correct');
      const result = await comparePassword('wrong', hash);
      expect(result).toBe(false);
    });

    it('should return false for empty string vs non-empty hash', async () => {
      const hash = await hashPassword('nonEmpty');
      const result = await comparePassword('', hash);
      expect(result).toBe(false);
    });
  });

  describe('isPasswordStrong', () => {
    it('should return true for a strong password', () => {
      expect(isPasswordStrong('StrongPass1')).toBe(true);
    });

    it('should return false for passwords shorter than 8 chars', () => {
      expect(isPasswordStrong('Abc1')).toBe(false);
    });

    it('should return false when missing uppercase', () => {
      expect(isPasswordStrong('lowercase1')).toBe(false);
    });

    it('should return false when missing lowercase', () => {
      expect(isPasswordStrong('UPPERCASE1')).toBe(false);
    });

    it('should return false when missing a number', () => {
      expect(isPasswordStrong('NoNumbers!')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isPasswordStrong('')).toBe(false);
    });

    it('should return true for password with exactly 8 chars meeting all criteria', () => {
      expect(isPasswordStrong('Passw0rd')).toBe(true);
    });

    it('should return true for password with special characters (as long as criteria met)', () => {
      expect(isPasswordStrong('SecureP@ss1!')).toBe(true);
    });
  });

  describe('generateOtp', () => {
    it('should return a 6-character string', () => {
      const otp = generateOtp();
      expect(otp).toHaveLength(6);
    });

    it('should return only numeric characters', () => {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should return values between 100000 and 999999', () => {
      const otp = generateOtp();
      const num = parseInt(otp, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    });

    it('should generate different OTPs across multiple calls (statistically)', () => {
      const otps = new Set(Array.from({ length: 10 }, () => generateOtp()));
      // With 10 calls across 900000 possible values, collision probability is negligible
      expect(otps.size).toBeGreaterThan(1);
    });
  });
});
