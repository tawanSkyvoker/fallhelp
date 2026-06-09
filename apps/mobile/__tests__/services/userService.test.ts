/**
 * userService.ts — getProfile, updateProfile, changePassword, updatePushToken
 */

import * as userService from '../../services/userService';

const mockGet = jest.fn();
const mockPatch = jest.fn();
const mockPut = jest.fn();

jest.mock('../../services/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
  toApiError: (err: unknown) => err,
}));

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('calls GET /api/users/me and returns profile', async () => {
      const profile = { id: 'u1', email: 'a@b.com', firstName: 'สมชาย' };
      mockGet.mockResolvedValue({ data: { data: profile } });

      const result = await userService.getProfile();

      expect(mockGet).toHaveBeenCalledWith('/api/users/me');
      expect(result).toEqual(profile);
    });

    it('throws when API fails', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));
      await expect(userService.getProfile()).rejects.toThrow('Network error');
    });
  });

  describe('updateProfile', () => {
    it('calls PATCH /api/users/me with payload', async () => {
      const updated = { id: 'u1', firstName: 'ใหม่' };
      mockPatch.mockResolvedValue({ data: { data: updated } });

      const result = await userService.updateProfile({ firstName: 'ใหม่' });

      expect(mockPatch).toHaveBeenCalledWith('/api/users/me', { firstName: 'ใหม่' });
      expect(result).toEqual(updated);
    });
  });

  describe('changePassword', () => {
    it('calls PUT /api/users/me/password with payload', async () => {
      mockPut.mockResolvedValue({});

      await userService.changePassword({
        currentPassword: 'Old1234!',
        newPassword: 'New1234!',
      });

      expect(mockPut).toHaveBeenCalledWith('/api/users/me/password', {
        currentPassword: 'Old1234!',
        newPassword: 'New1234!',
      });
    });
  });

  describe('updatePushToken', () => {
    it('calls PUT /api/users/me/push-token', async () => {
      mockPut.mockResolvedValue({});

      await userService.updatePushToken({ pushToken: 'ExponentPushToken[xxx]' });

      expect(mockPut).toHaveBeenCalledWith('/api/users/me/push-token', {
        pushToken: 'ExponentPushToken[xxx]',
      });
    });
  });
});
