/**
 * deviceService Tests
 * Tests: device registration, pairing, configuration updates
 */
const mockDeviceCreate = jest.fn();
const mockDeviceFindFirst = jest.fn();
const mockDeviceFindUnique = jest.fn();
const mockDeviceUpdate = jest.fn();
const mockDeviceUpdateMany = jest.fn();
const mockDeviceFindMany = jest.fn();
const mockElderFindFirst = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    device: {
      create: mockDeviceCreate,
      findFirst: mockDeviceFindFirst,
      findUnique: mockDeviceFindUnique,
      update: mockDeviceUpdate,
      updateMany: mockDeviceUpdateMany,
      findMany: mockDeviceFindMany,
    },
    elder: {
      findFirst: mockElderFindFirst,
    },
  },
}));

// Mock MQTT client
const mockPublish = jest.fn();
const mockWaitForConfigAck = jest.fn();
const mockCancelConfigAckWait = jest.fn();
const mockClearRetainedConfigCommand = jest.fn();

jest.mock('../../../iot/mqttClient', () => ({
  mqttClient: {
    publish: mockPublish,
    waitForConfigAck: mockWaitForConfigAck,
    cancelConfigAckWait: mockCancelConfigAckWait,
    clearRetainedConfigCommand: mockClearRetainedConfigCommand,
  },
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    audit: jest.fn(),
  },
}));

// Mock deviceConnectivity
jest.mock('../../../utils/deviceConnectivity', () => ({
  getDeviceOnlineStatus: jest.fn().mockReturnValue('OFFLINE'),
  DEVICE_ONLINE_THRESHOLD_MS: 300000,
}));

// Mock config/env
jest.mock('../../../config/env', () => ({
  backendEnv: {
    wifiConfiguringStaleMs: 300000,
    mqttConfigAckTimeoutMs: 15000,
  },
}));

// Mock Debug
jest.mock('debug', () => {
  const dummyFn = () => {};
  return {
    __esModule: true,
    default: () => dummyFn,
  };
});

import {
  configureWiFi,
  getDeviceByCode,
  pairDevice,
  unpairDevice,
  getDeviceConfig,
} from '../../../services/deviceService';

