import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderWithProviders } from '../../test-utils/renderWithProviders';
import DashboardScreen from '../../../app/(tabs)/dashboard';
import { safeRouter } from '../../../utils/safeRouter';
import { useCurrentElder } from '../../../hooks/useCurrentElder';

const mockInitialEvents: unknown[] = [];

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey?: readonly unknown[] } = {}) => ({
      data: queryKey?.[0] === 'initialEvents' ? mockInitialEvents : [],
      refetch: jest.fn(),
      isLoading: false,
      isFetched: true,
    }),
    useQueryClient: () => ({
      invalidateQueries: jest.fn(),
      refetchQueries: jest.fn(),
      prefetchQuery: jest.fn(),
      setQueryData: jest.fn(),
    }),
  };
});

jest.mock('../../../hooks/useCurrentElder', () => ({
  useCurrentElder: jest.fn(),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ isSignedIn: true }),
}));

const mockFallAlertState = {
  fallStatus: null,
  lastFallUpdate: null,
  activeFallEventId: null,
  activeFallBpm: null,
  setFallStatus: jest.fn(),
  setLastFallUpdate: jest.fn(),
  setActiveFallEventId: jest.fn(),
  setActiveFallBpm: jest.fn(),
};

jest.mock('../../../store/useFallAlertStore', () => ({
  useFallAlertStore: jest.fn((selector) => selector(mockFallAlertState)),
}));

const mockSensorState = {
  isConnected: false,
  socketConnected: false,
  wasEverConnected: false,
  heartRate: null,
  heartConfidence: null,
  lastHeartUpdate: null,
  lastStatusUpdate: null,
  signalStrength: null,
  setIsConnected: jest.fn(),
  setSocketConnected: jest.fn(),
  setWasEverConnected: jest.fn(),
  setHeartRate: jest.fn(),
  setHeartConfidence: jest.fn(),
  setLastHeartUpdate: jest.fn(),
  setLastStatusUpdate: jest.fn(),
  setSignalStrength: jest.fn(),
  resetSensorState: jest.fn(),
};

const mockElder = {
  id: 'elder-1',
  firstName: 'ยาย',
  lastName: 'ใจ',
  gender: 'FEMALE',
  dateOfBirth: '1940-01-01T00:00:00.000Z',
  accessLevel: 'OWNER',
  device: {
    id: 'device-1',
    deviceCode: 'ABCD1234',
    isOnline: false,
    onlineStatus: 'OFFLINE',
  },
};

jest.mock('../../../store/useSensorStore', () => ({
  useSensorStore: Object.assign(
    jest.fn((selector) => (selector ? selector(mockSensorState) : mockSensorState)),
    {
      getState: () => mockSensorState,
      setState: jest.fn(),
    },
  ),
}));

jest.mock('../../../utils/dialogService', () => ({
  showDialog: jest.fn(),
}));

