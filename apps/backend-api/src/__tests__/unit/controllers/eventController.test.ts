/**
 * Event Controller Tests
 */

const mockGetEventsByElder = jest.fn();
const mockGetEventById = jest.fn();
const mockGetMonthlySummary = jest.fn();

jest.mock('../../../services/eventService', () => ({
  getEventsByElder: (...args: unknown[]) => mockGetEventsByElder(...args),
  getEventById: (...args: unknown[]) => mockGetEventById(...args),
  getMonthlySummary: (...args: unknown[]) => mockGetMonthlySummary(...args),
}));

import * as eventController from '../../../controllers/eventController';

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

describe('eventController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEvents', () => {
    it('should call eventService.getEventsByElder with parsed params', async () => {
      const result = { events: [], pagination: {} };
      mockGetEventsByElder.mockResolvedValue(result);

      const req = makeReq({ query: { elderId: 'elder-1', page: '2', limit: '10' } });
      const res = makeRes();

      await eventController.getEvents(req, res, next);

      expect(mockGetEventsByElder).toHaveBeenCalledWith(
        'user-1',
        'elder-1',
        expect.objectContaining({ page: 2, limit: 10 }),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: result.events }),
      );
    });

    it('should use default page=1 and limit=20 when not provided', async () => {
      mockGetEventsByElder.mockResolvedValue({ events: [], pagination: {} });

      const req = makeReq({ query: { elderId: 'elder-1' } });
      const res = makeRes();

      await eventController.getEvents(req, res, next);

      expect(mockGetEventsByElder).toHaveBeenCalledWith(
        'user-1',
        'elder-1',
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('should parse startDate and endDate as Date objects', async () => {
      mockGetEventsByElder.mockResolvedValue({ events: [], pagination: {} });

      const req = makeReq({
        query: { elderId: 'elder-1', startDate: '2025-01-01', endDate: '2025-03-31' },
      });
      const res = makeRes();

      await eventController.getEvents(req, res, next);

      const call = mockGetEventsByElder.mock.calls[0][2];
      expect(call.startDate).toBeInstanceOf(Date);
      expect(call.endDate).toBeInstanceOf(Date);
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await eventController.getEvents(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('getEventById', () => {
    it('should call eventService.getEventById with id', async () => {
      const event = { id: 'ev-1', type: 'FALL' };
      mockGetEventById.mockResolvedValue(event);

      const req = makeReq({ params: { id: 'ev-1' }, query: {} });
      const res = makeRes();

      await eventController.getEventById(req, res, next);

      expect(mockGetEventById).toHaveBeenCalledWith('user-1', 'ev-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: event }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({
        user: undefined,
        params: { id: 'ev-1' },
        query: {},
      });
      const res = makeRes();

      await eventController.getEventById(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('getMonthlySummary', () => {
    it('should call eventService.getMonthlySummary with year and month', async () => {
      const summary = { total: 5 };
      mockGetMonthlySummary.mockResolvedValue(summary);

      const req = makeReq({ query: { elderId: 'elder-1', year: '2025', month: '3' } });
      const res = makeRes();

      await eventController.getMonthlySummary(req, res, next);

      expect(mockGetMonthlySummary).toHaveBeenCalledWith('user-1', 'elder-1', 2025, 3);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: summary }),
      );
    });

    it('should default to current year/month when not provided', async () => {
      mockGetMonthlySummary.mockResolvedValue({});

      const now = new Date();
      const req = makeReq({ query: { elderId: 'elder-1' } });
      const res = makeRes();

      await eventController.getMonthlySummary(req, res, next);

      const [, , year, month] = mockGetMonthlySummary.mock.calls[0];
      expect(year).toBe(now.getFullYear());
      expect(month).toBe(now.getMonth() + 1);
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await eventController.getMonthlySummary(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });
});
