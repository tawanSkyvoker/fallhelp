/**
 * Fall Cancelled Handler Tests
 * Tests: device-initiated fall cancellation via MQTT
 *
 * หลัง refactor: mock ผ่าน deviceService.findDeviceBySerial
 * แทน prisma.device.findFirst โดยตรง
 */

// Mock Device Service
const mockFindDeviceBySerial = jest.fn();
jest.mock('../../../services/deviceService', () => ({
  findDeviceBySerial: (...args: unknown[]) => mockFindDeviceBySerial(...args),
}));

// Mock Event Service
const mockCancelFallEventByDevice = jest.fn();
jest.mock('../../../services/eventService', () => ({
  cancelFallEventByDevice: (...args: unknown[]) => mockCancelFallEventByDevice(...args),
}));

// Mock Socket Server
const mockEmitEventStatusChanged = jest.fn();
jest.mock('../../../realtime/socketServer', () => ({
  socketServer: {
    emitEventStatusChanged: mockEmitEventStatusChanged,
  },
}));

// Mock debug
jest.mock('debug', () => {
  const m = jest.fn().mockReturnValue(jest.fn());
  return {
    __esModule: true,
    default: m,
    debug: m,
  };
});

import { fallCancelledHandler } from '../../../iot/handlers/fallCancelledHandler';

describe('fallCancelledHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should cancel fall event and emit FALL_CANCELLED status via Socket.io', async () => {
    mockFindDeviceBySerial.mockResolvedValue({
      id: 'device-uuid-001',
      elderId: 'elder-uuid-001',
      deviceCode: 'ABC123',
      elder: { id: 'elder-uuid-001', firstName: 'สมชาย', lastName: 'ใจดี' },
    });
    mockCancelFallEventByDevice.mockResolvedValue({ id: 'cancelled-event-id' });

    await fallCancelledHandler('ESP32-6C689BDAF380');

    // ตรวจว่า service ถูกเรียกด้วย serialNumber ที่ถูกต้อง
    expect(mockFindDeviceBySerial).toHaveBeenCalledWith('ESP32-6C689BDAF380');
    expect(mockCancelFallEventByDevice).toHaveBeenCalledWith('device-uuid-001');
    expect(mockEmitEventStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FALL_CANCELLED',
        eventId: 'cancelled-event-id',
        deviceId: 'device-uuid-001',
      }),
    );
  });

  it('should return early if device not found', async () => {
    mockFindDeviceBySerial.mockResolvedValue(null);

    await fallCancelledHandler('UNKNOWN-DEVICE');

    expect(mockCancelFallEventByDevice).not.toHaveBeenCalled();
  });

  it('should return early if device not paired with elder', async () => {
    mockFindDeviceBySerial.mockResolvedValue({
      id: 'device-uuid-001',
      elderId: null,
      deviceCode: 'ABC123',
      elder: null,
    });

    await fallCancelledHandler('ESP32-UNPAIRED');

    expect(mockCancelFallEventByDevice).not.toHaveBeenCalled();
  });

  it('should return early if no recent fall to cancel', async () => {
    mockFindDeviceBySerial.mockResolvedValue({
      id: 'device-uuid-001',
      elderId: 'elder-uuid-001',
      deviceCode: 'ABC123',
      elder: { id: 'elder-uuid-001', firstName: 'สมชาย', lastName: 'ใจดี' },
    });
    mockCancelFallEventByDevice.mockResolvedValue(false);

    await fallCancelledHandler('ESP32-6C689BDAF380');

    expect(mockCancelFallEventByDevice).toHaveBeenCalledWith('device-uuid-001');
    expect(mockEmitEventStatusChanged).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully (no throw)', async () => {
    mockFindDeviceBySerial.mockRejectedValue(new Error('DB error'));

    await expect(fallCancelledHandler('ESP32-ERROR')).resolves.toBeUndefined();
  });
});
