/**
 * deviceConnectivity Utility Tests
 * Tests: online/offline calculation from lastOnline timestamp
 */

import {
  isDeviceOnlineByLastOnline,
  getDeviceOnlineStatus,
  DEVICE_ONLINE_THRESHOLD_MS,
} from '../../../utils/deviceConnectivity';

describe('deviceConnectivity', () => {
  describe('DEVICE_ONLINE_THRESHOLD_MS', () => {
    it('should use DEVICE_ONLINE_THRESHOLD_MS env var when set (15000ms from setup.ts)', () => {
      // setup.ts sets DEVICE_ONLINE_THRESHOLD_MS=15000; code default matches runtime policy
      jest.isolateModules(() => {
        const {
          DEVICE_ONLINE_THRESHOLD_MS: threshold,
        } = require('../../../utils/deviceConnectivity'); // eslint-disable-line @typescript-eslint/no-require-imports
        expect(threshold).toBe(15000);
      });
    });
  });

  describe('isDeviceOnlineByLastOnline', () => {
    it('should return false for null', () => {
      expect(isDeviceOnlineByLastOnline(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isDeviceOnlineByLastOnline(undefined)).toBe(false);
    });

    it('should return true for Date within threshold', () => {
      const recent = new Date(Date.now() - 5000); // 5 seconds ago
      expect(isDeviceOnlineByLastOnline(recent)).toBe(true);
    });

    it('should return false for Date beyond threshold', () => {
      const old = new Date(Date.now() - 60000); // 60 seconds ago
      expect(isDeviceOnlineByLastOnline(old)).toBe(false);
    });

    it('should return true for string date within threshold', () => {
      const recent = new Date(Date.now() - 5000).toISOString();
      expect(isDeviceOnlineByLastOnline(recent)).toBe(true);
    });

    it('should return false for string date beyond threshold', () => {
      const old = new Date(Date.now() - 60000).toISOString();
      expect(isDeviceOnlineByLastOnline(old)).toBe(false);
    });

    it('should return false for invalid string date', () => {
      expect(isDeviceOnlineByLastOnline('not-a-date')).toBe(false);
    });

    it('should return true for a Date exactly at the threshold boundary (just inside)', () => {
      const justInside = new Date(Date.now() - DEVICE_ONLINE_THRESHOLD_MS + 100);
      expect(isDeviceOnlineByLastOnline(justInside)).toBe(true);
    });

    it('should return false for a Date just past the threshold', () => {
      const justOver = new Date(Date.now() - DEVICE_ONLINE_THRESHOLD_MS - 100);
      expect(isDeviceOnlineByLastOnline(justOver)).toBe(false);
    });
  });

  describe('getDeviceOnlineStatus', () => {
    it('should return "ONLINE" for recent timestamp', () => {
      const recent = new Date(Date.now() - 5000);
      expect(getDeviceOnlineStatus(recent)).toBe('ONLINE');
    });

    it('should return "OFFLINE" for old timestamp', () => {
      const old = new Date(Date.now() - 60000);
      expect(getDeviceOnlineStatus(old)).toBe('OFFLINE');
    });

    it('should return "OFFLINE" for null', () => {
      expect(getDeviceOnlineStatus(null)).toBe('OFFLINE');
    });

    it('should return "OFFLINE" for undefined', () => {
      expect(getDeviceOnlineStatus(undefined)).toBe('OFFLINE');
    });
  });
});