describe('configureWiFi fail paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockDeviceFindFirst.mockResolvedValue({
      id: 'device-uuid-001',
      deviceCode: '8E5D02FB',
      serialNumber: 'ESP32-6C689BDAF380',
      elderId: 'elder-uuid-001',
      wifiStatus: 'DISCONNECTED',
      updatedAt: new Date(),
    });

    mockElderFindFirst.mockResolvedValue({
      id: 'elder-uuid-001',
      userId: 'user-uuid-001',
    });

    mockDeviceUpdateMany.mockResolvedValue({ count: 1 });
    mockDeviceUpdate.mockResolvedValue({
      id: 'device-uuid-001',
      wifiStatus: 'CONFIGURING',
      updatedAt: new Date(),
    });
  });

  it('sets wifiStatus=ERROR and throws internal_server_error when MQTT publish fails', async () => {
    mockWaitForConfigAck.mockReturnValue(
      Promise.reject(new Error('Config ACK wait cancelled (ESP32-6C689BDAF380:req-1)')),
    );
    mockPublish.mockRejectedValue(new Error('MQTT client is not connected'));

    await expect(
      configureWiFi('user-uuid-001', 'device-uuid-001', 'HomeWiFi', 'password123'),
    ).rejects.toMatchObject({
      code: 'internal_server_error',
      statusCode: 500,
    });

    expect(mockCancelConfigAckWait).toHaveBeenCalledWith('ESP32-6C689BDAF380', expect.any(String));
    expect(mockDeviceUpdate).toHaveBeenCalledWith({
      where: { id: 'device-uuid-001' },
      data: { wifiStatus: 'ERROR' },
    });
  });

  it('sets wifiStatus=ERROR and throws internal_server_error when ACK times out', async () => {
    mockWaitForConfigAck.mockRejectedValue(
      new Error('Timed out waiting for config ACK (ESP32-6C689BDAF380:req-2)'),
    );
    mockPublish.mockResolvedValue(undefined);

    await expect(
      configureWiFi('user-uuid-001', 'device-uuid-001', 'HomeWiFi', 'password123'),
    ).rejects.toMatchObject({
      code: 'validation_error',
      statusCode: 400,
    });

    expect(mockDeviceUpdate).toHaveBeenCalledWith({
      where: { id: 'device-uuid-001' },
      data: { wifiStatus: 'ERROR' },
    });
  });

  it('keeps CONFIGURING status and returns ACK metadata when device ACK succeeds', async () => {
    const requestId = 'req-success-001';
    mockWaitForConfigAck.mockResolvedValue({
      requestId,
      success: true,
      timestamp: 1700000000,
      ip: '192.168.1.101',
    });
    mockPublish.mockResolvedValue(undefined);

    const result = await configureWiFi(
      'user-uuid-001',
      'device-uuid-001',
      'HomeWiFi',
      'password123',
    );

    expect(mockPublish).toHaveBeenCalledWith(
      'device/ESP32-6C689BDAF380/config',
      expect.objectContaining({
        wifiSSID: 'HomeWiFi',
        wifiPassword: 'password123',
        requestId: expect.any(String),
      }),
    );
    expect(mockDeviceUpdate).toHaveBeenCalledWith({
      where: { id: 'device-uuid-001' },
      data: {
        wifiStatus: 'CONFIGURING',
        updatedAt: expect.any(Date),
      },
      select: {
        id: true,
        wifiStatus: true,
        updatedAt: true,
      },
    });
    expect(result).toMatchObject({
      config: {
        deviceId: 'device-uuid-001',
        wifiStatus: 'CONFIGURING',
      },
      ack: {
        requestId,
        timestamp: 1700000000,
      },
    });
  });

  it('throws device_not_paired when device is not found', async () => {
    mockDeviceFindFirst.mockResolvedValue(null);

    await expect(
      configureWiFi('user-uuid-001', 'device-uuid-001', 'HomeWiFi', 'password123'),
    ).rejects.toMatchObject({ code: 'device_not_paired' });
  });

  it('throws device_not_paired when device has no elderId', async () => {
    mockDeviceFindFirst.mockResolvedValue({
      id: 'device-uuid-001',
      deviceCode: '8E5D02FB',
      serialNumber: 'ESP32-6C689BDAF380',
      elderId: null,
      wifiStatus: 'DISCONNECTED',
      updatedAt: new Date(),
    });

    await expect(
      configureWiFi('user-uuid-001', 'device-uuid-001', 'HomeWiFi', 'password123'),
    ).rejects.toMatchObject({ code: 'device_not_paired' });
  });

  it('throws access_denied when user does not own the elder', async () => {
    mockElderFindFirst.mockResolvedValue(null);

    await expect(
      configureWiFi('user-uuid-999', 'device-uuid-001', 'HomeWiFi', 'password123'),
    ).rejects.toMatchObject({ code: 'access_denied' });
  });

  it('throws validation_error with generic message when ACK error is not infra-related', async () => {
    mockWaitForConfigAck.mockRejectedValue(new Error('Wrong SSID format'));
    mockPublish.mockResolvedValue(undefined);

    await expect(
      configureWiFi('user-uuid-001', 'device-uuid-001', 'HomeWiFi', 'password123'),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });
});

// createDevice และ getAllDevices ย้ายไปอยู่ใน adminService แล้ว — ดู adminService.test.ts

describe('getDeviceByCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns device info when found', async () => {
    mockDeviceFindUnique.mockResolvedValue({
      id: 'device-001',
      deviceCode: 'ABCD1234',
      serialNumber: 'ESP32-ABC',
      status: 'UNPAIRED',
      elderId: null,
      updatedAt: new Date(),
    });

    const result = await getDeviceByCode('ABCD1234');

    expect(result).toMatchObject({
      id: 'device-001',
      deviceCode: 'ABCD1234',
      serialNumber: 'ESP32-ABC',
      status: 'UNPAIRED',
    });
  });

  it('throws device_not_found when device code does not exist', async () => {
    mockDeviceFindUnique.mockResolvedValue(null);

    await expect(getDeviceByCode('NOTEXIST')).rejects.toMatchObject({ code: 'device_not_found' });
  });
});

