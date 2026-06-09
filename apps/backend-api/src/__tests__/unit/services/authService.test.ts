/**
 * Auth Service Tests
 * Tests: register, login, requestOtp, verifyOtp, resetPassword, getProfile, cleanupExpiredOtps
 */

// Mock Prisma
const mockUserFindUnique = jest.fn();
const mockUserFindFirst = jest.fn();
const mockUserCreate = jest.fn();
const mockUserUpdate = jest.fn();
const mockAuthOtpFindFirst = jest.fn();
const mockAuthOtpCreate = jest.fn();
const mockAuthOtpDelete = jest.fn();
const mockAuthOtpDeleteMany = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: mockUserFindUnique,
      findFirst: mockUserFindFirst,
      create: mockUserCreate,
      update: mockUserUpdate,
    },
    authOtp: {
      findFirst: mockAuthOtpFindFirst,
      create: mockAuthOtpCreate,
      delete: mockAuthOtpDelete,
      deleteMany: mockAuthOtpDeleteMany,
    },
  },
}));

// Mock password utils
const mockHashPassword = jest.fn();
const mockComparePassword = jest.fn();
const mockGenerateOtp = jest.fn();
const mockIsPasswordStrong = jest.fn();

jest.mock('../../../utils/password', () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
  comparePassword: (...args: unknown[]) => mockComparePassword(...args),
  generateOtp: () => mockGenerateOtp(),
  isPasswordStrong: (pw: unknown) => mockIsPasswordStrong(pw),
}));

// Mock JWT
const mockGenerateToken = jest.fn();

jest.mock('../../../utils/jwt', () => ({
  generateToken: (payload: unknown) => mockGenerateToken(payload),
}));

// Mock email
const mockSendOtpEmail = jest.fn();

jest.mock('../../../utils/email', () => ({
  sendOtpEmail: (...args: unknown[]) => mockSendOtpEmail(...args),
}));

// Mock time
jest.mock('../../../utils/time', () => ({
  addMinutes: (mins: number) => new Date(Date.now() + mins * 60000),
}));

// Mock debug & logger
jest.mock('debug', () => {
  const dummyFn = () => {};
  return {
    __esModule: true,
    default: () => dummyFn,
  };
});
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    audit: jest.fn(),
  },
}));

import {
  register,
  login,
  requestOtp,
  verifyOtp,
  resetPassword,
  getProfile,
  logout,
  cleanupExpiredOtps,
} from '../../../services/authService';

// ==========================================
// Test Data
// ==========================================
const mockUser = {
  id: 'user-001',
  email: 'test@example.com',
  password: 'hashed-password',
  firstName: 'John',
  lastName: 'Doe',
  phone: '0891234567',
  role: 'CAREGIVER' as const,
  gender: 'MALE',
  profileImage: null,
  pushToken: null,
};

const mockAdminUser = {
  ...mockUser,
  id: 'admin-001',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
};

