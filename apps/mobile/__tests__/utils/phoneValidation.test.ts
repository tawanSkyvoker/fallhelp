import {
  THAI_PHONE_INVALID_MESSAGE,
  getThaiPhoneValidationError,
  isValidThaiPhoneNumber,
  sanitizePhoneInput,
} from '../../utils/phoneValidation';

describe('phoneValidation utils', () => {
  it('keeps only digits and limits typed phone input to 10 digits', () => {
    expect(sanitizePhoneInput('081-234-56789')).toBe('0812345678');
  });

  it('accepts Thai phone numbers with exactly 10 digits starting with 0', () => {
    expect(isValidThaiPhoneNumber('0812345678')).toBe(true);
    expect(isValidThaiPhoneNumber('081 234 5678')).toBe(true);
  });

  it('rejects phone numbers that are shorter, longer, or do not start with 0', () => {
    expect(isValidThaiPhoneNumber('081234567')).toBe(false);
    expect(isValidThaiPhoneNumber('08123456789')).toBe(false);
    expect(isValidThaiPhoneNumber('1812345678')).toBe(false);
  });

  it('returns validation error for required or malformed phone values', () => {
    expect(getThaiPhoneValidationError('', { required: true })).toBe('กรุณากรอกเบอร์โทรศัพท์');
    expect(getThaiPhoneValidationError('081234567')).toBe(THAI_PHONE_INVALID_MESSAGE);
    expect(getThaiPhoneValidationError('')).toBeNull();
  });
});
