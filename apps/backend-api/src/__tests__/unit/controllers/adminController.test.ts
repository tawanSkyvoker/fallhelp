/**
 * Admin Controller Tests
 */

const mockCreateDevice = jest.fn();
const mockGetAllDevices = jest.fn();
const mockDeleteDevice = jest.fn();
const mockForceUnpairDevice = jest.fn();

jest.mock('../../../services/adminService', () => ({
  createDevice: (...args: unknown[]) => mockCreateDevice(...args),
  getAllDevices: (...args: unknown[]) => mockGetAllDevices(...args),
  deleteDevice: (...args: unknown[]) => mockDeleteDevice(...args),
  forceUnpairDevice: (...args: unknown[]) => mockForceUnpairDevice(...args),
}));

import * as adminController from '../../../controllers/adminController';

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    body: {},
    params: {},
    query: {},
    user: { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
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

describe('adminController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDevice', () => {
    it('should call adminService.createDevice and return 201', async () => {
      const device = { id: 'd1', serialNumber: 'SN-001' };
      mockCreateDevice.mockResolvedValue(device);

      const req = makeReq({ body: { serialNumber: 'SN-001' } });
      const res = makeRes();

      await adminController.createDevice(req, res, next);

      expect(mockCreateDevice).toHaveBeenCalledWith({ serialNumber: 'SN-001' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: device }),
      );
    });
  });

  describe('getAllDevices', () => {
    it('should call adminService.getAllDevices and return data', async () => {
      const devices = [{ id: 'd1' }, { id: 'd2' }];
      mockGetAllDevices.mockResolvedValue(devices);

      const req = makeReq();
      const res = makeRes();

      await adminController.getAllDevices(req, res, next);

      expect(mockGetAllDevices).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: devices }),
      );
    });
  });

  describe('deleteDevice', () => {
    it('should call adminService.deleteDevice and return success', async () => {
      mockDeleteDevice.mockResolvedValue(undefined);

      const req = makeReq({ params: { id: 'd1' } });
      const res = makeRes();

      await adminController.deleteDevice(req, res, next);

      expect(mockDeleteDevice).toHaveBeenCalledWith('d1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should call next when service throws (e.g. device is PAIRED)', async () => {
      mockDeleteDevice.mockRejectedValue(new Error('Device is PAIRED'));

      const req = makeReq({ params: { id: 'd1' } });
      const res = makeRes();

      await adminController.deleteDevice(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
    });
  });

  describe('forceUnpairDevice', () => {
    it('should call adminService.forceUnpairDevice and return success', async () => {
      mockForceUnpairDevice.mockResolvedValue(undefined);

      const req = makeReq({ params: { id: 'd1' } });
      const res = makeRes();

      await adminController.forceUnpairDevice(req, res, next);

      expect(mockForceUnpairDevice).toHaveBeenCalledWith('d1', 'admin-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should allow service fallback audit actor when no userId is present', async () => {
      mockForceUnpairDevice.mockResolvedValue(undefined);

      const req = makeReq({ user: undefined, params: { id: 'd1' } });
      const res = makeRes();

      await adminController.forceUnpairDevice(req, res, next);

      expect(mockForceUnpairDevice).toHaveBeenCalledWith('d1', undefined);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      expect(next).not.toHaveBeenCalled();
    });
  });
});
