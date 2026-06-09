/**
 * useFallAlertStore — fall status UI state + reset
 */
import { useFallAlertStore } from '../../store/useFallAlertStore';

beforeEach(() => {
  useFallAlertStore.getState().resetFallAlertState();
});

describe('useFallAlertStore', () => {
  describe('initial state', () => {
    it('starts with no active fall', () => {
      const s = useFallAlertStore.getState();
      expect(s.fallStatus).toBeNull();
      expect(s.lastFallUpdate).toBeNull();
      expect(s.activeFallEventId).toBeNull();
    });
  });

  describe('setFallStatus', () => {
    it('sets FALL status', () => {
      useFallAlertStore.getState().setFallStatus('FALL');
      expect(useFallAlertStore.getState().fallStatus).toBe('FALL');
    });

    it('sets NORMAL status (cancel/resolve)', () => {
      useFallAlertStore.getState().setFallStatus('FALL');
      useFallAlertStore.getState().setFallStatus('NORMAL');
      expect(useFallAlertStore.getState().fallStatus).toBe('NORMAL');
    });

    it('accepts null', () => {
      useFallAlertStore.getState().setFallStatus('FALL');
      useFallAlertStore.getState().setFallStatus(null);
      expect(useFallAlertStore.getState().fallStatus).toBeNull();
    });
  });

  describe('confirmed fall flow', () => {
    it('transitions FALL → NORMAL correctly', () => {
      useFallAlertStore.getState().setFallStatus('FALL');
      useFallAlertStore.getState().setFallStatus('NORMAL');
      expect(useFallAlertStore.getState().fallStatus).toBe('NORMAL');
    });
  });

  describe('setActiveFallEventId', () => {
    it('sets event id', () => {
      useFallAlertStore.getState().setActiveFallEventId('event-abc');
      expect(useFallAlertStore.getState().activeFallEventId).toBe('event-abc');
    });

    it('clears event id on resolve', () => {
      useFallAlertStore.getState().setActiveFallEventId('event-abc');
      useFallAlertStore.getState().setActiveFallEventId(null);
      expect(useFallAlertStore.getState().activeFallEventId).toBeNull();
    });
  });

  describe('setLastFallUpdate', () => {
    it('stores the timestamp', () => {
      const now = new Date();
      useFallAlertStore.getState().setLastFallUpdate(now);
      expect(useFallAlertStore.getState().lastFallUpdate).toBe(now);
    });
  });

  describe('resetFallAlertState', () => {
    it('clears all fields on logout or elder change', () => {
      useFallAlertStore.getState().setFallStatus('FALL');
      useFallAlertStore.getState().setLastFallUpdate(new Date());
      useFallAlertStore.getState().setActiveFallEventId('event-xyz');

      useFallAlertStore.getState().resetFallAlertState();

      const s = useFallAlertStore.getState();
      expect(s.fallStatus).toBeNull();
      expect(s.lastFallUpdate).toBeNull();
      expect(s.activeFallEventId).toBeNull();
    });
  });
});