// ==========================================
// Tests
// ==========================================
describe('Auth Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockIsPasswordStrong.mockReturnValue(true);
    mockHashPassword.mockResolvedValue('hashed-password');
    mockGenerateToken.mockReturnValue('mock-jwt-token');
    mockSendOtpEmail.mockResolvedValue(undefined);
  });

  // ==========================================
  // register
  // ==========================================
  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockUserFindUnique.mockResolvedValue(null); // no existing user
      mockUserFindFirst.mockResolvedValue(null); // no existing phone
      mockUserCreate.mockResolvedValue(mockUser);

      const result = await register({
        email: 'test@example.com',
        password: 'StrongPass1',
        firstName: 'John',
        lastName: 'Doe',
        phone: '0891234567',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user).not.toHaveProperty('password');
      expect(mockHashPassword).toHaveBeenCalledWith('StrongPass1');
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
            password: 'hashed-password',
            role: 'CAREGIVER',
          }),
        }),
      );
    });

    it('should throw if email already exists', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);

      await expect(
        register({
          email: 'test@example.com',
          password: 'StrongPass1',
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).rejects.toMatchObject({ code: 'email_already_exists' });
    });

    it('should throw if password is weak', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockIsPasswordStrong.mockReturnValue(false);

      await expect(
        register({
          email: 'test@example.com',
          password: 'weak',
          firstName: 'John',
          lastName: 'Doe',
        }),
      ).rejects.toMatchObject({ code: 'validation_error' });
    });

    it('should throw if phone already exists', async () => {
      mockUserFindUnique.mockResolvedValue(null);
      mockUserFindFirst.mockResolvedValue(mockUser); // phone exists

      await expect(
        register({
          email: 'new@example.com',
          password: 'StrongPass1',
          firstName: 'John',
          lastName: 'Doe',
          phone: '0891234567',
        }),
      ).rejects.toMatchObject({ code: 'phone_already_exists' });
    });
  });

  // ==========================================
  // login
  // ==========================================
  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      mockUserFindFirst.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);

      const result = await login('test@example.com', 'correct-password');

      expect(mockUserFindFirst).toHaveBeenCalledWith({
        where: { OR: [{ email: 'test@example.com' }, { phone: 'test@example.com' }] },
      });
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw if user not found', async () => {
      mockUserFindFirst.mockResolvedValue(null);

      await expect(login('unknown@example.com', 'password')).rejects.toMatchObject({
        code: 'invalid_credentials',
      });
    });

    it('should throw if password is invalid', async () => {
      mockUserFindFirst.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(false);

      await expect(login('test@example.com', 'wrong-password')).rejects.toMatchObject({
        code: 'invalid_credentials',
      });
    });

    it('supports phone number identifier for mobile login', async () => {
      mockUserFindFirst.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);

      await login('0891234567', 'password');

      expect(mockUserFindFirst).toHaveBeenCalledWith({
        where: { OR: [{ email: '0891234567' }, { phone: '0891234567' }] },
      });
    });

    it('should allow admin login when user role is ADMIN', async () => {
      mockUserFindFirst.mockResolvedValue(mockAdminUser);
      mockComparePassword.mockResolvedValue(true);

      const result = await login('admin@example.com', 'password', 'ADMIN');

      expect(result.user.role).toBe('ADMIN');
      expect(result.token).toBe('mock-jwt-token');
    });

    it('should reject admin login when user role is not ADMIN', async () => {
      mockUserFindFirst.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);

      await expect(login('test@example.com', 'password', 'ADMIN')).rejects.toMatchObject({
        code: 'role_not_allowed',
      });
    });
  });

  // ==========================================
  // requestOtp
  // ==========================================
  describe('requestOtp', () => {
    it('should send OTP successfully', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockGenerateOtp.mockReturnValue('123456');
      mockAuthOtpDeleteMany.mockResolvedValue({ count: 0 });
      mockAuthOtpCreate.mockResolvedValue({});

      const result = await requestOtp('test@example.com');

      expect(result.message).toContain('OTP sent');
      expect(result.referenceCode).toHaveLength(4);
      expect(result.expiresInMinutes).toBe(5);
      expect(mockAuthOtpDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id },
        }),
      );
      expect(mockAuthOtpCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            code: '123456',
          }),
        }),
      );
    });

    it('should throw if user not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(requestOtp('unknown@example.com')).rejects.toMatchObject({
        code: 'user_not_found',
      });
    });

    it('should throw if user role not allowed', async () => {
      const adminUser = { ...mockUser, role: 'ADMIN' };
      mockUserFindUnique.mockResolvedValue(adminUser);

      await expect(requestOtp('admin@example.com', 'CAREGIVER')).rejects.toMatchObject({
        code: 'role_not_allowed',
      });
    });

    it('should throw when OTP email sending fails', async () => {
      // Simulate email failure — service should surface the error to caller
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockGenerateOtp.mockReturnValue('654321');
      mockAuthOtpDeleteMany.mockResolvedValue({ count: 0 });
      mockAuthOtpCreate.mockResolvedValue({});
      mockSendOtpEmail.mockRejectedValueOnce(new Error('SMTP connection refused'));

      await expect(requestOtp('test@example.com')).rejects.toMatchObject({
        code: 'email_send_failed',
      });

      // OTP is still created before the email step so the retry path can reuse it until expiry
      expect(mockAuthOtpCreate).toHaveBeenCalled();
    });
  });

  // ==========================================
  // verifyOtp
  // ==========================================
  describe('verifyOtp', () => {
    it('should verify valid OTP', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockAuthOtpFindFirst.mockResolvedValue({
        id: 'otp-001',
        code: '123456',
        expiresAt: new Date(Date.now() + 300000), // 5 min future
      });

      const result = await verifyOtp('test@example.com', '123456');

      expect(result.valid).toBe(true);
    });

    it('should reject invalid OTP code', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockAuthOtpFindFirst.mockResolvedValue(null);

      const result = await verifyOtp('test@example.com', '000000');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid or expired OTP code');
    });

    it('should reject expired OTP', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      // service queries with expiresAt > now → expired OTP returns null
      mockAuthOtpFindFirst.mockResolvedValue(null);

      const result = await verifyOtp('test@example.com', '123456');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Invalid or expired OTP code');
    });
  });

  // ==========================================
  // resetPassword
  // ==========================================
  describe('resetPassword', () => {
    it('should reset password with valid OTP', async () => {
      mockUserFindUnique.mockResolvedValueOnce(mockUser);
      mockAuthOtpFindFirst.mockResolvedValue({
        id: 'otp-001',
        code: '123456',
        expiresAt: new Date(Date.now() + 300000),
      });
      mockAuthOtpDelete.mockResolvedValue({});
      mockUserUpdate.mockResolvedValue(mockUser);

      const result = await resetPassword('test@example.com', '123456', 'NewStrongPass1');

      expect(result.message).toBe('Password reset successfully');
      expect(mockHashPassword).toHaveBeenCalledWith('NewStrongPass1');
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({ password: 'hashed-password' }),
        }),
      );
      expect(mockAuthOtpDelete).toHaveBeenCalledWith({
        where: { id: 'otp-001' },
      });
    });

    it('should throw if new password is weak', async () => {
      mockUserFindUnique.mockResolvedValueOnce(mockUser);
      mockIsPasswordStrong.mockReturnValue(false);

      await expect(resetPassword('test@example.com', '123456', 'weak')).rejects.toMatchObject({
        code: 'validation_error',
      });
    });

    it('should throw if OTP is invalid', async () => {
      mockUserFindUnique.mockResolvedValueOnce(mockUser);
      mockAuthOtpFindFirst.mockResolvedValue(null);

      await expect(
        resetPassword('test@example.com', '000000', 'NewStrongPass1'),
      ).rejects.toMatchObject({
        code: 'otp_invalid',
      });
    });

    it('should throw if OTP is expired', async () => {
      mockUserFindUnique.mockResolvedValueOnce(mockUser);
      mockAuthOtpFindFirst.mockResolvedValue({
        id: 'otp-001',
        code: '123456',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        resetPassword('test@example.com', '123456', 'NewStrongPass1'),
      ).rejects.toMatchObject({
        code: 'otp_expired',
      });
    });
  });

  // ==========================================
  // getProfile
  // ==========================================
  describe('getProfile', () => {
    it('should return user profile without password', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);

      const result = await getProfile('user-001');

      expect(result.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw if user not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(getProfile('nonexistent')).rejects.toMatchObject({
        code: 'user_not_found',
      });
    });
  });

  // ==========================================
  // logout
  // ==========================================
  describe('logout', () => {
    it('should clear pushToken and return success message (lines 249-251)', async () => {
      mockUserUpdate.mockResolvedValue({ ...mockUser, pushToken: null });

      const result = await logout('user-001');

      expect(result.message).toBe('Logged out successfully');
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        data: { pushToken: null },
      });
    });

    it('should propagate error if DB update fails during logout', async () => {
      mockUserUpdate.mockRejectedValueOnce(new Error('DB error'));

      await expect(logout('user-001')).rejects.toThrow('DB error');
    });
  });

  // ==========================================
  // cleanupExpiredOtps
  // ==========================================
  describe('cleanupExpiredOtps', () => {
    it('should delete expired OTPs and return count', async () => {
      mockAuthOtpDeleteMany.mockResolvedValue({ count: 5 });

      const result = await cleanupExpiredOtps();

      expect(result).toBe(5);
      expect(mockAuthOtpDeleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should return 0 if no expired OTPs', async () => {
      mockAuthOtpDeleteMany.mockResolvedValue({ count: 0 });

      const result = await cleanupExpiredOtps();

      expect(result).toBe(0);
    });
  });
});
