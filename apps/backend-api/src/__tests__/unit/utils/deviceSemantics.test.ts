/**
 * deviceSemantics Utility Tests
 * Tests: online/offline status attachment, nested device semantics
 */
import { attachDeviceSemantics, attachNestedDeviceSemantics } from '../../../utils/deviceSemantics';
import * as deviceConnectivity from '../../../utils/deviceConnectivity';

describe('deviceSemantics utils', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('attachDeviceSemantics', () => {
    it('should attach semantics correctly for an ONLINE device', () => {
      jest.spyOn(deviceConnectivity, 'getDeviceOnlineStatus').mockReturnValue('ONLINE');

      const mockDevice = {
        id: '1',
        status: 'PAIRED',
        lastOnline: new Date(),
        name: 'Test Device',
      };

      const result = attachDeviceSemantics(mockDevice);

      expect(deviceConnectivity.getDeviceOnlineStatus).toHaveBeenCalledWith(mockDevice.lastOnline);
      expect(result).toEqual({
        ...mockDevice,
        pairingStatus: 'PAIRED',
        onlineStatus: 'ONLINE',
        isOnline: true,
      });
    });

    it('should attach semantics correctly for an OFFLINE device', () => {
      jest.spyOn(deviceConnectivity, 'getDeviceOnlineStatus').mockReturnValue('OFFLINE');

      const mockDevice = {
        id: '2',
        status: 'UNPAIRED',
        lastOnline: null,
      };

      const result = attachDeviceSemantics(mockDevice);

      expect(deviceConnectivity.getDeviceOnlineStatus).toHaveBeenCalledWith(null);
      expect(result).toEqual({
        ...mockDevice,
        pairingStatus: 'UNPAIRED',
        onlineStatus: 'OFFLINE',
        isOnline: false,
      });
    });
  });

  describe('attachNestedDeviceSemantics', () => {
    it('should attach semantics to a nested device', () => {
      jest.spyOn(deviceConnectivity, 'getDeviceOnlineStatus').mockReturnValue('ONLINE');

      const entity = {
        elderId: 'E1',
        device: {
          status: 'PAIRED',
          lastOnline: new Date(),
        },
      };

      const result = attachNestedDeviceSemantics(entity);

      expect(result.device).toBeDefined();
      expect(result.device).toHaveProperty('pairingStatus', 'PAIRED');
      expect(result.device).toHaveProperty('onlineStatus', 'ONLINE');
      expect(result.device).toHaveProperty('isOnline', true);
      expect(result.elderId).toBe('E1');
    });

    it('should return original entity if device is null', () => {
      const entity = {
        elderId: 'E1',
        device: null,
      };

      const result = attachNestedDeviceSemantics(entity);

      expect(result).toEqual(entity);
      expect(result.device).toBeNull();
    });

    it('should return original entity if device is undefined', () => {
      const entity = {
        elderId: 'E1',
      } as unknown as { device: null };

      const result = attachNestedDeviceSemantics(entity);

      expect(result).toEqual(entity);
    });
  });
});
