/**
 * elderService.ts — createElder, getCurrentElder, getElder, updateElder
 */

import { apiClient } from '../../services/api';
import * as elderService from '../../services/elderService';

// 1. jest.mock() with inline jest.fn() — NO external variable references
jest.mock('../../services/api', () => ({
  __esModule: true,
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
  toApiError: (err: unknown) => err,
}));

// 3. Cast to jest.Mock for type-safe access
const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockPut = apiClient.put as jest.Mock;

const elder = { id: 'e1', firstName: 'สมศรี', lastName: 'มีสุข' };

describe('elderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createElder', () => {
    it('calls POST /api/elders and returns created elder', async () => {
      mockPost.mockResolvedValue({ data: { data: elder } });

      const payload = { firstName: 'สมศรี', lastName: 'มีสุข', gender: 'FEMALE' };
      const result = await elderService.createElder(payload);

      expect(mockPost).toHaveBeenCalledWith('/api/elders', payload);
      expect(result).toEqual(elder);
    });

    it('throws when API fails', async () => {
      mockPost.mockRejectedValue(new Error('Server error'));
      await expect(elderService.createElder({ firstName: 'A', lastName: 'B' })).rejects.toThrow();
    });
  });

  describe('getCurrentElder', () => {
    it('calls GET /api/elders/current and returns elder', async () => {
      mockGet.mockResolvedValue({ data: { data: elder } });

      const result = await elderService.getCurrentElder();

      expect(mockGet).toHaveBeenCalledWith('/api/elders/current');
      expect(result).toEqual(elder);
    });

    it('returns null when data is null', async () => {
      mockGet.mockResolvedValue({ data: { data: null } });
      const result = await elderService.getCurrentElder();
      expect(result).toBeNull();
    });
  });

  describe('getElder', () => {
    it('calls GET /api/elders/:elderId and returns elder', async () => {
      mockGet.mockResolvedValue({ data: { data: elder } });

      const result = await elderService.getElder('e1');

      expect(mockGet).toHaveBeenCalledWith('/api/elders/e1');
      expect(result).toEqual(elder);
    });
  });

  describe('updateElder', () => {
    it('calls PUT /api/elders/:elderId with payload', async () => {
      const updated = { ...elder, firstName: 'ใหม่' };
      mockPut.mockResolvedValue({ data: { data: updated } });

      const result = await elderService.updateElder('e1', { firstName: 'ใหม่' });

      expect(mockPut).toHaveBeenCalledWith('/api/elders/e1', { firstName: 'ใหม่' });
      expect(result).toEqual(updated);
    });
  });
});
