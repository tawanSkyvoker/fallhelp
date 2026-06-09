/**
 * useSensorStore — connection state + telemetry setters + reset
 */
import { useSensorStore } from '../../store/useSensorStore';

beforeEach(() => {
  useSensorStore.getState().resetSensorState();
});

describe('useSensorStore', () => {
  describe('initial state', () => {
    it('starts disconnected with no telemetry', () => {
      const s = useSensorStore.getState();
      expect(s.isConnected).toBe(false);
      expect(s.socketConnected).toBe(false);
      expect(s.wasEverConnected).toBe(false);
      expect(s.heartRate).toBeNull();
      expect(s.heartConfidence).toBeNull();
      expect(s.lastHeartUpdate).toBeNull();
      expect(s.lastStatusUpdate).toBeNull();
      expect(s.signalStrength).toBeNull();
    });
  });

  describe('setters', () => {
    it('setIsConnected updates isConnected', () => {
      useSensorStore.getState().setIsConnected(true);
      expect(useSensorStore.getState().isConnected).toBe(true);
    });

    it('setSocketConnected updates socketConnected', () => {
      useSensorStore.getState().setSocketConnected(true);
      expect(useSensorStore.getState().socketConnected).toBe(true);
    });

    it('setWasEverConnected updates wasEverConnected', () => {
      useSensorStore.getState().setWasEverConnected(true);
      expect(useSensorStore.getState().wasEverConnected).toBe(true);
    });

    it('setHeartRate updates heartRate', () => {
      useSensorStore.getState().setHeartRate(72);
      expect(useSensorStore.getState().heartRate).toBe(72);
    });

    it('setHeartRate accepts null', () => {
      useSensorStore.getState().setHeartRate(72);
      useSensorStore.getState().setHeartRate(null);
      expect(useSensorStore.getState().heartRate).toBeNull();
    });

    it('setHeartConfidence updates heartConfidence', () => {
      useSensorStore.getState().setHeartConfidence('high');
      expect(useSensorStore.getState().heartConfidence).toBe('high');
    });

    it('setSignalStrength updates signalStrength', () => {
      useSensorStore.getState().setSignalStrength(-70);
      expect(useSensorStore.getState().signalStrength).toBe(-70);
    });

    it('setLastHeartUpdate updates lastHeartUpdate', () => {
      const now = new Date();
      useSensorStore.getState().setLastHeartUpdate(now);
      expect(useSensorStore.getState().lastHeartUpdate).toBe(now);
    });

    it('setLastStatusUpdate updates lastStatusUpdate', () => {
      const now = new Date();
      useSensorStore.getState().setLastStatusUpdate(now);
      expect(useSensorStore.getState().lastStatusUpdate).toBe(now);
    });
  });

  describe('resetSensorState', () => {
    it('clears all fields including wasEverConnected', () => {
      const s = useSensorStore.getState();
      s.setIsConnected(true);
      s.setSocketConnected(true);
      s.setWasEverConnected(true);
      s.setHeartRate(80);
      s.setHeartConfidence('medium');
      s.setSignalStrength(-65);
      s.setLastHeartUpdate(new Date());
      s.setLastStatusUpdate(new Date());

      useSensorStore.getState().resetSensorState();

      const reset = useSensorStore.getState();
      expect(reset.isConnected).toBe(false);
      expect(reset.socketConnected).toBe(false);
      expect(reset.wasEverConnected).toBe(false);
      expect(reset.heartRate).toBeNull();
      expect(reset.heartConfidence).toBeNull();
      expect(reset.signalStrength).toBeNull();
      expect(reset.lastHeartUpdate).toBeNull();
      expect(reset.lastStatusUpdate).toBeNull();
    });
  });
});