jest.mock('../../../utils/safeRouter', () => ({
  safeRouter: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    dismissTo: jest.fn(),
    setParams: jest.fn(),
    prefetch: jest.fn(),
    reload: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

describe('DashboardScreen (Tabs Index)', () => {
  const mockedUseCurrentElder = useCurrentElder as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockInitialEvents.length = 0;
    Object.assign(mockFallAlertState, {
      fallStatus: null,
      lastFallUpdate: null,
      activeFallEventId: null,
      activeFallBpm: undefined,
    });
    Object.assign(mockSensorState, {
      isConnected: false,
      socketConnected: false,
      wasEverConnected: false,
      heartRate: null,
      heartConfidence: null,
      lastHeartUpdate: null,
      lastStatusUpdate: null,
      signalStrength: null,
    });
    mockedUseCurrentElder.mockReturnValue({ data: null, isLoading: true, refetch: jest.fn() });
  });

  it('shows loading state while elders are loading', () => {
    const { getByTestId } = renderWithProviders(<DashboardScreen />);

    expect(getByTestId('dashboard-skeleton')).toBeTruthy();
  });

  it('prevents duplicate navigation when pressing device card twice', () => {
    Object.assign(mockSensorState, {
      isConnected: true,
      socketConnected: true,
      lastStatusUpdate: new Date('2026-05-04T12:00:00.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: true,
          onlineStatus: 'ONLINE',
          lastOnline: '2026-05-04T12:00:00.000Z',
        },
      },
    });

    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1_000_000;
    nowSpy.mockImplementation(() => now);

    const { getByTestId } = renderWithProviders(<DashboardScreen />);
    const deviceCard = getByTestId('home-device-card');

    fireEvent.press(deviceCard);
    now += 1200;
    fireEvent.press(deviceCard);

    expect(safeRouter.push).toHaveBeenCalledTimes(1);
    expect(safeRouter.push).toHaveBeenCalledWith('/(features)/(device)/device-info');

    nowSpy.mockRestore();
  });

  it('prevents duplicate navigation when pressing elder card twice', () => {
    Object.assign(mockSensorState, {
      isConnected: true,
      socketConnected: true,
      lastStatusUpdate: new Date('2026-05-04T12:00:00.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: true,
          onlineStatus: 'ONLINE',
          lastOnline: '2026-05-04T12:00:00.000Z',
        },
      },
    });

    const nowSpy = jest.spyOn(Date, 'now');
    let now = 2_000_000;
    nowSpy.mockImplementation(() => now);

    const { getByTestId } = renderWithProviders(<DashboardScreen />);
    const elderCard = getByTestId('home-elder-card');

    fireEvent.press(elderCard);
    now += 1200;
    fireEvent.press(elderCard);

    expect(safeRouter.push).toHaveBeenCalledTimes(1);
    expect(safeRouter.push).toHaveBeenCalledWith('/(features)/(elder)/elder-info');

    nowSpy.mockRestore();
  });

  it('shows historical event context when offline after a previously confirmed event', async () => {
    jest.useFakeTimers();
    const nowSpy = jest.spyOn(Date, 'now');
    const now = new Date('2026-05-04T12:09:00.000Z').getTime();
    nowSpy.mockImplementation(() => now);

    mockInitialEvents.push({
      id: 'event-history-1',
      elderId: 'elder-1',
      deviceId: 'device-1',
      fallStage: 'CONFIRMED',
      bpm: 82,
      timestamp: '2026-05-04T10:43:00.000Z',
      cancelledAt: null,
    });
    Object.assign(mockFallAlertState, {
      fallStatus: 'NORMAL',
      lastFallUpdate: new Date('2026-05-04T11:08:00.000Z'),
      activeFallEventId: null,
    });
    Object.assign(mockSensorState, {
      isConnected: false,
      socketConnected: true,
      heartRate: null,
      heartConfidence: null,
      lastHeartUpdate: null,
      lastStatusUpdate: new Date('2026-05-04T12:08:30.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: false,
          onlineStatus: 'OFFLINE',
          lastOnline: '2026-05-04T12:08:00.000Z',
        },
      },
    });

    try {
      const { getByText, getAllByText, queryByText } = renderWithProviders(<DashboardScreen />);

      act(() => {
        jest.advanceTimersByTime(13_000);
      });

      expect(getAllByText(/เหตุการณ์ที่ผ่าน/).length).toBeGreaterThan(0);
      expect(queryByText('ไม่ใช่เหตุการณ์ฉุกเฉินปัจจุบัน')).toBeNull();
      expect(getByText('ข้อมูลย้อนหลัง')).toBeTruthy();
      expect(getByText(/เหตุการณ์ล่าสุด\s*:/)).toBeTruthy();
      expect(queryByText('ชีพจรขณะหกล้ม')).toBeNull();
    } finally {
      nowSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('does not keep fall heart context after an acknowledged event is restored from API', async () => {
    const acknowledgedEventId = 'event-acknowledged';
    mockInitialEvents.push({
      id: acknowledgedEventId,
      elderId: 'elder-1',
      deviceId: 'device-1',
      fallStage: 'CONFIRMED',
      bpm: 86,
      timestamp: '2026-05-04T11:30:00.000Z',
      cancelledAt: null,
    });
    Object.assign(mockFallAlertState, {
      fallStatus: 'FALL',
      lastFallUpdate: null,
      activeFallEventId: acknowledgedEventId,
    });
    Object.assign(mockSensorState, {
      isConnected: true,
      socketConnected: true,
      heartRate: 86,
      heartConfidence: 'high',
      lastHeartUpdate: new Date('2026-05-04T11:30:10.000Z'),
      lastStatusUpdate: new Date('2026-05-04T11:30:10.000Z'),
    });
    await AsyncStorage.setItem('fallhelp:acknowledged_fall_event_id', acknowledgedEventId);
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: true,
          onlineStatus: 'ONLINE',
          lastOnline: '2026-05-04T11:30:10.000Z',
        },
      },
    });

    const { queryByText } = renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(mockFallAlertState.setFallStatus).toHaveBeenCalledWith('NORMAL');
      expect(mockFallAlertState.setActiveFallEventId).toHaveBeenCalledWith(null);
    });
    expect(queryByText('ชีพจรขณะหกล้ม')).toBeNull();
  });

  it('prefers event BPM from API when fall is active but event id not yet synced', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockImplementation(() => new Date('2026-05-04T14:17:30.000Z').getTime());

    mockInitialEvents.push({
      id: 'event-with-bpm',
      elderId: 'elder-1',
      deviceId: 'device-1',
      fallStage: 'CONFIRMED',
      bpm: 76,
      timestamp: '2026-05-04T14:17:00.000Z',
      cancelledAt: null,
    });
    Object.assign(mockFallAlertState, {
      fallStatus: 'FALL',
      lastFallUpdate: new Date('2026-05-04T14:17:00.000Z'),
      activeFallEventId: 'event-with-bpm',
    });
    Object.assign(mockSensorState, {
      isConnected: true,
      socketConnected: true,
      heartRate: 96,
      heartConfidence: 'high',
      lastHeartUpdate: new Date('2026-05-04T14:17:10.000Z'),
      lastStatusUpdate: new Date('2026-05-04T14:17:10.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: true,
          onlineStatus: 'ONLINE',
          lastOnline: '2026-05-04T14:17:10.000Z',
        },
      },
    });

    try {
      const { getByText, queryByText } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByText('76')).toBeTruthy();
        expect(getByText('ชีพจรขณะหกล้ม')).toBeTruthy();
      });
      expect(queryByText('ชีพจรปัจจุบัน (สด)')).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('uses the newest active event BPM when API events are out of order', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockImplementation(() => new Date('2026-05-04T14:20:30.000Z').getTime());

    mockInitialEvents.push(
      {
        id: 'event-newest',
        elderId: 'elder-1',
        deviceId: 'device-1',
        fallStage: 'CONFIRMED',
        bpm: 88,
        timestamp: '2026-05-04T14:20:00.000Z',
        cancelledAt: null,
      },
      {
        id: 'event-oldest',
        elderId: 'elder-1',
        deviceId: 'device-1',
        fallStage: 'CONFIRMED',
        bpm: 70,
        timestamp: '2026-05-04T14:10:00.000Z',
        cancelledAt: null,
      },
      {
        id: 'event-middle',
        elderId: 'elder-1',
        deviceId: 'device-1',
        fallStage: 'CONFIRMED',
        bpm: 80,
        timestamp: '2026-05-04T14:15:00.000Z',
        cancelledAt: null,
      },
    );
    Object.assign(mockFallAlertState, {
      fallStatus: 'FALL',
      lastFallUpdate: new Date('2026-05-04T14:20:00.000Z'),
      activeFallEventId: 'event-newest',
    });
    Object.assign(mockSensorState, {
      isConnected: true,
      socketConnected: true,
      heartRate: 96,
      heartConfidence: 'high',
      lastHeartUpdate: new Date('2026-05-04T14:20:10.000Z'),
      lastStatusUpdate: new Date('2026-05-04T14:20:10.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: true,
          onlineStatus: 'ONLINE',
          lastOnline: '2026-05-04T14:20:10.000Z',
        },
      },
    });

    try {
      const { getByText, queryByText } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByText('88')).toBeTruthy();
        expect(getByText('ชีพจรขณะหกล้ม')).toBeTruthy();
      });
      expect(queryByText('96')).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('ignores cancelled events and falls back to latest active event BPM', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockImplementation(() => new Date('2026-05-04T14:25:30.000Z').getTime());

    mockInitialEvents.push(
      {
        id: 'event-cancelled-newer',
        elderId: 'elder-1',
        deviceId: 'device-1',
        fallStage: 'CONFIRMED',
        bpm: 99,
        timestamp: '2026-05-04T14:25:00.000Z',
        cancelledAt: '2026-05-04T14:25:10.000Z',
      },
      {
        id: 'event-active-older',
        elderId: 'elder-1',
        deviceId: 'device-1',
        fallStage: 'CONFIRMED',
        bpm: 78,
        timestamp: '2026-05-04T14:22:00.000Z',
        cancelledAt: null,
      },
    );
    Object.assign(mockFallAlertState, {
      fallStatus: 'FALL',
      lastFallUpdate: new Date('2026-05-04T14:25:00.000Z'),
      activeFallEventId: 'event-active-older',
    });
    Object.assign(mockSensorState, {
      isConnected: true,
      socketConnected: true,
      heartRate: 95,
      heartConfidence: 'high',
      lastHeartUpdate: new Date('2026-05-04T14:25:10.000Z'),
      lastStatusUpdate: new Date('2026-05-04T14:25:10.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: true,
          onlineStatus: 'ONLINE',
          lastOnline: '2026-05-04T14:25:10.000Z',
        },
      },
    });

    try {
      const { getByText, queryByText } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByText('78')).toBeTruthy();
      });
      expect(queryByText('99')).toBeNull();
      expect(queryByText('95')).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('matches heart BPM to the displayed fall event timestamp', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockImplementation(() => new Date('2026-05-04T14:30:30.000Z').getTime());

    mockInitialEvents.push(
      {
        id: 'event-newest',
        elderId: 'elder-1',
        deviceId: 'device-1',
        fallStage: 'CONFIRMED',
        bpm: 92,
        timestamp: '2026-05-04T14:30:00.000Z',
        cancelledAt: null,
      },
      {
        id: 'event-displayed',
        elderId: 'elder-1',
        deviceId: 'device-1',
        fallStage: 'CONFIRMED',
        bpm: 74,
        timestamp: '2026-05-04T14:26:00.000Z',
        cancelledAt: null,
      },
    );
    Object.assign(mockFallAlertState, {
      fallStatus: 'FALL',
      // จงใจให้เวลาที่การ์ดแสดงอยู่ชี้ไปเหตุ event-displayed
      lastFallUpdate: new Date('2026-05-04T14:26:00.000Z'),
      activeFallEventId: 'event-displayed',
    });
    Object.assign(mockSensorState, {
      isConnected: true,
      socketConnected: true,
      heartRate: 98,
      heartConfidence: 'high',
      lastHeartUpdate: new Date('2026-05-04T14:30:10.000Z'),
      lastStatusUpdate: new Date('2026-05-04T14:30:10.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: true,
          onlineStatus: 'ONLINE',
          lastOnline: '2026-05-04T14:30:10.000Z',
        },
      },
    });

    try {
      const { getByText, queryByText } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByText('74')).toBeTruthy();
        expect(getByText('ชีพจรขณะหกล้ม')).toBeTruthy();
      });
      expect(queryByText('92')).toBeNull();
      expect(queryByText('98')).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('clears stale fall store state when initial history is empty', async () => {
    mockInitialEvents.length = 0;
    Object.assign(mockFallAlertState, {
      fallStatus: 'NORMAL',
      lastFallUpdate: new Date('2026-05-04T14:26:00.000Z'),
      activeFallEventId: 'stale-event-id',
    });
    Object.assign(mockSensorState, {
      isConnected: false,
      socketConnected: true,
      heartRate: null,
      heartConfidence: null,
      lastHeartUpdate: null,
      lastStatusUpdate: new Date('2026-05-04T14:30:10.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: false,
          onlineStatus: 'OFFLINE',
          lastOnline: '2026-05-04T14:30:10.000Z',
        },
      },
    });

    renderWithProviders(<DashboardScreen />);

    await waitFor(() => {
      expect(mockFallAlertState.setFallStatus).toHaveBeenCalledWith('NORMAL');
      expect(mockFallAlertState.setLastFallUpdate).toHaveBeenCalledWith(null);
      expect(mockFallAlertState.setActiveFallEventId).toHaveBeenCalledWith(null);
    });
  });

  it('does not show live heart rate in fall context when event bpm is missing', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockImplementation(() => new Date('2026-05-04T15:00:30.000Z').getTime());

    mockInitialEvents.push({
      id: 'event-no-bpm',
      elderId: 'elder-1',
      deviceId: 'device-1',
      fallStage: 'CONFIRMED',
      bpm: null,
      timestamp: '2026-05-04T15:00:00.000Z',
      cancelledAt: null,
    });
    Object.assign(mockFallAlertState, {
      fallStatus: 'FALL',
      lastFallUpdate: new Date('2026-05-04T15:00:00.000Z'),
      activeFallEventId: 'event-no-bpm',
    });
    Object.assign(mockSensorState, {
      isConnected: true,
      socketConnected: true,
      heartRate: 99,
      heartConfidence: 'high',
      lastHeartUpdate: new Date('2026-05-04T15:00:10.000Z'),
      lastStatusUpdate: new Date('2026-05-04T15:00:10.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: true,
          onlineStatus: 'ONLINE',
          lastOnline: '2026-05-04T15:00:10.000Z',
        },
      },
    });

    try {
      const { getByText, queryByText } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByText('ไม่มีข้อมูลชีพจรขณะล้ม')).toBeTruthy();
      });
      expect(queryByText('ชีพจรปัจจุบัน (สด)')).toBeNull();
      expect(queryByText('99')).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('does not temporarily use older event bpm when active event id is not yet in history', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockImplementation(() => new Date('2026-05-04T15:10:30.000Z').getTime());

    mockInitialEvents.push({
      id: 'event-older',
      elderId: 'elder-1',
      deviceId: 'device-1',
      fallStage: 'CONFIRMED',
      bpm: 74,
      timestamp: '2026-05-04T15:09:00.000Z',
      cancelledAt: null,
    });
    Object.assign(mockFallAlertState, {
      fallStatus: 'FALL',
      lastFallUpdate: new Date('2026-05-04T15:10:00.000Z'),
      activeFallEventId: 'event-new-pending-sync',
      activeFallBpm: undefined,
    });
    Object.assign(mockSensorState, {
      isConnected: true,
      socketConnected: true,
      heartRate: 71,
      heartConfidence: 'high',
      lastHeartUpdate: new Date('2026-05-04T15:10:10.000Z'),
      lastStatusUpdate: new Date('2026-05-04T15:10:10.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: true,
          onlineStatus: 'ONLINE',
          lastOnline: '2026-05-04T15:10:10.000Z',
        },
      },
    });

    try {
      const { getByText, queryByText } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByText('กำลังประมวลผลเหตุการณ์...')).toBeTruthy();
      });
      expect(queryByText('74')).toBeNull();
      expect(queryByText('71')).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('uses active fall BPM from realtime notification while event history is syncing', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockImplementation(() => new Date('2026-05-04T15:20:30.000Z').getTime());

    mockInitialEvents.push({
      id: 'event-older',
      elderId: 'elder-1',
      deviceId: 'device-1',
      fallStage: 'CONFIRMED',
      bpm: 74,
      timestamp: '2026-05-04T15:19:00.000Z',
      cancelledAt: null,
    });
    Object.assign(mockFallAlertState, {
      fallStatus: 'FALL',
      lastFallUpdate: new Date('2026-05-04T15:20:00.000Z'),
      activeFallEventId: 'event-new-pending-sync',
      activeFallBpm: 103,
    });
    Object.assign(mockSensorState, {
      isConnected: true,
      socketConnected: true,
      heartRate: 71,
      heartConfidence: 'high',
      lastHeartUpdate: new Date('2026-05-04T15:20:10.000Z'),
      lastStatusUpdate: new Date('2026-05-04T15:20:10.000Z'),
    });
    mockedUseCurrentElder.mockReturnValue({
      isLoading: false,
      refetch: jest.fn(),
      data: {
        ...mockElder,
        device: {
          ...mockElder.device,
          isOnline: true,
          onlineStatus: 'ONLINE',
          lastOnline: '2026-05-04T15:20:10.000Z',
        },
      },
    });

    try {
      const { getByText, queryByText } = renderWithProviders(<DashboardScreen />);

      await waitFor(() => {
        expect(getByText('103')).toBeTruthy();
        expect(getByText('ชีพจรขณะหกล้ม')).toBeTruthy();
      });
      expect(queryByText('กำลังประมวลผลเหตุการณ์...')).toBeNull();
      expect(queryByText('74')).toBeNull();
      expect(queryByText('71')).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });
});
