/**
 * statusHandler IoT Tests
 * Tests: device online/offline MQTT status events
 *
 * หลัง refactor: mock ผ่าน deviceService
 * (findDeviceStatusContext, updateDeviceConnectivity, syncUnpairedDeviceOfflineState)
 * แทน prisma.device.findFirst/update โดยตรง
 */
import { DeviceStatusPayload } from '../../../iot/topics';

// Mock Device Service
const mockFindDeviceStatusContext = jest.fn();
const mockUpdateDeviceConnectivity = jest.fn();
const mockSyncUnpairedDeviceOfflineState = jest.fn();
jest.mock('../../../services/deviceService', () => ({
  findDeviceStatusContext: (...args: unknown[]) => mockFindDeviceStatusContext(...args),
  updateDeviceConnectivity: (...args: unknown[]) => mockUpdateDeviceConnectivity(...args),
  syncUnpairedDeviceOfflineState: (...args: unknown[]) =>
    mockSyncUnpairedDeviceOfflineState(...args),
}));

const mockEmitDeviceStatusUpdate = jest.fn();
jest.mock('../../../realtime/socketServer', () => ({
  socketServer: {
    emitDeviceStatusUpdate: mockEmitDeviceStatusUpdate,
  },
}));

const mockPublish = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../iot/mqttClient', () => ({
  mqttClient: {
    publish: mockPublish,
  },
}));

jest.mock('../../../iot/topics', () => ({
  MQTT_TOPICS: {
    getConfigTopic: jest.fn().mockReturnValue('device/ESP32-ABCDEF/config'),
  },
}));

jest.mock('debug', () => {
  const dummyFn = () => {};
  return {
    __esModule: true,
    default: () => dummyFn,
  };
});

import { statusHandler } from '../../../iot/handlers/statusHandler';

// ข้อมูล device ที่ใช้ร่วมกันในหลาย test suite
const PAIRED_DEVICE = {
  id: 'device-1',
  deviceCode: 'CODE1234',
  serialNumber: 'ESP32-ABCDEF',
  status: 'PAIRED' as const,
  wifiStatus: 'CONNECTED' as const,
  elderId: 'elder-1',
  elder: {
    id: 'elder-1',
    firstName: 'Test',
    lastName: 'User',
  },
};

const VALID_PAYLOAD: DeviceStatusPayload = {
  timestamp: Date.now(),
  online: true,
  signalStrength: -45,
  ip: '192.168.1.101',
};

describe('statusHandler wifi status updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindDeviceStatusContext.mockResolvedValue(PAIRED_DEVICE);
    mockUpdateDeviceConnectivity.mockResolvedValue(undefined);
    mockSyncUnpairedDeviceOfflineState.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue(undefined);
  });

  it('calls updateDeviceConnectivity with online=true when device reports online', async () => {
    const payload: DeviceStatusPayload = { ...VALID_PAYLOAD, online: true };

    await statusHandler('ESP32-ABCDEF', payload);

    expect(mockUpdateDeviceConnectivity).toHaveBeenCalledWith(
      'device-1',
      true,
      expect.any(Date),
      'CONNECTED',
    );
  });

  it('calls updateDeviceConnectivity with online=false when device reports offline', async () => {
    const payload: DeviceStatusPayload = { ...VALID_PAYLOAD, online: false };

    await statusHandler('ESP32-ABCDEF', payload);

    expect(mockUpdateDeviceConnectivity).toHaveBeenCalledWith(
      'device-1',
      false,
      expect.any(Date),
      'CONNECTED',
    );
  });

  it('passes currentWifiStatus=ERROR to updateDeviceConnectivity when device is in ERROR state', async () => {
    mockFindDeviceStatusContext.mockResolvedValue({
      ...PAIRED_DEVICE,
      wifiStatus: 'ERROR' as const,
    });

    await statusHandler('ESP32-ABCDEF', { ...VALID_PAYLOAD, online: false });

    // service รับ wifiStatus ปัจจุบันไปตัดสินใจเอง ว่าจะ update หรือ skip
    expect(mockUpdateDeviceConnectivity).toHaveBeenCalledWith(
      'device-1',
      false,
      expect.any(Date),
      'ERROR',
    );
  });
});

