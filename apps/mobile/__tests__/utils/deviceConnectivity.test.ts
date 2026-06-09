/**
 * deviceConnectivity Utility Tests (Mobile)
 * Tests: device connection status mapping and signal strength display
 */
import {
  DEVICE_ONLINE_FRESHNESS_MS,
  getEffectiveDeviceOnline,
  getOptimisticOnlineFromApi,
  hasRealtimeDeviceSignal,
  isDeviceMarkedOnlineByApi,
  parseDeviceTimestamp,
} from '../../utils/deviceConnectivity';

describe('deviceConnectivity', () => {
  const now = Date.parse('2026-04-28T09:00:00.000Z');

  it('keeps API freshness aligned with fast offline display', () => {
    expect(DEVICE_ONLINE_FRESHNESS_MS).toBe(15 * 1000);
  });

  it('parses valid device timestamps safely', () => {
    expect(parseDeviceTimestamp('2026-04-28T08:59:50.000Z')?.toISOString()).toBe(
      '2026-04-28T08:59:50.000Z',
    );
    expect(parseDeviceTimestamp('invalid')).toBeNull();
  });

  it('detects API online state from either online flag', () => {
    expect(
      isDeviceMarkedOnlineByApi({ isOnline: true, onlineStatus: 'OFFLINE', lastOnline: null }),
    ).toBe(true);
    expect(
      isDeviceMarkedOnlineByApi({ isOnline: false, onlineStatus: 'ONLINE', lastOnline: null }),
    ).toBe(true);
    expect(
      isDeviceMarkedOnlineByApi({ isOnline: false, onlineStatus: 'OFFLINE', lastOnline: null }),
    ).toBe(false);
  });

  it('only uses optimistic API online when lastOnline is still fresh and no realtime signal exists', () => {
    const freshDevice = {
      isOnline: true,
      onlineStatus: 'ONLINE' as const,
      lastOnline: new Date(now - (DEVICE_ONLINE_FRESHNESS_MS - 1000)).toISOString(),
    };
    const staleDevice = {
      ...freshDevice,
      lastOnline: new Date(now - (DEVICE_ONLINE_FRESHNESS_MS + 1000)).toISOString(),
    };

    expect(
      getOptimisticOnlineFromApi({
        device: freshDevice,
        now,
        hasRealtimeSignal: false,
      }),
    ).toBe(true);
    expect(
      getOptimisticOnlineFromApi({
        device: staleDevice,
        now,
        hasRealtimeSignal: false,
      }),
    ).toBe(false);
    expect(
      getOptimisticOnlineFromApi({
        device: freshDevice,
        now,
        hasRealtimeSignal: true,
      }),
    ).toBe(false);
  });

  it('prefers realtime state over API fallback once socket is active', () => {
    const device = {
      isOnline: true,
      onlineStatus: 'ONLINE' as const,
      lastOnline: new Date(now).toISOString(),
    };

    expect(
      getEffectiveDeviceOnline({
        device,
        now,
        realtimeConnected: true,
        socketConnected: true,
        hasRealtimeSignal: true,
      }),
    ).toBe(true);
    expect(
      getEffectiveDeviceOnline({
        device,
        now,
        realtimeConnected: false,
        socketConnected: true,
        hasRealtimeSignal: true,
      }),
    ).toBe(false);
    expect(
      getEffectiveDeviceOnline({
        device,
        now,
        realtimeConnected: false,
        socketConnected: false,
        hasRealtimeSignal: false,
      }),
    ).toBe(true);
  });

  it('treats either heart or status updates as realtime device signals', () => {
    expect(hasRealtimeDeviceSignal({ lastHeartUpdate: new Date(), lastStatusUpdate: null })).toBe(
      true,
    );
    expect(hasRealtimeDeviceSignal({ lastHeartUpdate: null, lastStatusUpdate: new Date() })).toBe(
      true,
    );
    expect(hasRealtimeDeviceSignal({ lastHeartUpdate: null, lastStatusUpdate: null })).toBe(false);
  });
});
