/**
 * Device Controller Tests
 * Tests: getDeviceByCode, pairDevice, unpairDevice, configureWiFi, getDeviceConfig
 */

const mockGetDeviceByCode = jest.fn();
const mockPairDevice = jest.fn();
const mockUnpairDevice = jest.fn();
const mockConfigureWiFi = jest.fn();
const mockGetDeviceConfig = jest.fn();

jest.mock('../../../services/deviceService', () => ({
  getDeviceByCode: (...args: unknown[]) => mockGetDeviceByCode(...args),
  pairDevice: (...args: unknown[]) => mockPairDevice(...args),
  unpairDevice: (...args: unknown[]) => mockUnpairDevice(...args),
  configureWiFi: (...args: unknown[]) => mockConfigureWiFi(...args),
  getDeviceConfig: (...args: unknown[]) => mockGetDeviceConfig(...args),
}));

import * as deviceController from '../../../controllers/deviceController';

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

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

describe('deviceController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDeviceByCode', () => {
    it('should call deviceService.getDeviceByCode and return device', async () => {
      const device = { id: 'd1', deviceCode: 'DEV-001' };
      mockGetDeviceByCode.mockResolvedValue(device);

      const req = makeReq({ params: { deviceCode: 'DEV-001' } });
      const res = makeRes();

      await deviceController.getDeviceByCode(req, res, next);

      expect(mockGetDeviceByCode).toHaveBeenCalledWith('DEV-001');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: device }),
      );
    });

    it('should call next when service throws', async () => {
      mockGetDeviceByCode.mockRejectedValue(new Error('not found'));

      const req = makeReq({ params: { deviceCode: 'INVALID' } });
      const res = makeRes();

      await deviceController.getDeviceByCode(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
    });
  });

  describe('pairDevice', () => {
    it('should call deviceService.pairDevice and return paired device', async () => {
      const device = { id: 'd1', status: 'PAIRED' };
      mockPairDevice.mockResolvedValue(device);

      const req = makeReq({ body: { deviceCode: 'DEV-001', elderId: 'elder-1' } });
      const res = makeRes();

      await deviceController.pairDevice(req, res, next);

      expect(mockPairDevice).toHaveBeenCalledWith('user-1', 'DEV-001', 'elder-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: device }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await deviceController.pairDevice(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('unpairDevice', () => {
    it('should call deviceService.unpairDevice using deviceId param', async () => {
      const device = { id: 'd1', status: 'UNPAIRED' };
      mockUnpairDevice.mockResolvedValue(device);

      const req = makeReq({ params: { deviceId: 'd1' } });
      const res = makeRes();

      await deviceController.unpairDevice(req, res, next);

      expect(mockUnpairDevice).toHaveBeenCalledWith('user-1', 'd1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined, params: { deviceId: 'd1' } });
      const res = makeRes();

      await deviceController.unpairDevice(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('configureWiFi', () => {
    it('should accept wifiPassword field and call configureWiFi', async () => {
      mockConfigureWiFi.mockResolvedValue({ status: 'CONFIGURING' });

      const req = makeReq({
        params: { id: 'd1' },
        body: { ssid: 'MyWifi', wifiPassword: 'wifipass' },
      });
      const res = makeRes();

      await deviceController.configureWiFi(req, res, next);

      expect(mockConfigureWiFi).toHaveBeenCalledWith('user-1', 'd1', 'MyWifi', 'wifipass');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined, params: { id: 'd1' } });
      const res = makeRes();

      await deviceController.configureWiFi(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('getDeviceConfig', () => {
    it('should call deviceService.getDeviceConfig and return config', async () => {
      const config = { ssid: 'MyWifi', wifiStatus: 'CONNECTED' };
      mockGetDeviceConfig.mockResolvedValue(config);

      const req = makeReq({ params: { id: 'd1' } });
      const res = makeRes();

      await deviceController.getDeviceConfig(req, res, next);

      expect(mockGetDeviceConfig).toHaveBeenCalledWith('user-1', 'd1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: config }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined, params: { id: 'd1' } });
      const res = makeRes();

      await deviceController.getDeviceConfig(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });
});