describe('statusHandler missing coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindDeviceStatusContext.mockResolvedValue(PAIRED_DEVICE);
    mockUpdateDeviceConnectivity.mockResolvedValue(undefined);
    mockSyncUnpairedDeviceOfflineState.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue(undefined);
  });

  it('returns early without service calls when payload is invalid', async () => {
    await statusHandler('ESP32-ABCDEF', null);

    expect(mockFindDeviceStatusContext).not.toHaveBeenCalled();
    expect(mockUpdateDeviceConnectivity).not.toHaveBeenCalled();
    expect(mockEmitDeviceStatusUpdate).not.toHaveBeenCalled();
  });

  it('returns early without service calls when payload is missing required fields', async () => {
    await statusHandler('ESP32-ABCDEF', { notAValidField: true });

    expect(mockFindDeviceStatusContext).not.toHaveBeenCalled();
    expect(mockUpdateDeviceConnectivity).not.toHaveBeenCalled();
    expect(mockEmitDeviceStatusUpdate).not.toHaveBeenCalled();
  });

  it('returns early without update calls when device is not found', async () => {
    mockFindDeviceStatusContext.mockResolvedValue(null);

    await statusHandler('ESP32-UNKNOWN', VALID_PAYLOAD);

    expect(mockFindDeviceStatusContext).toHaveBeenCalledWith('ESP32-UNKNOWN');
    expect(mockUpdateDeviceConnectivity).not.toHaveBeenCalled();
    expect(mockEmitDeviceStatusUpdate).not.toHaveBeenCalled();
  });

  it('sends RESET_NVS via mqttClient.publish when device is UNPAIRED', async () => {
    mockFindDeviceStatusContext.mockResolvedValue({
      ...PAIRED_DEVICE,
      status: 'UNPAIRED' as const,
      elderId: null,
      elder: null,
    });

    await statusHandler('ESP32-ABCDEF', VALID_PAYLOAD);

    // Let the void promise chain resolve
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockPublish).toHaveBeenCalledWith(
      'device/ESP32-ABCDEF/config',
      expect.objectContaining({
        action: 'RESET_NVS',
        reason: 'DEVICE_UNPAIRED',
        deviceSerial: 'ESP32-ABCDEF',
        requestId: expect.any(String),
      }),
      { retain: true },
    );
  });

  it('calls syncUnpairedDeviceOfflineState when device is UNPAIRED', async () => {
    mockFindDeviceStatusContext.mockResolvedValue({
      ...PAIRED_DEVICE,
      status: 'UNPAIRED' as const,
      elderId: null,
      elder: null,
    });

    await statusHandler('ESP32-ABCDEF', VALID_PAYLOAD);

    expect(mockSyncUnpairedDeviceOfflineState).toHaveBeenCalledWith('device-1');
  });

  it('does not call updateDeviceConnectivity when device is UNPAIRED', async () => {
    mockFindDeviceStatusContext.mockResolvedValue({
      ...PAIRED_DEVICE,
      status: 'UNPAIRED' as const,
      elderId: null,
      elder: null,
    });

    await statusHandler('ESP32-ABCDEF', VALID_PAYLOAD);

    expect(mockUpdateDeviceConnectivity).not.toHaveBeenCalled();
  });

  it('does NOT emit socket event when UNPAIRED device has no elder', async () => {
    mockFindDeviceStatusContext.mockResolvedValue({
      ...PAIRED_DEVICE,
      status: 'UNPAIRED' as const,
      elderId: null,
      elder: null,
    });

    await statusHandler('ESP32-ABCDEF', VALID_PAYLOAD);

    expect(mockEmitDeviceStatusUpdate).not.toHaveBeenCalled();
  });

  it('emits socket event with online=false when UNPAIRED device has an elder', async () => {
    mockFindDeviceStatusContext.mockResolvedValue({
      ...PAIRED_DEVICE,
      status: 'UNPAIRED' as const,
    });

    await statusHandler('ESP32-ABCDEF', VALID_PAYLOAD);

    expect(mockEmitDeviceStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
        elderId: 'elder-1',
        online: false,
      }),
    );
  });

  it('emits device_status_update after successful connectivity update for PAIRED device', async () => {
    await statusHandler('ESP32-ABCDEF', VALID_PAYLOAD);

    expect(mockEmitDeviceStatusUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-1',
        elderId: 'elder-1',
        online: true,
        source: 'mqtt_status_update',
      }),
    );
  });

  it('catches and silently handles errors thrown by findDeviceStatusContext', async () => {
    mockFindDeviceStatusContext.mockRejectedValue(new Error('DB connection error'));

    await expect(statusHandler('ESP32-ABCDEF', VALID_PAYLOAD)).resolves.toBeUndefined();

    expect(mockUpdateDeviceConnectivity).not.toHaveBeenCalled();
    expect(mockEmitDeviceStatusUpdate).not.toHaveBeenCalled();
  });
});

describe('statusHandler — RESET_NVS publish catch branch', () => {
  it('handles mqttClient.publish rejection gracefully (void promise — no rethrow)', async () => {
    jest.clearAllMocks();

    // UNPAIRED device with elder — triggers the void publish().then().catch() chain
    mockFindDeviceStatusContext.mockResolvedValue({
      ...PAIRED_DEVICE,
      status: 'UNPAIRED' as const,
    });
    mockSyncUnpairedDeviceOfflineState.mockResolvedValue(undefined);

    // Make publish REJECT to trigger the .catch() handler
    mockPublish.mockRejectedValue(new Error('Broker connection lost'));

    await statusHandler('ESP32-ABCDEF', VALID_PAYLOAD);

    // Give the void promise chain time to settle
    await new Promise((resolve) => setImmediate(resolve));

    // publish was attempted
    expect(mockPublish).toHaveBeenCalled();
    // syncUnpairedDeviceOfflineState ยังทำงานได้ปกติ (ไม่ throw จาก publish)
    expect(mockSyncUnpairedDeviceOfflineState).toHaveBeenCalled();
  });
});
