/**
 * Auth Controller Tests
 * Tests: register, login, adminLogin, requestOtp, verifyOtp, resetPassword, logout, getMe
 */

const mockRegister = jest.fn();
const mockLogin = jest.fn();
const mockRequestOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockResetPassword = jest.fn();
const mockLogout = jest.fn();
const mockGetProfile = jest.fn();

jest.mock('../../../services/authService', () => ({
  register: (...args: unknown[]) => mockRegister(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  requestOtp: (...args: unknown[]) => mockRequestOtp(...args),
  verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  logout: (...args: unknown[]) => mockLogout(...args),
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));

import * as authController from '../../../controllers/authController';

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    body: {},
    params: {},
    query: {},
    user: { userId: 'user-1', email: 'test@example.com', role: 'CAREGIVER' },
    ...overrides,
  }) as unknown as import('express').Request;

const makeRes = () => {
  const res = {} as { status: jest.Mock; json: jest.Mock; send: jest.Mock };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as unknown as import('express').Response & {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
  };
};

const next = jest.fn();

describe('authController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should call authService.register and return 201 with data', async () => {
      const body = { email: 'a@b.com', password: 'Abc1234!', firstName: 'A', lastName: 'B' };
      const serviceResult = { id: 'u1', email: 'a@b.com', token: 'tok' };
      mockRegister.mockResolvedValue(serviceResult);

      const req = makeReq({ body });
      const res = makeRes();

      await authController.register(req, res, next);

      expect(mockRegister).toHaveBeenCalledWith(body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: serviceResult }),
      );
    });

    it('should call next with error when service throws', async () => {
      mockRegister.mockRejectedValue(new Error('service error'));

      const req = makeReq({ body: {} });
      const res = makeRes();

      await authController.register(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should call authService.login with identifier and return 200', async () => {
      const serviceResult = { token: 'tok', user: {} };
      mockLogin.mockResolvedValue(serviceResult);

      const req = makeReq({ body: { identifier: 'a@b.com', password: 'pass' } });
      const res = makeRes();

      await authController.login(req, res, next);

      expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'pass');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: serviceResult }),
      );
    });

    it('should fall back to email field when identifier is missing', async () => {
      mockLogin.mockResolvedValue({});

      const req = makeReq({ body: { email: 'a@b.com', password: 'pass' } });
      const res = makeRes();

      await authController.login(req, res, next);

      expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'pass');
    });

    it('should call next with validationError when identifier and email are missing', async () => {
      const req = makeReq({ body: { password: 'pass' } });
      const res = makeRes();

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].code).toBe('validation_error');
    });

    it('should call next with validationError when password is missing', async () => {
      const req = makeReq({ body: { identifier: 'a@b.com' } });
      const res = makeRes();

      await authController.login(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('adminLogin', () => {
    it('should call authService.login with ADMIN role and return 200', async () => {
      const serviceResult = { token: 'admin-token', user: { role: 'ADMIN' } };
      mockLogin.mockResolvedValue(serviceResult);

      const req = makeReq({ body: { email: 'admin@fallhelp.com', password: 'pass' } });
      const res = makeRes();

      await authController.adminLogin(req, res, next);

      expect(mockLogin).toHaveBeenCalledWith('admin@fallhelp.com', 'pass', 'ADMIN');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: serviceResult }),
      );
    });

    it('should call next with validationError when email is missing', async () => {
      const req = makeReq({ body: { password: 'pass' } });
      const res = makeRes();

      await authController.adminLogin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].code).toBe('validation_error');
    });
  });

  describe('requestOtp', () => {
    it('should call authService.requestOtp and return 200', async () => {
      const result = { referenceCode: 'REF-001' };
      mockRequestOtp.mockResolvedValue(result);

      const req = makeReq({ body: { email: 'a@b.com' } });
      const res = makeRes();

      await authController.requestOtp(req, res, next);

      expect(mockRequestOtp).toHaveBeenCalledWith('a@b.com');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: result }),
      );
    });
  });

  describe('verifyOtp', () => {
    it('should call authService.verifyOtp and return 200', async () => {
      const result = { verified: true };
      mockVerifyOtp.mockResolvedValue(result);

      const req = makeReq({ body: { email: 'a@b.com', code: '123456' } });
      const res = makeRes();

      await authController.verifyOtp(req, res, next);

      expect(mockVerifyOtp).toHaveBeenCalledWith('a@b.com', '123456');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword and return 200', async () => {
      const result = { success: true };
      mockResetPassword.mockResolvedValue(result);

      const req = makeReq({ body: { email: 'a@b.com', code: '123456', newPassword: 'NewPass1!' } });
      const res = makeRes();

      await authController.resetPassword(req, res, next);

      expect(mockResetPassword).toHaveBeenCalledWith('a@b.com', '123456', 'NewPass1!');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('logout', () => {
    it('should call authService.logout and return 200', async () => {
      mockLogout.mockResolvedValue({ message: 'logged out' });

      const req = makeReq();
      const res = makeRes();

      await authController.logout(req, res, next);

      expect(mockLogout).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await authController.logout(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('getMe', () => {
    it('should call authService.getProfile and return user', async () => {
      const user = { id: 'user-1', email: 'a@b.com' };
      mockGetProfile.mockResolvedValue(user);

      const req = makeReq();
      const res = makeRes();

      await authController.getMe(req, res, next);

      expect(mockGetProfile).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: user }));
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await authController.getMe(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });
});