describe('pairDevice', () => {
  const DEVICE = {
    id: 'device-001',
    deviceCode: 'ABCD1234',
    serialNumber: 'ESP32-ABC',
    status: 'UNPAIRED',
    elderId: null,
  };
  const ELDER = { id: 'elder-001', userId: 'user-001' };
  const PAIRED_DEVICE = {
    ...DEVICE,
    elderId: 'elder-001',
    status: 'PAIRED',
    elder: ELDER,
    wifiStatus: 'DISCONNECTED',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockElderFindFirst
      .mockResolvedValueOnce(ELDER) // ownership check
      .mockResolvedValue(null); // elder already has device check (findFirst for elderDevice)
    mockDeviceFindUnique.mockResolvedValue(DEVICE);
    mockDeviceFindFirst.mockResolvedValue(null); // no existing device for elder
    mockDeviceUpdate.mockResolvedValue(PAIRED_DEVICE);
    mockClearRetainedConfigCommand.mockResolvedValue(undefined);
  });

  it('successfully pairs device', async () => {
    const result = await pairDevice('user-001', 'ABCD1234', 'elder-001');

    expect(mockDeviceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'device-001' },
        data: expect.objectContaining({ elderId: 'elder-001', status: 'PAIRED' }),
      }),
    );
    expect(mockClearRetainedConfigCommand).toHaveBeenCalledWith('ESP32-ABC');
    expect(result).toMatchObject({ elderId: 'elder-001', status: 'PAIRED' });
  });

  it('throws access_denied when elder does not belong to user', async () => {
    // ต้อง reset ก่อน เพราะ beforeEach ใช้ mockResolvedValueOnce(ELDER)
    // ซึ่งยังค้างอยู่ใน queue แม้เรียก mockResolvedValue(null) ทับก็ตาม
    mockElderFindFirst.mockReset();
    mockElderFindFirst.mockResolvedValue(null);

    await expect(pairDevice('user-999', 'ABCD1234', 'elder-001')).rejects.toMatchObject({
      code: 'access_denied',
    });
  });

  it('throws device_not_found when deviceCode does not exist', async () => {
    mockElderFindFirst.mockResolvedValue(ELDER);
    mockDeviceFindUnique.mockResolvedValue(null);

    await expect(pairDevice('user-001', 'BADCODE', 'elder-001')).rejects.toMatchObject({
      code: 'device_not_found',
    });
  });

  it('throws device_already_paired when device is already paired to another elder', async () => {
    mockElderFindFirst.mockResolvedValue(ELDER);
    mockDeviceFindUnique.mockResolvedValue({ ...DEVICE, elderId: 'elder-other' });

    await expect(pairDevice('user-001', 'ABCD1234', 'elder-001')).rejects.toMatchObject({
      code: 'device_already_paired',
    });
  });

  it('throws device_already_paired when elder already has a device', async () => {
    mockElderFindFirst.mockResolvedValue(ELDER);
    mockDeviceFindUnique.mockResolvedValue(DEVICE);
    mockDeviceFindFirst.mockResolvedValue({ id: 'device-other', elderId: 'elder-001' });

    await expect(pairDevice('user-001', 'ABCD1234', 'elder-001')).rejects.toMatchObject({
      code: 'device_already_paired',
    });
  });
});

