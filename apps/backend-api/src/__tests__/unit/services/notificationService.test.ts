/**
 * Emergency Notification Flow Tests
 *
 * Tests for the notification service that sends push notifications
 * to caregivers during emergencies.
 */

// ==========================================
// Setup mocks BEFORE imports
// ==========================================

// Mock Prisma
const mockNotificationCreate = jest.fn();
const mockNotificationUpdate = jest.fn();
const mockNotificationFindMany = jest.fn();
const mockNotificationUpdateMany = jest.fn();
const mockNotificationCount = jest.fn();
const mockElderFindUnique = jest.fn();
const mockEventFindFirst = jest.fn();
const mockEventFindUnique = jest.fn();
const mockEventFindMany = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    notification: {
      create: mockNotificationCreate,
      update: mockNotificationUpdate,
      findMany: mockNotificationFindMany,
      updateMany: mockNotificationUpdateMany,
      count: mockNotificationCount,
    },
    elder: {
      findUnique: mockElderFindUnique,
    },
    event: {
      findFirst: mockEventFindFirst,
      findUnique: mockEventFindUnique,
      findMany: mockEventFindMany,
    },
  },
}));

// Mock Push Notification utilities
const mockSendNotification = jest.fn();

jest.mock('../../../utils/pushNotification', () => ({
  sendNotification: mockSendNotification,
}));

// Mock Debug
jest.mock('debug', () => {
  const dummyFn = () => {};
  return {
    __esModule: true,
    default: () => dummyFn,
  };
});

