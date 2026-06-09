/**
 * useDeviceSetupStore — elderId/deviceId lifecycle
 */
import { useDeviceSetupStore } from '../../store/useDeviceSetupStore';

beforeEach(() => {
  useDeviceSetupStore.getState().clearConfig();
});

describe('useDeviceSetupStore', () => {
  describe('initial state', () => {
    it('starts with no elder and no device', () => {
      const { elderId, deviceId } = useDeviceSetupStore.getState();
      expect(elderId).toBeUndefined();
      expect(deviceId).toBeUndefined();
    });
  });

  describe('setElderConfig', () => {
    it('sets elderId and deviceId', () => {
      useDeviceSetupStore.getState().setElderConfig('elder-1', 'device-1');
      const { elderId, deviceId } = useDeviceSetupStore.getState();
      expect(elderId).toBe('elder-1');
      expect(deviceId).toBe('device-1');
    });

    it('overwrites previous config', () => {
      useDeviceSetupStore.getState().setElderConfig('elder-1', 'device-1');
      useDeviceSetupStore.getState().setElderConfig('elder-2', 'device-2');
      const { elderId, deviceId } = useDeviceSetupStore.getState();
      expect(elderId).toBe('elder-2');
      expect(deviceId).toBe('device-2');
    });

    it('accepts undefined to clear individual fields', () => {
      useDeviceSetupStore.getState().setElderConfig('elder-1', 'device-1');
      useDeviceSetupStore.getState().setElderConfig(undefined, undefined);
      const { elderId, deviceId } = useDeviceSetupStore.getState();
      expect(elderId).toBeUndefined();
      expect(deviceId).toBeUndefined();
    });
  });

  describe('clearConfig', () => {
    it('resets both fields to undefined', () => {
      useDeviceSetupStore.getState().setElderConfig('elder-1', 'device-1');
      useDeviceSetupStore.getState().clearConfig();
      const { elderId, deviceId } = useDeviceSetupStore.getState();
      expect(elderId).toBeUndefined();
      expect(deviceId).toBeUndefined();
    });
  });
});
