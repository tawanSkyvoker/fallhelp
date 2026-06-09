/**
 * Elder Controller Tests
 * Tests: createElder, getCurrentElder, getElderById, updateElder
 */

const mockCreateElder = jest.fn();
const mockGetCurrentElder = jest.fn();
const mockGetElderById = jest.fn();
const mockUpdateElder = jest.fn();

jest.mock('../../../services/elderService', () => ({
  createElder: (...args: unknown[]) => mockCreateElder(...args),
  getCurrentElder: (...args: unknown[]) => mockGetCurrentElder(...args),
  getElderById: (...args: unknown[]) => mockGetElderById(...args),
  updateElder: (...args: unknown[]) => mockUpdateElder(...args),
}));

import * as elderController from '../../../controllers/elderController';

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

describe('elderController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createElder', () => {
    it('should call elderService.createElder and return 201', async () => {
      const elderData = { firstName: 'สมชาย', lastName: 'ใจดี', birthDate: '1950-01-01' };
      const created = { id: 'elder-1', ...elderData };
      mockCreateElder.mockResolvedValue(created);

      const req = makeReq({ body: elderData });
      const res = makeRes();

      await elderController.createElder(req, res, next);

      expect(mockCreateElder).toHaveBeenCalledWith('user-1', elderData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: created }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await elderController.createElder(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('getCurrentElder', () => {
    it('should call elderService.getCurrentElder and return elder', async () => {
      const elder = { id: 'elder-1' };
      mockGetCurrentElder.mockResolvedValue(elder);

      const req = makeReq();
      const res = makeRes();

      await elderController.getCurrentElder(req, res, next);

      expect(mockGetCurrentElder).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: elder }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await elderController.getCurrentElder(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('getElderById', () => {
    it('should call elderService.getElderById with id param and return elder', async () => {
      const elder = { id: 'elder-1', firstName: 'สมชาย' };
      mockGetElderById.mockResolvedValue(elder);

      const req = makeReq({ params: { id: 'elder-1' } });
      const res = makeRes();

      await elderController.getElderById(req, res, next);

      expect(mockGetElderById).toHaveBeenCalledWith('user-1', 'elder-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: elder }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined, params: { id: 'elder-1' } });
      const res = makeRes();

      await elderController.getElderById(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('updateElder', () => {
    it('should call elderService.updateElder and return updated elder', async () => {
      const updateData = { firstName: 'สมหญิง' };
      const updated = { id: 'elder-1', ...updateData };
      mockUpdateElder.mockResolvedValue(updated);

      const req = makeReq({ params: { id: 'elder-1' }, body: updateData });
      const res = makeRes();

      await elderController.updateElder(req, res, next);

      expect(mockUpdateElder).toHaveBeenCalledWith('user-1', 'elder-1', updateData);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: updated }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined, params: { id: 'elder-1' } });
      const res = makeRes();

      await elderController.updateElder(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });
});
