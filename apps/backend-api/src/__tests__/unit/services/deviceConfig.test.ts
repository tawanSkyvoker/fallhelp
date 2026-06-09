/**
 * deviceConfig Service Tests
 * Tests: device configuration retrieval and elder-device relationship validation
 */
const mockDeviceFindFirst = jest.fn();
const mockElderFindFirst = jest.fn();
const mockDeviceUpdate = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    device: {
      findFirst: mockDeviceFindFirst,
      update: mockDeviceUpdate,
    },
    elder: {
      findFirst: mockElderFindFirst,
    },
  },
}));

jest.mock('../../../iot/mqttClient', () => ({
  mqttClient: {
    publish: jest.fn(),
    subscribe: jest.fn(),
  },
}));

jest.mock('debug', () => {
  const dummyFn = () => {};
  return {
    __esModule: true,
    default: () => dummyFn,
  };
});

import { getDeviceConfig } from '../../../services/deviceService';

describe('getDeviceConfig recovery and lookup behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElderFindFirst.mockResolvedValue({
      id: 'elder-1',
      userId: 'user-1',
    });
  });

  it('looks up device by deviceCode when non-UUID id is provided', async () => {
    const now = new Date();
    mockDeviceFindFirst.mockResolvedValue({
      id: 'device-1',
      elderId: 'elder-1',
      wifiStatus: 'CONNECTED',
      updatedAt: now,
    });

    await getDeviceConfig('user-1', 'DEVICE123');

    expect(mockDeviceFindFirst).toHaveBeenCalledWith({
      where: { deviceCode: 'DEVICE123' },
      include: {
        elder: true,
      },
    });
  });

  it('marks stale CONFIGURING config as ERROR', async () => {
    const staleTime = new Date(Date.now() - 5 * 60 * 1000);
    mockDeviceFindFirst.mockResolvedValue({
      id: 'device-1',
      elderId: 'elder-1',
      wifiStatus: 'CONFIGURING',
      updatedAt: staleTime,
    });
    mockDeviceUpdate.mockResolvedValue({
      id: 'device-1',
      wifiStatus: 'ERROR',
      updatedAt: new Date(),
    });

    const result = await getDeviceConfig('user-1', 'device-uuid-0001-0001');

    expect(mockDeviceUpdate).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: {
        wifiStatus: 'ERROR',
        updatedAt: expect.any(Date),
      },
      select: {
        id: true,
        wifiStatus: true,
        updatedAt: true,
      },
    });
    expect(result).toMatchObject({
      deviceId: 'device-1',
      wifiStatus: 'ERROR',
    });
  });

  it('keeps non-stale CONFIGURING config unchanged', async () => {
    const freshTime = new Date();
    mockDeviceFindFirst.mockResolvedValue({
      id: 'device-1',
      elderId: 'elder-1',
      wifiStatus: 'CONFIGURING',
      updatedAt: freshTime,
    });

    const result = await getDeviceConfig('user-1', 'device-uuid-0002-0002');

    expect(mockDeviceUpdate).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      deviceId: 'device-1',
      wifiStatus: 'CONFIGURING',
    });
  });
});
