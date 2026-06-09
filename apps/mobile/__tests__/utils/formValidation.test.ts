import {
  getDeviceCodeValidationError,
  getEmailValidationError,
  getLoginIdentifierValidationError,
  getOtpValidationError,
  getPasswordPairValidationError,
  getPositiveNumberValidationError,
  getRequiredTextValidationError,
  getWifiCredentialValidationError,
  sanitizeDeviceCodeInput,
  sanitizeEmailInput,
  sanitizeLoginIdentifierInput,
  sanitizeOtpInput,
} from '../../utils/formValidation';

describe('formValidation utils', () => {
  it('validates required text after trimming whitespace', () => {
    expect(getRequiredTextValidationError('  ', 'กรุณากรอกชื่อ')).toBe('กรุณากรอกชื่อ');
    expect(getRequiredTextValidationError('สมชาย', 'กรุณากรอกชื่อ')).toBeNull();
  });

  it('sanitizes and validates email values', () => {
    expect(sanitizeEmailInput('test+1@exa mple.comไทย')).toBe('test+1@example.com');
    expect(getEmailValidationError('', { required: true })).toBe('กรุณากรอกอีเมล');
    expect(getEmailValidationError('ทดสอบ@example.com', { required: true })).toBe(
      'กรุณากรอกอีเมลเป็นภาษาอังกฤษ',
    );
    expect(getEmailValidationError('test@example', { required: true })).toBe(
      'กรุณากรอกอีเมลให้ถูกต้อง',
    );
    expect(getEmailValidationError('test@example.com', { required: true })).toBeNull();
  });

  it('sanitizes and validates login identifiers as email or Thai phone number', () => {
    expect(sanitizeLoginIdentifierInput('test@example.comไทย')).toBe('test@example.com');
    expect(getLoginIdentifierValidationError('test@example.com')).toBeNull();
    expect(getLoginIdentifierValidationError('0812345678')).toBeNull();
    expect(getLoginIdentifierValidationError('081234567')).toBe(
      'กรุณากรอกอีเมลหรือเบอร์โทรศัพท์ให้ถูกต้อง',
    );
    expect(getLoginIdentifierValidationError('username')).toBe(
      'กรุณากรอกอีเมลหรือเบอร์โทรศัพท์ให้ถูกต้อง',
    );
  });

  it('sanitizes and validates 6 digit OTP codes', () => {
    expect(sanitizeOtpInput('12ก34-567')).toBe('123456');
    expect(getOtpValidationError('12345')).toBe('กรุณากรอกรหัสให้ครบ 6 หลัก');
    expect(getOtpValidationError('123456')).toBeNull();
  });

  it('sanitizes and validates 8 character device codes', () => {
    expect(sanitizeDeviceCodeInput('83-2c e051xxx')).toBe('832CE051');
    expect(getDeviceCodeValidationError('832CE05')).toBe('กรุณากรอกรหัสอุปกรณ์ให้ครบ 8 หลัก');
    expect(getDeviceCodeValidationError('832CE051')).toBeNull();
  });

  it('validates positive numeric values used by elder forms', () => {
    expect(getPositiveNumberValidationError('', 'กรุณากรอกส่วนสูงให้ถูกต้อง')).toBe(
      'กรุณากรอกส่วนสูงให้ถูกต้อง',
    );
    expect(getPositiveNumberValidationError('0', 'กรุณากรอกส่วนสูงให้ถูกต้อง')).toBe(
      'กรุณากรอกส่วนสูงให้ถูกต้อง',
    );
    expect(getPositiveNumberValidationError('170', 'กรุณากรอกส่วนสูงให้ถูกต้อง')).toBeNull();
  });

  it('validates password pairs while reusing password policy wording', () => {
    expect(
      getPasswordPairValidationError({
        currentPassword: '',
        newPassword: 'Password1',
        confirmPassword: 'Password1',
        requireCurrentPassword: true,
        missingMessage: 'กรุณากรอกข้อมูลให้ครบทุกช่อง',
      }),
    ).toBe('กรุณากรอกข้อมูลให้ครบทุกช่อง');
    expect(
      getPasswordPairValidationError({
        newPassword: 'Password1',
        confirmPassword: 'Password2',
        missingMessage: 'กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน',
      }),
    ).toBe('กรุณากรอกรหัสผ่านยืนยันให้ตรงกัน');
    expect(
      getPasswordPairValidationError({
        newPassword: 'short',
        confirmPassword: 'short',
        missingMessage: 'กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน',
      }),
    ).toContain('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  });

  it('validates WiFi credentials without changing open-network behavior', () => {
    expect(
      getWifiCredentialValidationError({ ssid: '', password: '', requiresPassword: false }),
    ).toEqual({
      title: 'ข้อมูลไม่ครบถ้วน',
      message: 'กรุณากรอกชื่อ WiFi (SSID)',
    });
    expect(
      getWifiCredentialValidationError({ ssid: 'Home', password: '', requiresPassword: true }),
    ).toEqual({
      title: 'ต้องระบุรหัสผ่าน',
      message: 'กรุณาระบุรหัสผ่าน WiFi',
    });
    expect(
      getWifiCredentialValidationError({
        ssid: 'Home',
        password: '1234567',
        requiresPassword: true,
      }),
    ).toEqual({
      title: 'รหัสผ่านไม่ถูกต้อง',
      message: 'รหัสผ่าน WiFi ต้องมีอย่างน้อย 8 ตัวอักษร',
    });
    expect(
      getWifiCredentialValidationError({ ssid: 'Home', password: '', requiresPassword: false }),
    ).toBeNull();
  });
});
