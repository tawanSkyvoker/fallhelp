/**
 * Fall Handler Tests
 * Tests: suspected_fall, confirm/cancel logic, pulse data processing
 *
 * หลัง refactor: mock ผ่าน service layer (deviceService, eventService)
 * แทน prisma โดยตรง เพื่อให้ตรงกับ Controller-Service pattern
 */

import { FallDetectionPayload } from '../../../iot/topics';

// ==========================================
// Setup mocks BEFORE imports
// ==========================================

// Mock Device Service
const mockFindDeviceBySerial = jest.fn();
jest.mock('../../../services/deviceService', () => ({
  findDeviceBySerial: (...args: unknown[]) => mockFindDeviceBySerial(...args),
}));

// Mock Event Service
const mockCreateEvent = jest.fn();
const mockFindPendingFallEvent = jest.fn();
const mockConfirmPendingFallEvent = jest.fn();
jest.mock('../../../services/eventService', () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  findPendingFallEvent: (...args: unknown[]) => mockFindPendingFallEvent(...args),
  confirmPendingFallEvent: (...args: unknown[]) => mockConfirmPendingFallEvent(...args),
}));

// Mock Notification Service
const mockNotifyFallDetection = jest.fn();
jest.mock('../../../services/notificationService', () => ({
  notifyFallDetection: (...args: unknown[]) => mockNotifyFallDetection(...args),
}));

