/**
 * eventService.ts — listEvents (including 403 fallback), getMonthlySummary
 */

import * as eventService from '../../services/eventService';

const mockGet = jest.fn();

jest.mock('../../services/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
  },
  toApiError: (err: unknown) => err,
}));

describe('eventService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listEvents', () => {
    it('calls GET /api/events with filters as query params', async () => {
      const paginatedData = { data: [], page: 1, pageSize: 20, total: 0 };
      mockGet.mockResolvedValue({ data: paginatedData });

      const result = await eventService.listEvents({ elderId: 'e1', page: 1 });

      expect(mockGet).toHaveBeenCalledWith('/api/events', {
        params: { elderId: 'e1', page: 1 },
      });
      expect(result).toEqual(paginatedData);
    });

    it('returns empty paginated result when API returns 403 (no elder)', async () => {
      const error403 = { status: 403, message: 'Access denied' };
      mockGet.mockRejectedValue(error403);

      const result = await eventService.listEvents({ limit: 10 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
    });

    it('throws for non-403 errors', async () => {
      const error500 = { status: 500, message: 'Server error' };
      mockGet.mockRejectedValue(error500);

      await expect(eventService.listEvents()).rejects.toEqual(error500);
    });

    it('uses empty filters when called with no args', async () => {
      mockGet.mockResolvedValue({ data: { data: [], total: 0, page: 1, pageSize: 0 } });
      await eventService.listEvents();
      expect(mockGet).toHaveBeenCalledWith('/api/events', { params: {} });
    });
  });

  describe('getMonthlySummary', () => {
    it('calls GET /api/events/summary/monthly with elderId, year, month', async () => {
      const summary = { totalEvents: 5, byType: { FALL: 3 } };
      mockGet.mockResolvedValue({ data: { success: true, data: summary } });

      const result = await eventService.getMonthlySummary('e1', 2025, 3);

      expect(mockGet).toHaveBeenCalledWith('/api/events/summary/monthly', {
        params: { elderId: 'e1', year: 2025, month: 3 },
      });
      expect(result).toEqual(summary);
    });

    it('throws when API fails', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));
      await expect(eventService.getMonthlySummary('e1', 2025, 3)).rejects.toThrow();
    });
  });
});
