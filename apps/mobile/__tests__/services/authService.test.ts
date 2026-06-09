/**
 * authService.ts — login, register, requestOtp, verifyOtp, resetPassword, fetchProfile, logout
 */

import * as authService from '../../services/authService';
import { apiClient } from '../../services/api';
import { setToken, clearToken } from '../../services/tokenStorage';

jest.mock('../../services/api', () => ({
  __esModule: true,
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
  toApiError: (err: unknown) => err,
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/tokenStorage', () => ({
  __esModule: true,
  setToken: jest.fn(),
  clearToken: jest.fn(),
  getToken: jest.fn(async () => null),
}));

const mockPost = apiClient.post as jest.Mock;
const mockGet = apiClient.get as jest.Mock;
const mockSetToken = setToken as jest.Mock;
const mockClearToken = clearToken as jest.Mock;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('calls POST /api/auth/login and stores token', async () => {
      const responseData = { token: 'jwt-token', user: { id: 'u1', email: 'a@b.com' } };
      mockPost.mockResolvedValue({ data: { data: responseData } });

      const result = await authService.login({ identifier: 'a@b.com', password: 'pass' });

      expect(mockPost).toHaveBeenCalledWith('/api/auth/login', {
        identifier: 'a@b.com',
        password: 'pass',
      });
      expect(mockSetToken).toHaveBeenCalledWith('jwt-token');
      expect(result).toEqual(responseData);
    });

    it('throws when API fails', async () => {
      const err = new Error('Unauthorized');
      mockPost.mockRejectedValue(err);
      await expect(authService.login({ identifier: 'bad', password: 'wrong' })).rejects.toBe(err);
    });
  });

  describe('register', () => {
    it('calls POST /api/auth/register and stores token', async () => {
      const responseData = { token: 'new-token', user: { id: 'u2', email: 'b@c.com' } };
      mockPost.mockResolvedValue({ data: { data: responseData } });

      const payload = {
        email: 'b@c.com',
        password: 'Pass1234!',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        gender: 'MALE',
      };
      const result = await authService.register(payload);

      expect(mockPost).toHaveBeenCalledWith('/api/auth/register', payload);
      expect(mockSetToken).toHaveBeenCalledWith('new-token');
      expect(result).toEqual(responseData);
    });
  });

  describe('requestOtp', () => {
    it('calls POST /api/auth/request-otp and returns OTP info', async () => {
      const otpData = { message: 'sent', referenceCode: 'REF-001', expiresInMinutes: 5 };
      mockPost.mockResolvedValue({ data: { data: otpData } });

      const result = await authService.requestOtp({ email: 'a@b.com' });

      expect(mockPost).toHaveBeenCalledWith('/api/auth/request-otp', { email: 'a@b.com' });
      expect(result).toEqual(otpData);
    });
  });

  describe('verifyOtp', () => {
    it('returns result when OTP is valid', async () => {
      mockPost.mockResolvedValue({ data: { data: { valid: true, message: 'OK' } } });

      const result = await authService.verifyOtp({ email: 'a@b.com', code: '123456' });

      expect(mockPost).toHaveBeenCalledWith('/api/auth/verify-otp', {
        email: 'a@b.com',
        code: '123456',
      });
      expect(result.valid).toBe(true);
    });

    it('throws when OTP is invalid', async () => {
      mockPost.mockResolvedValue({
        data: { data: { valid: false, message: 'รหัส OTP ไม่ถูกต้อง' } },
      });

      await expect(authService.verifyOtp({ email: 'a@b.com', code: '000000' })).rejects.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('calls POST /api/auth/reset-password', async () => {
      mockPost.mockResolvedValue({});

      await authService.resetPassword({
        email: 'a@b.com',
        code: '123456',
        newPassword: 'NewPass1!',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/auth/reset-password', {
        email: 'a@b.com',
        code: '123456',
        newPassword: 'NewPass1!',
      });
    });
  });

  describe('fetchProfile', () => {
    it('calls GET /api/users/me and returns user profile', async () => {
      const profile = { id: 'u1', email: 'a@b.com', firstName: 'Test' };
      mockGet.mockResolvedValue({ data: profile });

      const result = await authService.fetchProfile();

      expect(mockGet).toHaveBeenCalledWith('/api/users/me');
      expect(result).toEqual(profile);
    });
  });

  describe('logout', () => {
    it('calls POST /api/auth/logout before clearing token from storage', async () => {
      mockPost.mockResolvedValue({});
      await authService.logout();

      expect(mockPost).toHaveBeenCalledWith('/api/auth/logout');
      expect(mockClearToken).toHaveBeenCalled();
    });

    it('still clears token when backend logout fails', async () => {
      mockPost.mockRejectedValue(new Error('network down'));

      await authService.logout();

      expect(mockPost).toHaveBeenCalledWith('/api/auth/logout');
      expect(mockClearToken).toHaveBeenCalled();
    });
  });
});