// Mock Socket Server
const mockEmitFallDetected = jest.fn();
const mockEmitEventStatusChanged = jest.fn();
jest.mock('../../../realtime/socketServer', () => ({
  socketServer: {
    emitFallDetected: mockEmitFallDetected,
    emitEventStatusChanged: mockEmitEventStatusChanged,
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

// ==========================================
// Import handler AFTER mocks
// ==========================================
import { fallHandler, _resetFallDedup } from '../../../iot/handlers/fallHandler';

describe('🚨 Priority 1: Fall Detection Handler (Life Saving Logic)', () => {
  const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z');

  // Real ESP32 Payload Structure
  const REAL_ESP32_FALL_PAYLOAD: FallDetectionPayload = {
    timestamp: '2024-12-15T10:30:00.000Z',
    magnitude: 15.5,
    postureDelta: 45.2,
  };

  const MOCK_DEVICE_ID = 'ESP32-6C689BDAF380';

  const MOCK_DEVICE = {
    id: 'device-uuid-001',
    deviceCode: '8E5D02FB',
    elderId: 'elder-uuid-001',
    elder: {
      id: 'elder-uuid-001',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
    },
  };

  const MOCK_EVENT = {
    id: 'event-uuid-001',
    elderId: MOCK_DEVICE.elderId,
    deviceId: MOCK_DEVICE.id,
    fallStage: 'CONFIRMED',
    timestamp: new Date(FIXED_NOW),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
    jest.clearAllMocks();
    _resetFallDedup();

    // Setup default mock returns
    mockFindDeviceBySerial.mockResolvedValue(MOCK_DEVICE);
    mockFindPendingFallEvent.mockResolvedValue(null);
    mockConfirmPendingFallEvent.mockResolvedValue(MOCK_EVENT);
    mockCreateEvent.mockResolvedValue(MOCK_EVENT);
    mockNotifyFallDetection.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ==========================================
  // Test 0: Suspected flow creates pending event (no emergency notify)
  // ==========================================
  it('should create a pending fall event for suspected mode without realtime or push notification', async () => {
    const suspectedPayload: FallDetectionPayload = {
      ...REAL_ESP32_FALL_PAYLOAD,
      bpm: 78,
    };
    const pendingEvent = {
      ...MOCK_EVENT,
      fallStage: 'PENDING_CONFIRMATION',
      timestamp: new Date(FIXED_NOW),
    };
    mockCreateEvent.mockResolvedValueOnce(pendingEvent);

    await fallHandler(MOCK_DEVICE_ID, suspectedPayload, {
      mode: 'suspected',
    });

    expect(mockCreateEvent).toHaveBeenCalledWith({
      elderId: MOCK_DEVICE.elderId,
      deviceId: MOCK_DEVICE.id,
      fallStage: 'PENDING_CONFIRMATION',
      bpm: 78,
      magnitude: suspectedPayload.magnitude,
      postureDelta: suspectedPayload.postureDelta,
      timestamp: FIXED_NOW,
    });
    expect(mockNotifyFallDetection).not.toHaveBeenCalled();
    expect(mockEmitFallDetected).not.toHaveBeenCalled();
    expect(mockEmitEventStatusChanged).toHaveBeenCalledTimes(1);
    expect(mockEmitEventStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FALL_SUSPECTED',
        eventId: pendingEvent.id,
        deviceId: MOCK_DEVICE.id,
      }),
    );
  });

  // ==========================================
  // Test 0.1: Confirmed mode updates pending event first
  // ==========================================
  it('should confirm existing pending event before fallback create flow', async () => {
    const pendingEvent = {
      id: 'pending-event-uuid',
      bpm: null,
      timestamp: new Date(FIXED_NOW),
    };
    const confirmedEvent = {
      ...MOCK_EVENT,
      fallStage: 'CONFIRMED',
      timestamp: new Date(FIXED_NOW),
    };
    mockFindPendingFallEvent.mockResolvedValueOnce(pendingEvent);
    mockConfirmPendingFallEvent.mockResolvedValueOnce(confirmedEvent);

    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD, { mode: 'confirmed' });

    expect(mockCreateEvent).not.toHaveBeenCalled();

    // ตรวจว่าเรียก findPendingFallEvent ด้วย deviceId ที่ถูกต้อง
    expect(mockFindPendingFallEvent).toHaveBeenCalledWith(MOCK_DEVICE.id);

    // ตรวจว่า confirm ด้วยข้อมูล sensor ที่ถูกต้อง
    expect(mockConfirmPendingFallEvent).toHaveBeenCalledWith(pendingEvent.id, {
      magnitude: REAL_ESP32_FALL_PAYLOAD.magnitude,
      postureDelta: REAL_ESP32_FALL_PAYLOAD.postureDelta,
    });

    expect(mockNotifyFallDetection).toHaveBeenCalledWith(
      MOCK_DEVICE.elderId,
      confirmedEvent.id,
      null,
    );
    expect(mockEmitFallDetected).toHaveBeenCalledTimes(1);
    expect(mockEmitEventStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'FALL_CONFIRMED',
      }),
    );
  });

  it('should keep suspected BPM when confirmed payload has no BPM', async () => {
    const pendingEvent = {
      id: 'pending-event-uuid',
      bpm: 81, // BPM จากตอน suspected
      timestamp: new Date(FIXED_NOW),
    };
    const confirmedEvent = {
      id: 'event-uuid-001',
      timestamp: new Date(FIXED_NOW),
    };
    mockFindPendingFallEvent.mockResolvedValueOnce(pendingEvent);
    mockConfirmPendingFallEvent.mockResolvedValueOnce(confirmedEvent);

    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD, { mode: 'confirmed' });

    // BPM ที่ส่งไปยัง notify ต้องเป็นค่าจาก pending (ตอน suspected) ไม่ใช่จาก confirmed payload
    expect(mockNotifyFallDetection).toHaveBeenCalledWith(
      MOCK_DEVICE.elderId,
      confirmedEvent.id,
      81,
    );
  });

  // ==========================================
  // Test 1: Data saved to database correctly
  // ==========================================
  it('should create a CRITICAL fall event in database with correct payload data', async () => {
    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);

    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    expect(mockCreateEvent).toHaveBeenCalledWith({
      elderId: MOCK_DEVICE.elderId,
      deviceId: MOCK_DEVICE.id,
      fallStage: 'CONFIRMED',
      magnitude: REAL_ESP32_FALL_PAYLOAD.magnitude,
      postureDelta: REAL_ESP32_FALL_PAYLOAD.postureDelta,
      timestamp: FIXED_NOW,
    });
  });

  // ==========================================
  // Test 2: Notification sent to caregivers
  // ==========================================
  it('should call notifyFallDetection to alert caregivers', async () => {
    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);

    expect(mockNotifyFallDetection).toHaveBeenCalledTimes(1);
    expect(mockNotifyFallDetection).toHaveBeenCalledWith(MOCK_DEVICE.elderId, MOCK_EVENT.id, null);
  });

  // ==========================================
  // Test 3: Socket.io real-time event emitted
  // ==========================================
  it('should emit Socket.io event for real-time dashboard update', async () => {
    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);

    expect(mockEmitEventStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FALL_CONFIRMED' }),
    );
    expect(mockEmitFallDetected).toHaveBeenCalledTimes(1);
    expect(mockEmitFallDetected).toHaveBeenCalledWith({
      eventId: MOCK_EVENT.id,
      elderId: MOCK_DEVICE.elderId,
      elderName: 'สมชาย ใจดี',
      deviceId: MOCK_DEVICE.id,
      deviceCode: MOCK_DEVICE.deviceCode,
      timestamp: MOCK_EVENT.timestamp,
      accelerationMagnitude: REAL_ESP32_FALL_PAYLOAD.magnitude,
      bpm: null,
    });
  });

  // ==========================================
  // Test 4: Unknown device handling
  // ==========================================
  it('should gracefully handle unknown device (not in database)', async () => {
    mockFindDeviceBySerial.mockResolvedValue(null);

    await fallHandler('UNKNOWN_DEVICE', REAL_ESP32_FALL_PAYLOAD);

    expect(mockCreateEvent).not.toHaveBeenCalled();
    expect(mockNotifyFallDetection).not.toHaveBeenCalled();
    expect(mockEmitFallDetected).not.toHaveBeenCalled();
  });

  // ==========================================
  // Test 5: Unpaired device handling
  // ==========================================
  it('should not process fall event for unpaired device (no elder)', async () => {
    mockFindDeviceBySerial.mockResolvedValue({
      ...MOCK_DEVICE,
      elderId: null,
      elder: null,
    });

    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);

    expect(mockCreateEvent).not.toHaveBeenCalled();
    expect(mockNotifyFallDetection).not.toHaveBeenCalled();
  });

  // ==========================================
  // Test 6: Complete flow integration
  // ==========================================
  it('should execute complete critical path: device lookup → DB → Notify → Socket', async () => {
    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);

    // ตรวจว่า handler เรียก service ด้วย serialNumber ที่ถูกต้อง
    expect(mockFindDeviceBySerial).toHaveBeenCalledWith(MOCK_DEVICE_ID);

    // ตรวจว่า critical operations ครบ 3 ขั้นตอน
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    expect(mockNotifyFallDetection).toHaveBeenCalledTimes(1);
    expect(mockEmitFallDetected).toHaveBeenCalledTimes(1);
  });

  // ==========================================
  // Test 7: Invalid payload → early return
  // ==========================================
  it('should return early and do nothing when payload is invalid', async () => {
    await fallHandler(MOCK_DEVICE_ID, null);

    expect(mockFindDeviceBySerial).not.toHaveBeenCalled();
    expect(mockCreateEvent).not.toHaveBeenCalled();
    expect(mockNotifyFallDetection).not.toHaveBeenCalled();
  });

  it('should return early when payload is missing required fields', async () => {
    await fallHandler(MOCK_DEVICE_ID, { foo: 'bar' });

    expect(mockCreateEvent).not.toHaveBeenCalled();
    expect(mockNotifyFallDetection).not.toHaveBeenCalled();
  });

  // ==========================================
  // Test 8: Duplicate fall event → early return
  // ==========================================
  it('should ignore duplicate confirmed fall within dedup window', async () => {
    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);

    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);
    expect(mockCreateEvent).toHaveBeenCalledTimes(1); // still 1, not 2
    expect(mockNotifyFallDetection).toHaveBeenCalledTimes(1);
  });

  it('should ignore duplicate suspected fall within 15s dedup window', async () => {
    const pendingEvent = {
      ...MOCK_EVENT,
      fallStage: 'PENDING_CONFIRMATION',
      timestamp: new Date(FIXED_NOW),
    };
    mockCreateEvent.mockResolvedValue(pendingEvent);
    mockFindPendingFallEvent.mockResolvedValue(null);

    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD, { mode: 'suspected' });
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);

    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD, { mode: 'suspected' });
    expect(mockCreateEvent).toHaveBeenCalledTimes(1); // still 1
  });

  // ==========================================
  // Test 9: Suspected mode with existing PENDING_CONFIRMATION event → skip
  // ==========================================
  it('should skip creating suspected event when pending PENDING_CONFIRMATION event exists', async () => {
    mockFindPendingFallEvent.mockResolvedValueOnce({
      id: 'existing-pending-id',
      bpm: null,
      timestamp: new Date(FIXED_NOW),
    });

    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD, { mode: 'suspected' });

    expect(mockCreateEvent).not.toHaveBeenCalled();
    expect(mockNotifyFallDetection).not.toHaveBeenCalled();
  });

  // ==========================================
  // Test 10: Error catch block
  // ==========================================
  it('should not throw when an internal error occurs (error is caught)', async () => {
    mockFindDeviceBySerial.mockRejectedValueOnce(new Error('DB connection failed'));

    await expect(fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD)).resolves.toBeUndefined();
  });

  // ==========================================
  // Test 11: Payload includes postureDelta evidence when present
  // ==========================================
  it('should include postureDelta in metadata when present in payload', async () => {
    const payloadWithOptionals = {
      ...REAL_ESP32_FALL_PAYLOAD,
      postureDelta: 45.5,
    };

    await fallHandler(MOCK_DEVICE_ID, payloadWithOptionals);

    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        postureDelta: 45.5,
      }),
    );
  });

  // ==========================================
  // Test 12: Elder name fallback when elder is null
  // ==========================================
  it('should use "Unknown" as elder name when device has no elder object', async () => {
    const deviceWithoutElderObject = {
      ...MOCK_DEVICE,
      elderId: 'elder-uuid-001',
      elder: null,
    };
    mockFindDeviceBySerial.mockResolvedValueOnce(deviceWithoutElderObject);

    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);

    expect(mockEmitFallDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        elderName: 'Unknown',
      }),
    );
  });

  // ==========================================
  // Test 13: _resetFallDedup clears state
  // ==========================================
  it('_resetFallDedup should allow a new fall event after clearing dedup state', async () => {
    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);

    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);
    expect(mockCreateEvent).toHaveBeenCalledTimes(1);

    _resetFallDedup();
    await fallHandler(MOCK_DEVICE_ID, REAL_ESP32_FALL_PAYLOAD);
    expect(mockCreateEvent).toHaveBeenCalledTimes(2);
  });
});
