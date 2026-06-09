/**
 * Event Service Tests
 * Tests: createEvent, cancelFallEventByDevice, getEventsByElder, getEventById, getMonthlySummary
 */

// Mock Prisma — declare all mock fns before jest.mock so they are in scope
const mockEventCreate = jest.fn();
const mockEventFindFirst = jest.fn();
const mockEventFindMany = jest.fn();
const mockEventFindUnique = jest.fn();
const mockEventUpdate = jest.fn();
const mockEventCount = jest.fn();
const mockElderFindFirst = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    event: {
      create: mockEventCreate,
      findFirst: mockEventFindFirst,
      findMany: mockEventFindMany,
      findUnique: mockEventFindUnique,
      update: mockEventUpdate,
      count: mockEventCount,
    },
    elder: {
      findFirst: mockElderFindFirst,
    },
    $queryRaw: mockQueryRaw,
  },
}));

import {
  createEvent,
  cancelFallEventByDevice,
  getEventsByElder,
  getEventById,
  getMonthlySummary,
} from '../../../services/eventService';

// ==========================================
// Test Data
// ==========================================
const now = new Date();
const mockEvent = {
  id: 'event-001',
  elderId: 'elder-001',
  deviceId: 'device-001',
  fallStage: 'CONFIRMED' as const,
  magnitude: 9.95,
  postureDelta: 45.2,
  bpm: null,
  cancelledAt: null,
  timestamp: now,
  elder: { id: 'elder-001', firstName: 'สมชาย', lastName: 'ใจดี' },
  device: { id: 'device-001', deviceCode: 'ABC123', serialNumber: 'ESP32-123' },
};

