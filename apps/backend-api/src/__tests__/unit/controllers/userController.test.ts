/**
 * User Controller Tests
 * Tests: getProfile, updateProfile, changePassword, updatePushToken
 */

const mockGetUserProfile = jest.fn();
const mockUpdateUserProfile = jest.fn();
const mockChangePassword = jest.fn();
const mockUpdatePushToken = jest.fn();

jest.mock('../../../services/userService', () => ({
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
  updatePushToken: (...args: unknown[]) => mockUpdatePushToken(...args),
}));

import * as userController from '../../../controllers/userController';

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

describe('userController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile on success', async () => {
      const profile = { id: 'user-1', email: 'a@b.com' };
      mockGetUserProfile.mockResolvedValue(profile);

      const req = makeReq();
      const res = makeRes();

      await userController.getProfile(req, res, next);

      expect(mockGetUserProfile).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: profile }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await userController.getProfile(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('updateProfile', () => {
    it('should call userService.updateUserProfile and return updated user', async () => {
      const body = { firstName: 'John', lastName: 'Doe', phone: '0812345678' };
      const updated = { id: 'user-1', ...body };
      mockUpdateUserProfile.mockResolvedValue(updated);

      const req = makeReq({ body });
      const res = makeRes();

      await userController.updateProfile(req, res, next);

      expect(mockUpdateUserProfile).toHaveBeenCalledWith('user-1', body);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: updated }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await userController.updateProfile(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('changePassword', () => {
    it('should call userService.changePassword and return result', async () => {
      const result = { success: true };
      mockChangePassword.mockResolvedValue(result);

      const req = makeReq({ body: { currentPassword: 'old', newPassword: 'NewPass1!' } });
      const res = makeRes();

      await userController.changePassword(req, res, next);

      expect(mockChangePassword).toHaveBeenCalledWith('user-1', 'old', 'NewPass1!');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await userController.changePassword(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('updatePushToken', () => {
    it('should call userService.updatePushToken and return result', async () => {
      const token = 'ExponentPushToken[xxx]';
      const result = { pushToken: token };
      mockUpdatePushToken.mockResolvedValue(result);

      const req = makeReq({ body: { pushToken: token } });
      const res = makeRes();

      await userController.updatePushToken(req, res, next);

      expect(mockUpdatePushToken).toHaveBeenCalledWith('user-1', token);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: result }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await userController.updatePushToken(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });
});
