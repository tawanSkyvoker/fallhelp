/**
 * useHomeDisplayState Hook Tests
 * Tests: dashboard display logic based on device/elder state
 */
import { act, renderHook } from '@testing-library/react-native';

import { useHomeDisplayState } from '../../hooks/useHomeDisplayState';
import type { Elder, Event } from '../../services/types';

type Params = Parameters<typeof useHomeDisplayState>[0];

const NOW = new Date('2026-05-04T04:00:00.000Z').getTime();
const FALL_EVENT_ID = 'event-1';

const elderWithDevice: Elder = {
  id: 'elder-1',
  firstName: 'ดี',
  lastName: 'ใจ',
  device: {
    id: 'device-1',
    deviceCode: '1D83C229',
    serialNumber: 'ESP32-TEST',
    isOnline: true,
    lastOnline: new Date(NOW).toISOString(),
  },
};

const secondElderWithDevice: Elder = {
  id: 'elder-2',
  firstName: 'ใหม่',
  lastName: 'คนที่สอง',
  device: {
    id: 'device-2',
    deviceCode: '2D83C229',
    serialNumber: 'ESP32-TEST-2',
    isOnline: false,
    onlineStatus: 'OFFLINE',
    lastOnline: new Date(NOW).toISOString(),
  },
};

const confirmedFallEvent: Event = {
  id: FALL_EVENT_ID,
  elderId: 'elder-1',
  deviceId: 'device-1',
  fallStage: 'CONFIRMED',
  bpm: 86,
  timestamp: new Date(NOW).toISOString(),
};

const createParams = (overrides: Partial<Params> = {}): Params => ({
  now: NOW,
  isTransitioning: false,
  elderInfo: elderWithDevice,
  stableElderInfo: elderWithDevice,
  stableSignals: null,
  isConnected: true,
  socketConnected: true,
  fallStatus: 'FALL',
  lastFallUpdate: new Date(NOW),
  heartRate: 86,
  heartConfidence: 'high',
  lastHeartUpdate: new Date(NOW),
  lastStatusUpdate: new Date(NOW),
  manualAcknowledgedAt: null,
  activeFallEventId: FALL_EVENT_ID,
  initialEvents: [confirmedFallEvent],
  hasFetchedInitialEvents: true,
  firstSocketConnectedAt: NOW - 10_000,
  screenEnterAt: NOW - 20_000,
  ...overrides,
});