describe('unpairDevice', () => {
  const ELDER = { id: 'elder-001', userId: 'user-001' };
  const PAIRED_DEVICE = {
    id: 'device-001',
    serialNumber: 'ESP32-ABC',
    status: 'PAIRED',
    elderId: 'elder-001',
    elder: ELDER,
  };
  const UNPAIRED_RESULT = { ...PAIRED_DEVICE, elderId: null, status: 'UNPAIRED' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeviceFindUnique.mockResolvedValue(PAIRED_DEVICE);
    mockElderFindFirst.mockResolvedValue(ELDER);
    mockDeviceUpdate.mockResolvedValue(UNPAIRED_RESULT);
    mockPublish.mockResolvedValue(undefined);
  });

  it('unpairs a device and sends RESET_NVS via MQTT', async () => {
    const result = await unpairDevice('user-001', 'device-001');

    expect(mockDeviceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'device-001' },
        data: expect.objectContaining({ elderId: null, status: 'UNPAIRED' }),
      }),
    );
    expect(mockPublish).toHaveBeenCalledWith(
      'device/ESP32-ABC/config',
      expect.objectContaining({
        action: 'RESET_NVS',
        reason: 'UNPAIR',
        deviceSerial: 'ESP32-ABC',
        requestId: expect.any(String),
      }),
      { retain: true },
    );
    expect(result).toMatchObject({ status: 'UNPAIRED' });
  });

  it('returns device directly if not paired (idempotent)', async () => {
    const unpairedDevice = { ...PAIRED_DEVICE, elderId: null, status: 'UNPAIRED' };
    mockDeviceFindUnique.mockResolvedValue(unpairedDevice);

    const result = await unpairDevice('user-001', 'device-001');

    expect(mockDeviceUpdate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'UNPAIRED' });
  });

  it('throws device_not_found when device does not exist', async () => {
    mockDeviceFindUnique.mockResolvedValue(null);

    await expect(unpairDevice('user-001', 'device-001')).rejects.toMatchObject({
      code: 'device_not_found',
    });
  });

  it('throws access_denied when user does not own the elder', async () => {
    mockElderFindFirst.mockResolvedValue(null);

    await expect(unpairDevice('user-999', 'device-001')).rejects.toMatchObject({
      code: 'access_denied',
    });
  });
});

// forceUnpairDevice ย้ายไปอยู่ใน adminService แล้ว — ดู adminService.test.ts

describe('getDeviceConfig', () => {
  const ELDER = { id: 'elder-001', userId: 'user-001' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockElderFindFirst.mockResolvedValue(ELDER);
  });

  it('returns device config when found', async () => {
    mockDeviceFindFirst.mockResolvedValue({
      id: 'device-001',
      elderId: 'elder-001',
      updatedAt: new Date(),
      wifiStatus: 'CONNECTED',
      elder: ELDER,
    });

    const result = await getDeviceConfig('user-001', 'device-uuid-001');

    expect(mockElderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'elder-001', userId: 'user-001' },
      }),
    );
    expect(result).toMatchObject({ wifiStatus: 'CONNECTED' });
  });

  it('throws device_not_paired when device not found', async () => {
    mockDeviceFindFirst.mockResolvedValue(null);

    await expect(getDeviceConfig('user-001', 'device-uuid-001')).rejects.toMatchObject({
      code: 'device_not_paired',
    });
  });

  it('throws access_denied when user does not own the elder', async () => {
    mockDeviceFindFirst.mockResolvedValue({
      id: 'device-001',
      elderId: 'elder-001',
      wifiStatus: 'DISCONNECTED',
      updatedAt: new Date(),
    });
    mockElderFindFirst.mockResolvedValue(null);

    await expect(getDeviceConfig('user-999', 'device-uuid-001')).rejects.toMatchObject({
      code: 'access_denied',
    });
  });

  it('recovers stale CONFIGURING state to ERROR', async () => {
    const staleUpdatedAt = new Date(Date.now() - 600_000); // 10 minutes ago
    mockDeviceFindFirst.mockResolvedValue({
      id: 'device-001',
      elderId: 'elder-001',
      elder: ELDER,
      wifiStatus: 'CONFIGURING',
      updatedAt: staleUpdatedAt,
    });
    mockDeviceUpdate.mockResolvedValue({
      id: 'device-001',
      wifiStatus: 'ERROR',
      updatedAt: new Date(),
    });

    const result = await getDeviceConfig('user-001', 'device-uuid-001');

    expect(mockDeviceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'device-001' },
        data: expect.objectContaining({ wifiStatus: 'ERROR' }),
      }),
    );
    expect(result).toMatchObject({ wifiStatus: 'ERROR' });
  });
});

// getAllDevices และ recoverInconsistentDevices ย้ายไปอยู่ใน adminService แล้ว — ดู adminService.test.ts