// ==========================================
// Import AFTER mocks
// ==========================================
import {
  notifyFallDetection,
  createNotification,
  attachEventsToNotifications,
  getUnreadCount,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../../services/notificationService';

describe('Emergency Notification Flow', () => {
  const MOCK_ELDER = {
    id: 'elder-001',
    firstName: 'สมหญิง',
    lastName: 'รักษาสุขภาพ',
    user: {
      id: 'user-001',
      firstName: 'นายสมศักดิ์',
      lastName: 'ใจดี',
      pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    },
  };

  const MOCK_EVENT_ID = 'event-uuid-001';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock returns
    mockElderFindUnique.mockResolvedValue(MOCK_ELDER);
    mockNotificationCreate.mockImplementation((args) =>
      Promise.resolve({ id: 'notification-' + Date.now(), ...args.data }),
    );
    mockNotificationUpdate.mockResolvedValue({});
    mockNotificationFindMany.mockResolvedValue([]);
    mockNotificationUpdateMany.mockResolvedValue({ count: 0 });
    mockNotificationCount.mockResolvedValue(5);
    mockEventFindFirst.mockResolvedValue({ bpm: 75 });
    mockEventFindUnique.mockResolvedValue({ bpm: 75 });
    mockEventFindMany.mockResolvedValue([]);
    mockSendNotification.mockResolvedValue(true);
  });

  // ==========================================
  // notifyFallDetection
  // ==========================================
  describe('notifyFallDetection', () => {
    it('should send push notification to owner with push token', async () => {
      await notifyFallDetection(MOCK_ELDER.id, MOCK_EVENT_ID);

      expect(mockSendNotification).toHaveBeenCalledTimes(1);
      expect(mockSendNotification).toHaveBeenCalledWith(
        'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        expect.objectContaining({
          title: '🚨 แจ้งเตือนฉุกเฉิน! ตรวจพบการหกล้ม',
          body: expect.stringContaining('ต้องการความช่วยเหลือด่วน'),
        }),
      );
    });

    it('should create notification record for owner', async () => {
      await notifyFallDetection(MOCK_ELDER.id, MOCK_EVENT_ID);

      expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
      expect(mockNotificationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-001',
            eventId: MOCK_EVENT_ID,
          }),
        }),
      );
    });

    it('should not send push alert if owner has no push token', async () => {
      mockElderFindUnique.mockResolvedValue({
        ...MOCK_ELDER,
        user: { ...MOCK_ELDER.user, pushToken: null },
      });

      await notifyFallDetection(MOCK_ELDER.id, MOCK_EVENT_ID);

      expect(mockSendNotification).not.toHaveBeenCalled();
      expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle non-existent elder gracefully', async () => {
      mockElderFindUnique.mockResolvedValue(null);

      await notifyFallDetection('non-existent-elder', MOCK_EVENT_ID);

      expect(mockSendNotification).not.toHaveBeenCalled();
      expect(mockNotificationCreate).not.toHaveBeenCalled();
    });

    it('should include heart rate in message when heartRateAtFall is provided', async () => {
      await notifyFallDetection(MOCK_ELDER.id, MOCK_EVENT_ID, 85);

      expect(mockNotificationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: expect.stringContaining('85 BPM'),
          }),
        }),
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        expect.objectContaining({
          data: expect.objectContaining({
            bpm: 85,
            heartRateAtFall: 85,
          }),
        }),
      );
    });
  });

  // ==========================================
  // createNotification
  // ==========================================
  describe('createNotification', () => {
    it('should save notification to DB and send push', async () => {
      mockSendNotification.mockResolvedValue(true);

      const notificationData = {
        userId: 'user-001',
        eventId: 'event-001',
        title: '⚠️ ตรวจพบการหกล้ม',
        message: 'สมหญิง รักษาสุขภาพ มีเหตุการณ์หกล้ม ตรวจสอบด่วน พร้อมค่าชีพจร 75 BPM',
        pushData: { bpm: 75 },
      };

      await createNotification(notificationData, 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]');

      const dbData = {
        userId: notificationData.userId,
        eventId: notificationData.eventId,
        title: notificationData.title,
        message: notificationData.message,
      };
      expect(mockNotificationCreate).toHaveBeenCalledWith({ data: dbData });
      expect(mockSendNotification).toHaveBeenCalledWith(
        'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
        expect.objectContaining({
          title: '⚠️ ตรวจพบการหกล้ม',
          body: 'สมหญิง รักษาสุขภาพ มีเหตุการณ์หกล้ม ตรวจสอบด่วน พร้อมค่าชีพจร 75 BPM',
          data: expect.objectContaining({
            bpm: 75,
            eventId: 'event-001',
          }),
        }),
      );
      expect(mockNotificationUpdate).not.toHaveBeenCalled();
    });

    it('should not call update even if push fails — only logs error', async () => {
      mockSendNotification.mockResolvedValue(false);

      await createNotification(
        {
          userId: 'user-001',
          eventId: 'event-001',
          title: 'Test',
          message: 'Test message',
        },
        'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      );

      expect(mockNotificationUpdate).not.toHaveBeenCalled();
    });

    it('should skip push when no token is provided', async () => {
      await createNotification({
        userId: 'user-001',
        eventId: 'event-001',
        title: 'Test',
        message: 'Test message',
      });

      expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('should skip push when token is not a valid Expo token', async () => {
      await createNotification(
        {
          userId: 'user-001',
          eventId: 'event-001',
          title: 'Test',
          message: 'Test message',
        },
        'invalid-token-format',
      );

      expect(mockNotificationCreate).toHaveBeenCalledTimes(1);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // listNotifications
  // ==========================================
  describe('listNotifications', () => {
    it('should fetch user notifications with pagination and attach event summaries', async () => {
      const notifications = [{ id: 'n-001', eventId: 'event-001' }];
      const eventTimestamp = new Date('2024-12-15T10:30:00.000Z');

      mockNotificationFindMany.mockResolvedValue(notifications);
      mockNotificationCount.mockResolvedValue(1);
      mockEventFindMany.mockResolvedValue([
        { id: 'event-001', fallStage: 'CONFIRMED', timestamp: eventTimestamp },
      ]);

      const result = await listNotifications('user-001', {
        page: 2,
        pageSize: 5,
        isRead: false,
      });

      expect(mockNotificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-001', isRead: false },
          orderBy: { createdAt: 'desc' },
          skip: 5,
          take: 5,
        }),
      );
      expect(result).toMatchObject({
        total: 1,
        page: 2,
        pageSize: 5,
        totalPages: 1,
        notifications: [
          {
            id: 'n-001',
            event: { id: 'event-001', fallStage: 'CONFIRMED', timestamp: eventTimestamp },
          },
        ],
      });
    });
  });

  // ==========================================
  // markNotificationRead
  // ==========================================
  describe('markNotificationRead', () => {
    it('should update only the current user notification and set readAt when read', async () => {
      await markNotificationRead('user-001', 'notification-001', true);

      expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
        where: { id: 'notification-001', userId: 'user-001' },
        data: expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
      });
    });

    it('should clear readAt when marking a notification unread', async () => {
      await markNotificationRead('user-001', 'notification-001', false);

      expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
        where: { id: 'notification-001', userId: 'user-001' },
        data: { isRead: false, readAt: null },
      });
    });
  });

  // ==========================================
  // markAllNotificationsRead
  // ==========================================
  describe('markAllNotificationsRead', () => {
    it('should mark only unread notifications of the current user as read', async () => {
      await markAllNotificationsRead('user-001');

      expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
        where: { userId: 'user-001', isRead: false },
        data: expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
      });
    });
  });

  // ==========================================
  // getUnreadCount
  // ==========================================
  describe('getUnreadCount', () => {
    it('should return the count of unread notifications for a user', async () => {
      mockNotificationCount.mockResolvedValue(3);

      const count = await getUnreadCount('user-001');

      expect(count).toBe(3);
      expect(mockNotificationCount).toHaveBeenCalledWith({
        where: { userId: 'user-001', isRead: false },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      mockNotificationCount.mockResolvedValue(0);

      const count = await getUnreadCount('user-001');

      expect(count).toBe(0);
    });
  });

  // ==========================================
  // attachEventsToNotifications
  // ==========================================
  describe('attachEventsToNotifications', () => {
    it('should fetch and attach events when eventId is present', async () => {
      const notifications = [{ id: 'n-001', eventId: 'event-001' }];
      mockEventFindMany.mockResolvedValue([
        {
          id: 'event-001',
          fallStage: 'CONFIRMED',
          timestamp: new Date('2024-12-15T10:30:00.000Z'),
        },
      ]);

      const result = await attachEventsToNotifications(notifications);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'n-001',
        event: expect.objectContaining({ id: 'event-001' }),
      });
    });

    it('should deduplicate event ids before querying', async () => {
      const notifications = [
        { id: 'n-001', eventId: 'event-001' },
        { id: 'n-002', eventId: 'event-001' },
      ];
      mockEventFindMany.mockResolvedValue([
        {
          id: 'event-001',
          fallStage: 'CONFIRMED',
          timestamp: new Date('2024-12-15T10:30:00.000Z'),
        },
      ]);

      const result = await attachEventsToNotifications(notifications);

      // Should only query once (deduplicated), return both notifications
      expect(mockEventFindMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
    });

    it('should attach event=null for notifications whose event was not found', async () => {
      const notifications = [{ id: 'n-001', eventId: 'event-missing' }];
      mockEventFindMany.mockResolvedValue([]);

      const result = await attachEventsToNotifications(notifications);

      expect(result[0]).toMatchObject({ id: 'n-001', event: null });
    });
  });
});
