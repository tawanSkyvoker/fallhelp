/**
 * useSocketConnection Hook Tests
 * Tests: connection lifecycle, authentication, fall detection events
 */
import { renderHook, act } from '@testing-library/react-native';
import { useSocketConnection } from '../../hooks/useSocketConnection';
import { useFallAlertStore } from '../../store/useFallAlertStore';
import { useDeviceSetupStore } from '../../store/useDeviceSetupStore';
import { useSensorStore } from '../../store/useSensorStore';
import { io } from 'socket.io-client';

const mockEmit = jest.fn();
const mockOn = jest.fn() as jest.Mock & Record<string, Function>;
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockRemoveAllListeners = jest.fn();

jest.mock('socket.io-client', () => {
  return {
    io: jest.fn(() => ({
      connected: true,
      id: 'mock-socket-id',
      emit: mockEmit,
      on: mockOn,
      connect: mockConnect,
      disconnect: mockDisconnect,
      removeAllListeners: mockRemoveAllListeners,
    })),
  };
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
    fetchQuery: jest.fn(),
  }),
}));

jest.mock('../../services/tokenStorage', () => ({
  getToken: jest.fn(async () => 'mock-token'),
}));

jest.mock('../../services/notificationService', () => ({
  getUnreadCount: jest.fn(),
  listNotifications: jest.fn(),
}));

jest.mock('../../services/eventService', () => ({
  listEvents: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('useSocketConnection - Fall Alert Guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    useDeviceSetupStore.setState({
      elderId: 'elder-1',
      deviceId: 'device-1',
    });
    useSensorStore.getState().resetSensorState();
    useFallAlertStore.getState().resetFallAlertState();

    // Clear out any previous mock event handlers
    mockOn.mockImplementation((event, handler) => {
      mockOn[event] = handler;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('connects to socket when elderId and deviceId are present', () => {
    renderHook(() => useSocketConnection());
    expect(io).toHaveBeenCalled();
  });

  it('handles FALL_SUSPECTED without triggering UI fall status', () => {
    renderHook(() => useSocketConnection());

    // simulate socket connect & auth
    act(() => {
      mockOn['connect']?.();
      mockOn['authenticated']?.({ success: true });
    });

    const fallStore = useFallAlertStore.getState();
    expect(fallStore.fallStatus).toBeNull();

    // trigger FALL_SUSPECTED
    act(() => {
      mockOn['event_status_changed']?.({
        elderId: 'elder-1',
        status: 'FALL_SUSPECTED',
      });
    });

    // Should NOT trigger the store's fallStatus to 'FALL' yet
    expect(useFallAlertStore.getState().fallStatus).toBeNull();
  });

  it('handles FALL_CONFIRMED through fall_detected', () => {
    renderHook(() => useSocketConnection());

    act(() => {
      mockOn['fall_detected']?.({
        elderId: 'elder-1',
        eventId: 'event-1',
        deviceId: 'device-1',
        timestamp: new Date().toISOString(),
      });
    });

    const fallStore = useFallAlertStore.getState();
    expect(fallStore.fallStatus).toBe('FALL');
    expect(fallStore.activeFallEventId).toBe('event-1');
  });

  it('handles FALL_CANCELLED correctly and resets state', () => {
    renderHook(() => useSocketConnection());

    // Set some initial fall state
    useFallAlertStore.getState().setFallStatus('FALL');
    useFallAlertStore.getState().setActiveFallEventId('event-1');

    act(() => {
      mockOn['event_status_changed']?.({
        elderId: 'elder-1',
        status: 'FALL_CANCELLED',
        timestamp: new Date().toISOString(),
      });
    });

    const fallStore = useFallAlertStore.getState();
    expect(fallStore.fallStatus).toBe('NORMAL');
    expect(fallStore.activeFallEventId).toBeNull();
  });
});