describe('Event Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // createEvent
  // ==========================================
  describe('createEvent', () => {
    it('should create event with all fields', async () => {
      mockEventCreate.mockResolvedValue(mockEvent);

      const result = await createEvent({
        elderId: 'elder-001',
        deviceId: 'device-001',
        fallStage: 'CONFIRMED',
        bpm: 82,
        magnitude: 9.95,
        postureDelta: 45.2,
      });

      expect(result.fallStage).toBe('CONFIRMED');
      expect(mockEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            elderId: 'elder-001',
            deviceId: 'device-001',
            fallStage: 'CONFIRMED',
          }),
        }),
      );
    });
  });

  // ==========================================
  // cancelFallEventByDevice
  // ==========================================
  describe('cancelFallEventByDevice', () => {
    it('should cancel pending fall (PENDING_CONFIRMATION) when found within 2 minutes', async () => {
      const pendingFall = {
        ...mockEvent,
        fallStage: 'PENDING_CONFIRMATION' as const,
        timestamp: new Date(Date.now() - 30_000),
      };
      // first findFirst call returns pendingFall, second should not be called
      mockEventFindFirst.mockResolvedValueOnce(pendingFall);
      mockEventUpdate.mockResolvedValue({
        ...pendingFall,
        cancelledAt: new Date(),
        fallStage: 'CANCELLED',
      });

      const result = await cancelFallEventByDevice('device-001');

      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        id: pendingFall.id,
        timestamp: pendingFall.timestamp,
        elderId: pendingFall.elderId,
      });
      expect(mockEventUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: pendingFall.id },
          data: {
            cancelledAt: expect.any(Date),
            fallStage: 'CANCELLED',
          },
        }),
      );
      expect(mockEventFindFirst).toHaveBeenCalledTimes(1);
      expect(mockEventFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deviceId: 'device-001',
            fallStage: 'PENDING_CONFIRMATION',
            cancelledAt: null,
          }),
        }),
      );
    });

    it('should ignore late cancel when the latest fall is already CONFIRMED', async () => {
      const confirmedFall = {
        ...mockEvent,
        fallStage: 'CONFIRMED' as const,
        timestamp: new Date(Date.now() - 45_000),
      };
      mockEventFindFirst.mockResolvedValueOnce(null);

      const result = await cancelFallEventByDevice('device-001');

      expect(confirmedFall.fallStage).toBe('CONFIRMED');
      expect(result).toBeNull();
      expect(mockEventFindFirst).toHaveBeenCalledTimes(1);
      expect(mockEventFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deviceId: 'device-001',
            fallStage: 'PENDING_CONFIRMATION',
            cancelledAt: null,
          }),
        }),
      );
      expect(mockEventUpdate).not.toHaveBeenCalled();
    });

    it('should return null if no recent fall event', async () => {
      mockEventFindFirst.mockResolvedValue(null);

      const result = await cancelFallEventByDevice('device-001');

      expect(result).toBeNull();
      expect(mockEventUpdate).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // getEventsByElder
  // ==========================================
  describe('getEventsByElder', () => {
    it('should return paginated events', async () => {
      mockElderFindFirst.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockEventFindMany.mockResolvedValue([mockEvent]);
      mockEventCount.mockResolvedValue(1);

      const result = await getEventsByElder('user-001', 'elder-001', { page: 1, limit: 20 });

      expect(mockElderFindFirst).toHaveBeenCalledWith({
        where: { id: 'elder-001', userId: 'user-001' },
      });
      expect(result.events).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should throw if user has no access to elder', async () => {
      mockElderFindFirst.mockResolvedValue(null);

      await expect(getEventsByElder('user-999', 'elder-001')).rejects.toMatchObject({
        code: 'access_denied',
      });
    });

    it('should apply startDate filter when only startDate is provided', async () => {
      const startDate = new Date('2026-03-01T00:00:00Z');
      mockElderFindFirst.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockEventFindMany.mockResolvedValue([]);
      mockEventCount.mockResolvedValue(0);

      await getEventsByElder('user-001', 'elder-001', { startDate });

      expect(mockEventFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({ gte: startDate }),
          }),
        }),
      );
    });

    it('should apply endDate filter when only endDate is provided', async () => {
      const endDate = new Date('2026-03-31T23:59:59Z');
      mockElderFindFirst.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockEventFindMany.mockResolvedValue([]);
      mockEventCount.mockResolvedValue(0);

      await getEventsByElder('user-001', 'elder-001', { endDate });

      expect(mockEventFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: expect.objectContaining({ lte: endDate }),
          }),
        }),
      );
    });

    it('should apply both startDate and endDate filters when both are provided', async () => {
      const startDate = new Date('2026-03-01T00:00:00Z');
      const endDate = new Date('2026-03-31T23:59:59Z');
      mockElderFindFirst.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockEventFindMany.mockResolvedValue([]);
      mockEventCount.mockResolvedValue(0);

      await getEventsByElder('user-001', 'elder-001', { startDate, endDate });

      expect(mockEventFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: { gte: startDate, lte: endDate },
          }),
        }),
      );
    });
  });

  // ==========================================
  // getEventById
  // ==========================================
  describe('getEventById', () => {
    it('should return event when user owns the elder', async () => {
      mockEventFindUnique.mockResolvedValue(mockEvent);
      mockElderFindFirst.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });

      const result = await getEventById('user-001', 'event-001');

      expect(mockElderFindFirst).toHaveBeenCalledWith({
        where: { id: 'elder-001', userId: 'user-001' },
      });
      expect(result).toMatchObject({ id: 'event-001' });
      expect(mockEventFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'event-001' },
        }),
      );
    });

    it('should throw eventNotFound when event does not exist', async () => {
      mockEventFindUnique.mockResolvedValue(null);

      await expect(getEventById('user-001', 'nonexistent-event')).rejects.toMatchObject({
        code: 'event_not_found',
      });

      expect(mockElderFindFirst).not.toHaveBeenCalled();
    });

    it('should throw accessDenied when user does not own the elder of the event', async () => {
      mockEventFindUnique.mockResolvedValue(mockEvent);
      // elder ownership check fails
      mockElderFindFirst.mockResolvedValue(null);

      await expect(getEventById('user-999', 'event-001')).rejects.toMatchObject({
        code: 'access_denied',
      });
    });
  });

  // ==========================================
  // getMonthlySummary
  // ==========================================
  describe('getMonthlySummary', () => {
    const countRow = {
      fall_count: BigInt(5),
      hr_high_count: BigInt(1),
      hr_normal_count: BigInt(2),
      hr_low_count: BigInt(1),
      hr_unknown_count: BigInt(1),
      cancelled_count: BigInt(3),
    };

    it('should throw accessDenied when elder is not found for this user', async () => {
      mockElderFindFirst.mockResolvedValue(null);

      await expect(getMonthlySummary('user-999', 'elder-001', 2026, 3)).rejects.toMatchObject({
        code: 'access_denied',
      });

      expect(mockQueryRaw).not.toHaveBeenCalled();
    });

    it('should return monthly summary with peakHour when peakHourRows has results', async () => {
      mockElderFindFirst.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      // $queryRaw is called twice (Promise.all); return countRows then peakHourRows
      mockQueryRaw
        .mockResolvedValueOnce([countRow])
        .mockResolvedValueOnce([{ hour: 14, cnt: BigInt(3) }]);

      const result = await getMonthlySummary('user-001', 'elder-001', 2026, 3);

      expect(mockElderFindFirst).toHaveBeenCalledWith({
        where: { id: 'elder-001', userId: 'user-001' },
      });
      expect(result).toMatchObject({
        year: 2026,
        month: 3,
        fallCount: 5,
        heartRateAtFallHigh: 1,
        heartRateAtFallNormal: 2,
        heartRateAtFallLow: 1,
        heartRateAtFallUnknown: 1,
        cancelledCount: 3,
        peakHour: 14,
      });
    });

    it('should return peakHour as null when peakHourRows is empty', async () => {
      mockElderFindFirst.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockQueryRaw.mockResolvedValueOnce([countRow]).mockResolvedValueOnce([]); // empty peakHourRows

      const result = await getMonthlySummary('user-001', 'elder-001', 2026, 3);

      expect(result.peakHour).toBeNull();
      expect(result.fallCount).toBe(5);
    });

    it('should return zero counts when countRows is empty', async () => {
      mockElderFindFirst.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockQueryRaw
        .mockResolvedValueOnce([]) // empty countRows
        .mockResolvedValueOnce([]);

      const result = await getMonthlySummary('user-001', 'elder-001', 2026, 3);

      expect(result.fallCount).toBe(0);
      expect(result.heartRateAtFallHigh).toBe(0);
      expect(result.heartRateAtFallNormal).toBe(0);
      expect(result.heartRateAtFallLow).toBe(0);
      expect(result.heartRateAtFallUnknown).toBe(0);
      expect(result.cancelledCount).toBe(0);
      expect(result.peakHour).toBeNull();
    });
  });
});
