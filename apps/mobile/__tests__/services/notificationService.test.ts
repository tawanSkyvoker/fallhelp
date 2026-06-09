/**
 * notificationService.ts — registerPushToken, listNotifications, getUnreadCount,
 *                           markAsRead, markAllAsRead
 */

import * as notificationService from '../../services/notificationService';

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPatch = jest.fn();

jest.mock('../../services/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
  toApiError: (err: unknown) => err,
}));

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerPushToken', () => {
    it('calls PUT /api/users/me/push-token', async () => {
      mockPut.mockResolvedValue({});

      await notificationService.registerPushToken('ExponentPushToken[abc]');

      expect(mockPut).toHaveBeenCalledWith('/api/users/me/push-token', {
        pushToken: 'ExponentPushToken[abc]',
      });
    });

    it('fails silently — does not throw on error', async () => {
      mockPut.mockRejectedValue(new Error('Network error'));

      // Should NOT throw
      await expect(notificationService.registerPushToken('bad-token')).resolves.toBeUndefined();
    });
  });

  describe('listNotifications', () => {
    it('calls GET /api/notifications with filters', async () => {
      const paginatedData = { data: [], total: 0, page: 1, pageSize: 20 };
      mockGet.mockResolvedValue({ data: paginatedData });

      const result = await notificationService.listNotifications({ page: 2, pageSize: 10 });

      expect(mockGet).toHaveBeenCalledWith('/api/notifications', {
        params: { page: 2, pageSize: 10 },
      });
      expect(result).toEqual(paginatedData);
    });

    it('uses empty filters when called with no args', async () => {
      mockGet.mockResolvedValue({ data: { data: [] } });
      await notificationService.listNotifications();
      expect(mockGet).toHaveBeenCalledWith('/api/notifications', { params: {} });
    });

    it('throws when API fails', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));
      await expect(notificationService.listNotifications()).rejects.toThrow();
    });
  });

  describe('getUnreadCount', () => {
    it('calls GET /api/notifications/unread-count and returns count', async () => {
      mockGet.mockResolvedValue({ data: { data: { count: 5 } } });

      const result = await notificationService.getUnreadCount();

      expect(mockGet).toHaveBeenCalledWith('/api/notifications/unread-count');
      expect(result).toBe(5);
    });

    it('returns 0 on error (fail-safe for badge display)', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await notificationService.getUnreadCount();

      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('calls PATCH /api/notifications/:id with isRead: true', async () => {
      mockPatch.mockResolvedValue({});

      await notificationService.markAsRead('n1');

      expect(mockPatch).toHaveBeenCalledWith('/api/notifications/n1', { isRead: true });
    });

    it('throws when API fails', async () => {
      mockPatch.mockRejectedValue(new Error('Not found'));
      await expect(notificationService.markAsRead('bad-id')).rejects.toThrow();
    });
  });

  describe('markAllAsRead', () => {
    it('calls PATCH /api/notifications with action: mark_all_read', async () => {
      mockPatch.mockResolvedValue({});

      await notificationService.markAllAsRead();

      expect(mockPatch).toHaveBeenCalledWith('/api/notifications', {
        action: 'mark_all_read',
      });
    });
  });
});