describe('useHomeDisplayState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears the emergency event card immediately after caregiver acknowledgement', () => {
    const { result, rerender } = renderHook((props: Params) => useHomeDisplayState(props), {
      initialProps: createParams(),
    });

    expect(result.current.shouldShowFallAlert).toBe(true);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const acknowledgedAt = new Date(NOW + 1000);

    rerender(
      createParams({
        fallStatus: 'NORMAL',
        lastFallUpdate: acknowledgedAt,
        manualAcknowledgedAt: acknowledgedAt,
        activeFallEventId: null,
      }),
    );

    expect(result.current.shouldShowFallAlert).toBe(false);
    expect(result.current.fallDisplayLabel).toBe('ปกติ');
  });

  it('uses acknowledgement time immediately for the normal status timestamp', () => {
    const acknowledgedAt = new Date(NOW + 22 * 60 * 1000);
    const staleDeviceOnlineAt = new Date(NOW + 30_000);

    const { result } = renderHook((props: Params) => useHomeDisplayState(props), {
      initialProps: createParams({
        now: acknowledgedAt.getTime(),
        fallStatus: 'NORMAL',
        lastFallUpdate: acknowledgedAt,
        manualAcknowledgedAt: acknowledgedAt,
        activeFallEventId: null,
        initialEvents: [confirmedFallEvent],
        elderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: true,
            onlineStatus: 'ONLINE',
            lastOnline: staleDeviceOnlineAt.toISOString(),
          },
        },
        stableElderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: true,
            onlineStatus: 'ONLINE',
            lastOnline: staleDeviceOnlineAt.toISOString(),
          },
        },
      }),
    });

    expect(result.current.shouldShowFallAlert).toBe(false);
    expect(result.current.fallDisplayLabel).toBe('ปกติ');
    expect(result.current.stableLastUpdatedAt?.getTime()).toBe(acknowledgedAt.getTime());
  });

  it('keeps showing the latest confirmed event as previous history when acknowledged and offline', () => {
    const eventTime = new Date('2026-05-04T11:43:00.000Z');
    const acknowledgedAt = new Date('2026-05-04T12:08:00.000Z');
    const offlineNow = acknowledgedAt.getTime();
    const event: Event = {
      ...confirmedFallEvent,
      timestamp: eventTime.toISOString(),
    };

    const { result } = renderHook((props: Params) => useHomeDisplayState(props), {
      initialProps: createParams({
        now: offlineNow,
        isConnected: false,
        fallStatus: 'NORMAL',
        lastFallUpdate: acknowledgedAt,
        lastHeartUpdate: null,
        lastStatusUpdate: null,
        manualAcknowledgedAt: acknowledgedAt,
        activeFallEventId: null,
        initialEvents: [event],
        elderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: false,
            onlineStatus: 'OFFLINE',
          },
        },
        stableElderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: false,
            onlineStatus: 'OFFLINE',
          },
        },
      }),
    });

    expect(result.current.shouldShowFallAlert).toBe(false);
    expect(result.current.shouldShowStaleFall).toBe(true);
    expect(result.current.shouldShowFallDetailAction).toBe(true);
    expect(result.current.fallDisplayLabel).toBe('เหตุการณ์ที่ผ่านมา');
    expect(result.current.lastUpdatedAt?.getTime()).toBe(eventTime.getTime());
  });

  it('does not reuse stale snapshot when fetched history confirms no event', () => {
    const staleFallTime = new Date('2026-05-04T11:43:00.000Z');
    const nowAfterStale = staleFallTime.getTime() + 30 * 60 * 1000;
    const staleEvent: Event = {
      ...confirmedFallEvent,
      timestamp: staleFallTime.toISOString(),
    };

    const { result, rerender } = renderHook((props: Params) => useHomeDisplayState(props), {
      initialProps: createParams({
        now: nowAfterStale,
        isConnected: false,
        fallStatus: 'NORMAL',
        lastFallUpdate: staleFallTime,
        lastHeartUpdate: null,
        lastStatusUpdate: null,
        activeFallEventId: null,
        initialEvents: [staleEvent],
        elderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: false,
            onlineStatus: 'OFFLINE',
          },
        },
        stableElderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: false,
            onlineStatus: 'OFFLINE',
          },
        },
      }),
    });

    expect(result.current.shouldShowStaleFall).toBe(true);
    expect(result.current.fallDisplayLabel).toBe('เหตุการณ์ที่ผ่านมา');

    act(() => {
      jest.runOnlyPendingTimers();
    });

    rerender(
      createParams({
        now: nowAfterStale + 60_000,
        isConnected: false,
        fallStatus: 'NORMAL',
        lastFallUpdate: staleFallTime,
        lastHeartUpdate: null,
        lastStatusUpdate: null,
        activeFallEventId: null,
        initialEvents: [],
        hasFetchedInitialEvents: true,
        elderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: false,
            onlineStatus: 'OFFLINE',
          },
        },
        stableElderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: false,
            onlineStatus: 'OFFLINE',
          },
        },
      }),
    );

    expect(result.current.shouldShowStaleFall).toBe(false);
    expect(result.current.shouldShowFallAlert).toBe(false);
    expect(result.current.fallDisplayLabel).toBe('ยังไม่มีข้อมูลเหตุการณ์');
  });

  it('resets stale event snapshot when elder/device context changes', () => {
    const staleEventTime = new Date('2026-05-04T11:43:00.000Z');
    const nowAfterStale = staleEventTime.getTime() + 30 * 60 * 1000;
    const staleEvent: Event = {
      ...confirmedFallEvent,
      timestamp: staleEventTime.toISOString(),
    };

    const { result, rerender } = renderHook((props: Params) => useHomeDisplayState(props), {
      initialProps: createParams({
        now: nowAfterStale,
        isConnected: false,
        fallStatus: 'NORMAL',
        lastFallUpdate: staleEventTime,
        lastHeartUpdate: null,
        lastStatusUpdate: null,
        activeFallEventId: null,
        initialEvents: [staleEvent],
        elderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: false,
            onlineStatus: 'OFFLINE',
          },
        },
        stableElderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: false,
            onlineStatus: 'OFFLINE',
          },
        },
      }),
    });

    expect(result.current.shouldShowStaleFall).toBe(true);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    rerender(
      createParams({
        now: nowAfterStale + 60_000,
        elderInfo: secondElderWithDevice,
        stableElderInfo: secondElderWithDevice,
        isConnected: false,
        fallStatus: 'NORMAL',
        lastFallUpdate: null,
        heartRate: null,
        heartConfidence: 'none',
        lastHeartUpdate: null,
        lastStatusUpdate: null,
        activeFallEventId: null,
        initialEvents: [],
        hasFetchedInitialEvents: true,
      }),
    );

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(result.current.shouldShowStaleFall).toBe(false);
    expect(result.current.shouldShowFallAlert).toBe(false);
    expect(result.current.fallDisplayLabel).toBe('ยังไม่มีข้อมูลเหตุการณ์');
  });

  it('prefers API no-event truth over stale local fall state', () => {
    const staleFallTime = new Date('2026-05-04T11:43:00.000Z');
    const nowAfterStale = staleFallTime.getTime() + 30 * 60 * 1000;

    const { result } = renderHook((props: Params) => useHomeDisplayState(props), {
      initialProps: createParams({
        now: nowAfterStale,
        isConnected: false,
        fallStatus: 'FALL',
        lastFallUpdate: staleFallTime,
        lastHeartUpdate: null,
        lastStatusUpdate: null,
        activeFallEventId: null,
        initialEvents: [],
        hasFetchedInitialEvents: true,
        elderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: false,
            onlineStatus: 'OFFLINE',
          },
        },
        stableElderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: false,
            onlineStatus: 'OFFLINE',
          },
        },
      }),
    });

    expect(result.current.shouldShowFallAlert).toBe(false);
    expect(result.current.shouldShowStaleFall).toBe(false);
    expect(result.current.fallDisplayLabel).toBe('ยังไม่มีข้อมูลเหตุการณ์');
  });

  it('keeps fall alert visible during transient connecting while fall is active', () => {
    const fallNow = new Date('2026-05-04T16:40:57.680Z');

    const { result } = renderHook((props: Params) => useHomeDisplayState(props), {
      initialProps: createParams({
        now: fallNow.getTime(),
        isConnected: false,
        socketConnected: true,
        fallStatus: 'FALL',
        lastFallUpdate: fallNow,
        activeFallEventId: FALL_EVENT_ID,
        initialEvents: [
          {
            ...confirmedFallEvent,
            timestamp: fallNow.toISOString(),
          },
        ],
        hasFetchedInitialEvents: true,
        firstSocketConnectedAt: fallNow.getTime() - 4_000,
        screenEnterAt: fallNow.getTime() - 2_000,
      }),
    });

    expect(result.current.shouldShowConnecting).toBe(true);
    expect(result.current.shouldShowFallAlert).toBe(true);
    expect(result.current.fallDisplayLabel).toBe('ตรวจพบการหกล้ม');
  });

  it('uses fresh API lastOnline as fallback when socket is unavailable', () => {
    const { result } = renderHook((props: Params) => useHomeDisplayState(props), {
      initialProps: createParams({
        isConnected: false,
        socketConnected: false,
        fallStatus: 'NORMAL',
        lastFallUpdate: null,
        activeFallEventId: null,
        heartRate: null,
        heartConfidence: null,
        // เคยมี realtime signal แล้ว แต่ socket หลุดเอง จึงต้องใช้ API lastOnline ช่วยตัดสิน
        lastHeartUpdate: new Date(NOW - 20_000),
        lastStatusUpdate: new Date(NOW - 20_000),
        initialEvents: [],
        elderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: true,
            onlineStatus: 'ONLINE',
            lastOnline: new Date(NOW - 2_000).toISOString(),
          },
        },
        stableElderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: true,
            onlineStatus: 'ONLINE',
            lastOnline: new Date(NOW - 2_000).toISOString(),
          },
        },
      }),
    });

    expect(result.current.isDeviceOnlineForDisplay).toBe(true);
    expect(result.current.shouldShowConnecting).toBe(false);
    expect(result.current.fallDisplayLabel).toBe('ปกติ');
  });

  it('does not let API fallback override explicit offline state while socket is connected', () => {
    const { result } = renderHook((props: Params) => useHomeDisplayState(props), {
      initialProps: createParams({
        isConnected: false,
        socketConnected: true,
        fallStatus: 'NORMAL',
        lastFallUpdate: null,
        activeFallEventId: null,
        heartRate: null,
        heartConfidence: null,
        lastHeartUpdate: new Date(NOW - 20_000),
        lastStatusUpdate: new Date(NOW - 20_000),
        initialEvents: [],
        elderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: true,
            onlineStatus: 'ONLINE',
            lastOnline: new Date(NOW - 2_000).toISOString(),
          },
        },
        stableElderInfo: {
          ...elderWithDevice,
          device: {
            ...elderWithDevice.device!,
            isOnline: true,
            onlineStatus: 'ONLINE',
            lastOnline: new Date(NOW - 2_000).toISOString(),
          },
        },
      }),
    });

    expect(result.current.isDeviceOnlineForDisplay).toBe(false);
  });
});
