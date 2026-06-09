/**
 * Notification Controller Tests
 * Tests: listNotifications, getUnreadCount, markAsRead, markAllAsRead
 * Note: notificationController delegates database work to notificationService
 */

// Mock notification service
const mockListNotifications = jest.fn();
const mockGetUnreadCount = jest.fn();
const mockMarkNotificationRead = jest.fn();
const mockMarkAllNotificationsRead = jest.fn();

jest.mock('../../../services/notificationService', () => ({
  listNotifications: (...args: unknown[]) => mockListNotifications(...args),
  getUnreadCount: (...args: unknown[]) => mockGetUnreadCount(...args),
  markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...args),
  markAllNotificationsRead: (...args: unknown[]) => mockMarkAllNotificationsRead(...args),
}));

import * as notificationController from '../../../controllers/notificationController';

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    body: {},
    params: {},
    query: {},
    user: { userId: 'user-1', email: 'test@example.com', role: 'CAREGIVER' as const },
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

describe('notificationController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listNotifications', () => {
    it('should return paginated notifications', async () => {
      const notifications = [
        { id: 'n1', event: null },
        { id: 'n2', event: null },
      ];

      mockListNotifications.mockResolvedValue({
        notifications,
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });

      const req = makeReq({ query: { page: '1', pageSize: '20' } });
      const res = makeRes();

      await notificationController.listNotifications(req, res, next);
      await flushPromises();

      expect(mockListNotifications).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ page: 1, pageSize: 20 }),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: notifications,
          total: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        }),
      );
    });

    it('should filter by isRead=true when query param is "true"', async () => {
      mockListNotifications.mockResolvedValue({
        notifications: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const req = makeReq({ query: { isRead: 'true' } });
      const res = makeRes();

      await notificationController.listNotifications(req, res, next);

      expect(mockListNotifications).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ isRead: true }),
      );
    });

    it('should filter by isRead=false when query param is "false"', async () => {
      mockListNotifications.mockResolvedValue({
        notifications: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const req = makeReq({ query: { isRead: 'false' } });
      const res = makeRes();

      await notificationController.listNotifications(req, res, next);

      expect(mockListNotifications).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ isRead: false }),
      );
    });

    it('should not filter isRead when param not provided', async () => {
      mockListNotifications.mockResolvedValue({
        notifications: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });

      const req = makeReq({ query: {} });
      const res = makeRes();

      await notificationController.listNotifications(req, res, next);

      const filterArg = mockListNotifications.mock.calls[0][1];
      expect(filterArg.isRead).toBeUndefined();
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await notificationController.listNotifications(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });

    it('should compute correct pagination for page 2 with pageSize 5', async () => {
      mockListNotifications.mockResolvedValue({
        notifications: [],
        total: 12,
        page: 2,
        pageSize: 5,
        totalPages: 3,
      });

      const req = makeReq({ query: { page: '2', pageSize: '5' } });
      const res = makeRes();

      await notificationController.listNotifications(req, res, next);
      await flushPromises();

      expect(mockListNotifications).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ page: 2, pageSize: 5 }),
      );
      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.totalPages).toBe(3); // ceil(12/5) = 3
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockGetUnreadCount.mockResolvedValue(5);

      const req = makeReq();
      const res = makeRes();

      await notificationController.getUnreadCount(req, res, next);

      expect(mockGetUnreadCount).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { count: 5 } }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await notificationController.getUnreadCount(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('markAsRead', () => {
    it('should delegate read update to notificationService', async () => {
      mockMarkNotificationRead.mockResolvedValue(undefined);

      const req = makeReq({ params: { id: 'n1' }, body: { isRead: true } });
      const res = makeRes();

      await notificationController.markAsRead(req, res, next);

      expect(mockMarkNotificationRead).toHaveBeenCalledWith('user-1', 'n1', true);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should delegate unread update to notificationService', async () => {
      mockMarkNotificationRead.mockResolvedValue(undefined);

      const req = makeReq({ params: { id: 'n1' }, body: { isRead: false } });
      const res = makeRes();

      await notificationController.markAsRead(req, res, next);

      expect(mockMarkNotificationRead).toHaveBeenCalledWith('user-1', 'n1', false);
    });

    it('should call next with validationError when isRead is not boolean', async () => {
      const req = makeReq({ params: { id: 'n1' }, body: { isRead: 'true' } });
      const res = makeRes();

      await notificationController.markAsRead(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('validation_error');
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined, params: { id: 'n1' } });
      const res = makeRes();

      await notificationController.markAsRead(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('markAllAsRead', () => {
    it('should delegate mark-all update to notificationService', async () => {
      mockMarkAllNotificationsRead.mockResolvedValue(undefined);

      const req = makeReq({ body: { action: 'mark_all_read' } });
      const res = makeRes();

      await notificationController.markAllAsRead(req, res, next);

      expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should call next with validationError for unknown action', async () => {
      const req = makeReq({ body: { action: 'delete_all' } });
      const res = makeRes();

      await notificationController.markAllAsRead(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('validation_error');
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await notificationController.markAllAsRead(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });
});
