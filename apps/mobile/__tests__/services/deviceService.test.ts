/**
 * deviceService.ts — getDeviceByCode, pairDevice, unpairDevice, getDeviceConfig, configureWifi
 */

import { apiClient } from '../../services/api';
import * as deviceService from '../../services/deviceService';

// 1. jest.mock() with inline jest.fn() — NO external variable references
jest.mock('../../services/api', () => ({
  __esModule: true,
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
  toApiError: (err: unknown) => err,
}));

// 3. Cast to jest.Mock for type-safe access
const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockPut = apiClient.put as jest.Mock;
const mockDelete = apiClient.delete as jest.Mock;

describe('deviceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDeviceByCode', () => {
    it('calls GET /api/devices/by-code/:deviceCode', async () => {
      const device = {
        id: 'device-001',
        deviceCode: 'DEV-001',
        serialNumber: 'ESP32-6C689BDAF380',
        status: 'UNPAIRED',
      };
      mockGet.mockResolvedValue({ data: { data: device } });

      const result = await deviceService.getDeviceByCode('DEV-001');

      expect(mockGet).toHaveBeenCalledWith('/api/devices/by-code/DEV-001');
      expect(result).toEqual(device);
    });

    it('throws when device code is invalid', async () => {
      mockGet.mockRejectedValue(new Error('Not found'));
      await expect(deviceService.getDeviceByCode('INVALID')).rejects.toThrow('Not found');
    });
  });

  describe('pairDevice', () => {
    it('calls POST /api/device-pairings with payload', async () => {
      const device = { id: 'd1', status: 'PAIRED' };
      mockPost.mockResolvedValue({ data: { data: device } });

      const result = await deviceService.pairDevice({ deviceCode: 'DEV-001', elderId: 'e1' });

      expect(mockPost).toHaveBeenCalledWith('/api/device-pairings', {
        deviceCode: 'DEV-001',
        elderId: 'e1',
      });
      expect(result).toEqual(device);
    });
  });

  describe('unpairDevice', () => {
    it('calls DELETE /api/device-pairings/:deviceId', async () => {
      const device = { id: 'd1', status: 'UNPAIRED' };
      mockDelete.mockResolvedValue({ data: { data: device } });

      const result = await deviceService.unpairDevice({ deviceId: 'd1' });

      expect(mockDelete).toHaveBeenCalledWith('/api/device-pairings/d1');
      expect(result).toEqual(device);
    });
  });

  describe('getDeviceConfig', () => {
    it('calls GET /api/devices/:id/wifi-config', async () => {
      const device = {
        id: 'd1',
        deviceCode: 'DEV-001',
        serialNumber: 'SN-001',
        wifiStatus: 'CONNECTED',
      };
      mockGet.mockResolvedValue({ data: { data: device } });

      const result = await deviceService.getDeviceConfig('d1');

      expect(mockGet).toHaveBeenCalledWith('/api/devices/d1/wifi-config');
      expect(result).toEqual(device);
    });
  });

  describe('configureWifi', () => {
    it('calls PUT /api/devices/:id/wifi-config with ssid and wifiPassword', async () => {
      mockPut.mockResolvedValue({ data: { data: { success: true } } });

      const result = await deviceService.configureWifi('d1', {
        ssid: 'MyWifi',
        wifiPassword: 'secret123',
      });

      expect(mockPut).toHaveBeenCalledWith('/api/devices/d1/wifi-config', {
        ssid: 'MyWifi',
        wifiPassword: 'secret123',
      });
      expect(result).toEqual({ success: true });
    });
  });
});
