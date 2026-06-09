/**
 * User Service Tests
 * Tests: getUserProfile, updateUserProfile, changePassword, updatePushToken
 */

// Mock Prisma
const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'notif-123' }),
    },
  },
}));

// Mock fileCleanup
const mockDeleteOldProfileImage = jest.fn();
jest.mock('../../../utils/fileCleanup', () => ({
  deleteOldProfileImage: (...args: unknown[]) => mockDeleteOldProfileImage(...args),
}));

// Mock password utils
const mockHashPassword = jest.fn();
const mockComparePassword = jest.fn();
const mockIsPasswordStrong = jest.fn();

jest.mock('../../../utils/password', () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
  comparePassword: (...args: unknown[]) => mockComparePassword(...args),
  isPasswordStrong: (pw: unknown) => mockIsPasswordStrong(pw),
}));

// Mock logger
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
  getUserProfile,
  updateUserProfile,
  changePassword,
  updatePushToken,
} from '../../../services/userService';

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

describe('User Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPasswordStrong.mockReturnValue(true);
    mockHashPassword.mockResolvedValue('new-hashed-password');
  });

  // ==========================================
  // getUserProfile
  // ==========================================
  describe('getUserProfile', () => {
    it('should return user without password', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);

      const result = await getUserProfile('user-001');

      expect(result.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw if user not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(getUserProfile('nonexistent')).rejects.toMatchObject({
        code: 'user_not_found',
      });
    });
  });

  // ==========================================
  // updateUserProfile
  // ==========================================
  describe('updateUserProfile', () => {
    it('should update and return user without password', async () => {
      const updated = { ...mockUser, firstName: 'Jane' };
      mockUserUpdate.mockResolvedValue(updated);

      const result = await updateUserProfile('user-001', { firstName: 'Jane' });

      expect(result.firstName).toBe('Jane');
      expect(result).not.toHaveProperty('password');
    });

    it('should pass email field to prisma update', async () => {
      const updated = { ...mockUser, email: 'updated@test.com' };
      mockUserUpdate.mockResolvedValue(updated);

      const result = await updateUserProfile('user-001', { email: 'updated@test.com' });

      expect(result.email).toBe('updated@test.com');
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-001' },
          data: expect.objectContaining({
            email: 'updated@test.com',
          }),
        }),
      );
    });

    it('should delete old profile image when new image is provided and differs', async () => {
      // Current user has an existing profile image
      mockUserFindUnique.mockResolvedValue({ profileImage: 'old-image.jpg' });
      const updated = { ...mockUser, profileImage: 'new-image.jpg' };
      mockUserUpdate.mockResolvedValue(updated);
      mockDeleteOldProfileImage.mockResolvedValue(undefined);

      await updateUserProfile('user-001', { profileImage: 'new-image.jpg' });

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: 'user-001' },
        select: { profileImage: true },
      });
      expect(mockDeleteOldProfileImage).toHaveBeenCalledWith('old-image.jpg');
    });

    it('should not delete old image when new image is same as current', async () => {
      mockUserFindUnique.mockResolvedValue({ profileImage: 'same-image.jpg' });
      const updated = { ...mockUser, profileImage: 'same-image.jpg' };
      mockUserUpdate.mockResolvedValue(updated);

      await updateUserProfile('user-001', { profileImage: 'same-image.jpg' });

      expect(mockDeleteOldProfileImage).not.toHaveBeenCalled();
    });

    it('should not delete old image when current user has no profile image', async () => {
      mockUserFindUnique.mockResolvedValue({ profileImage: null });
      const updated = { ...mockUser, profileImage: 'new-image.jpg' };
      mockUserUpdate.mockResolvedValue(updated);

      await updateUserProfile('user-001', { profileImage: 'new-image.jpg' });

      expect(mockDeleteOldProfileImage).not.toHaveBeenCalled();
    });

    it('should skip old image lookup when no new profileImage is provided', async () => {
      const updated = { ...mockUser, firstName: 'Jane' };
      mockUserUpdate.mockResolvedValue(updated);

      await updateUserProfile('user-001', { firstName: 'Jane' });

      // findUnique for profileImage should not be called since no new image
      expect(mockUserFindUnique).not.toHaveBeenCalled();
      expect(mockDeleteOldProfileImage).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // changePassword
  // ==========================================
  describe('changePassword', () => {
    it('should change password with valid current password', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockUserUpdate.mockResolvedValue(mockUser);

      const result = await changePassword('user-001', 'OldPass1', 'NewStrongPass1');

      expect(result.message).toBe('Password changed successfully');
      expect(mockHashPassword).toHaveBeenCalledWith('NewStrongPass1');
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-001' },
          data: { password: 'new-hashed-password' },
        }),
      );
    });

    it('should throw if user not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(changePassword('nonexistent', 'old', 'new')).rejects.toMatchObject({
        code: 'user_not_found',
      });
    });

    it('should throw if current password is incorrect', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(false);

      await expect(changePassword('user-001', 'wrong', 'NewPass1')).rejects.toMatchObject({
        code: 'current_password_incorrect',
      });
    });

    it('should throw if new password is weak', async () => {
      mockUserFindUnique.mockResolvedValue(mockUser);
      mockComparePassword.mockResolvedValue(true);
      mockIsPasswordStrong.mockReturnValue(false);

      await expect(changePassword('user-001', 'OldPass1', 'weak')).rejects.toMatchObject({
        code: 'validation_error',
      });
    });
  });

  // ==========================================
  // updatePushToken
  // ==========================================
  describe('updatePushToken', () => {
    it('should accept valid Expo push token', async () => {
      mockUserUpdate.mockResolvedValue(mockUser);

      const result = await updatePushToken('user-001', 'ExponentPushToken[abc123]');

      expect(result.message).toBe('Push token updated successfully');
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-001' },
          data: { pushToken: 'ExponentPushToken[abc123]' },
        }),
      );
    });

    it('should accept ExpoPushToken format', async () => {
      mockUserUpdate.mockResolvedValue(mockUser);

      const result = await updatePushToken('user-001', 'ExpoPushToken[abc123]');

      expect(result.message).toBe('Push token updated successfully');
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-001' },
          data: { pushToken: 'ExpoPushToken[abc123]' },
        }),
      );
    });

    it('should throw for invalid push token format', async () => {
      await expect(updatePushToken('user-001', 'invalid-token')).rejects.toMatchObject({
        code: 'invalid_push_token',
      });
    });

    it('should throw for empty push token', async () => {
      await expect(updatePushToken('user-001', '')).rejects.toMatchObject({
        code: 'invalid_push_token',
      });
    });
  });
});
