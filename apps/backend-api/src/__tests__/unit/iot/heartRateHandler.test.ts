/**
 * Heart Rate Handler Tests
 * Tests: normal readings, invalid payload, device not found, confidence=none, heartRate=0
 *
 * หลัง refactor: mock ผ่าน deviceService.findDeviceBySerial
 * แทน prisma.device.findFirst โดยตรง
 */

// Mock Device Service
const mockFindDeviceBySerial = jest.fn();
jest.mock('../../../services/deviceService', () => ({
  findDeviceBySerial: (...args: unknown[]) => mockFindDeviceBySerial(...args),
}));

// Mock Socket.io
const mockEmitHeartRateUpdate = jest.fn();
jest.mock('../../../realtime/socketServer', () => ({
  socketServer: {
    emitHeartRateUpdate: mockEmitHeartRateUpdate,
  },
}));

// Mock payload validator
const mockValidateHeartRatePayload = jest.fn();
jest.mock('../../../iot/payloadValidator', () => ({
  __esModule: true,
  validateHeartRatePayload: (data: unknown) => mockValidateHeartRatePayload(data),
}));

// Mock debug
jest.mock('debug', () => {
  const dummyFn = () => {};
  return {
    __esModule: true,
    default: () => dummyFn,
  };
});

import { heartRateHandler } from '../../../iot/handlers/heartRateHandler';

const mockDevice = {
  id: 'device-uuid-001',
  elderId: 'elder-uuid-001',
  deviceCode: 'ABC123',
  elder: { id: 'elder-uuid-001', firstName: 'สมชาย', lastName: 'ใจดี' },
};

describe('heartRateHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindDeviceBySerial.mockResolvedValue(mockDevice);
  });

  it('should emit heart rate update for normal reading', async () => {
    mockValidateHeartRatePayload.mockReturnValue({ heartRate: 75, isAbnormal: false });

    await heartRateHandler('ESP32-6C689BDAF380', { heartRate: 75 });

    expect(mockEmitHeartRateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        elderId: 'elder-uuid-001',
        heartRate: 75,
      }),
    );
  });

  it('should reject invalid payload', async () => {
    mockValidateHeartRatePayload.mockReturnValue(null);

    await heartRateHandler('ESP32-6C689BDAF380', { invalid: 'data' });

    expect(mockFindDeviceBySerial).not.toHaveBeenCalled();
    expect(mockEmitHeartRateUpdate).not.toHaveBeenCalled();
  });

  it('should handle device not found', async () => {
    mockValidateHeartRatePayload.mockReturnValue({ heartRate: 75, isAbnormal: false });
    mockFindDeviceBySerial.mockResolvedValue(null);

    await heartRateHandler('UNKNOWN-DEVICE', { heartRate: 75 });

    expect(mockEmitHeartRateUpdate).not.toHaveBeenCalled();
  });

  it('should handle device not paired with elder', async () => {
    mockValidateHeartRatePayload.mockReturnValue({ heartRate: 75, isAbnormal: false });
    mockFindDeviceBySerial.mockResolvedValue({ ...mockDevice, elderId: null });

    await heartRateHandler('ESP32-UNPAIRED', { heartRate: 75 });

    expect(mockEmitHeartRateUpdate).not.toHaveBeenCalled();
  });

  it("should ignore abnormal reading with confidence='none' and emit update only", async () => {
    mockValidateHeartRatePayload.mockReturnValue({
      heartRate: 150,
      isAbnormal: true,
      alertType: 'HIGH',
      confidence: 'none',
    });

    await heartRateHandler('ESP32-6C689BDAF380', {
      heartRate: 150,
      isAbnormal: true,
      alertType: 'HIGH',
      confidence: 'none',
    });

    expect(mockEmitHeartRateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        elderId: 'elder-uuid-001',
        heartRate: 150,
        confidence: 'none',
      }),
    );
  });

  it('should emit heartRate=0 when sensor is removed', async () => {
    mockValidateHeartRatePayload.mockReturnValue({ heartRate: 0, isAbnormal: false });

    await heartRateHandler('ESP32-6C689BDAF380', { heartRate: 0 });

    expect(mockEmitHeartRateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        elderId: 'elder-uuid-001',
        heartRate: 0,
      }),
    );
  });

  it('should emit update for abnormal reading (no event created)', async () => {
    mockValidateHeartRatePayload.mockReturnValue({
      heartRate: 150,
      isAbnormal: true,
      alertType: 'HIGH',
    });

    await heartRateHandler('ESP32-6C689BDAF380', { heartRate: 150 });

    expect(mockEmitHeartRateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        elderId: 'elder-uuid-001',
        heartRate: 150,
      }),
    );
  });

  it('should handle errors gracefully', async () => {
    mockValidateHeartRatePayload.mockReturnValue({ heartRate: 75, isAbnormal: false });
    mockFindDeviceBySerial.mockRejectedValue(new Error('DB error'));

    await expect(heartRateHandler('ESP32-ERROR', { heartRate: 75 })).resolves.toBeUndefined();
  });
});
