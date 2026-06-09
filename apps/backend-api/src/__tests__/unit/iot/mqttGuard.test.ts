/**
 * MQTT Guard Logic Tests
 * Tests: pairing status enforcement, ghost device rejection, config bypass
 */

const mockDeviceFindFirst = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    device: {
      findFirst: mockDeviceFindFirst,
    },
  },
}));

// Mock all downstream handlers
const mockFallHandler = jest.fn();
jest.mock('../../../iot/handlers/fallHandler', () => ({
  fallHandler: mockFallHandler,
}));

const mockFallCancelledHandler = jest.fn();
jest.mock('../../../iot/handlers/fallCancelledHandler', () => ({
  fallCancelledHandler: mockFallCancelledHandler,
}));

const mockHeartRateHandler = jest.fn();
jest.mock('../../../iot/handlers/heartRateHandler', () => ({
  heartRateHandler: mockHeartRateHandler,
}));

const mockStatusHandler = jest.fn();
jest.mock('../../../iot/handlers/statusHandler', () => ({
  statusHandler: mockStatusHandler,
}));

jest.mock('debug', () => {
  const dummyFn = () => {};
  return {
    __esModule: true,
    default: () => dummyFn,
  };
});

// We need to access the private handleMessage via the MQTT client's message event.
// Instead, we'll import the module and use an internal approach.
// Since MQTTClientManager is a class with private method, we test via the exported singleton
// by directly calling the prototype method.

import { mqttClient } from '../../../iot/mqttClient';

type TestableMqttClient = {
  handleMessage: (topic: string, payload: Buffer, packet: { retain: boolean }) => Promise<void>;
  publish: (
    topic: string,
    payload: unknown,
    options?: { readonly retain?: boolean },
  ) => Promise<void>;
};

const testableMqttClient = mqttClient as unknown as TestableMqttClient;

// Access private methods for testing
const handleMessage = testableMqttClient.handleMessage.bind(testableMqttClient);

// Mock the publish method on the singleton
const mockPublish = jest.fn().mockResolvedValue(undefined);
testableMqttClient.publish = mockPublish;

describe('MQTT Guard - Ghost Device Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks events from UNPAIRED device and sends RESET_NVS', async () => {
    mockDeviceFindFirst.mockResolvedValue({
      status: 'UNPAIRED',
    });

    const topic = 'device/ESP32-ABCDEF123456/status';
    const payload = Buffer.from(JSON.stringify({ online: true, timestamp: Date.now() }));

    await handleMessage(topic, payload, { retain: false });

    // Guard should have checked pairing status
    expect(mockDeviceFindFirst).toHaveBeenCalledWith({
      where: { serialNumber: 'ESP32-ABCDEF123456' },
      select: { status: true, elderId: true },
    });

    // statusHandler should NOT have been called
    expect(mockStatusHandler).not.toHaveBeenCalled();

    // RESET_NVS should have been sent back
    expect(mockPublish).toHaveBeenCalledWith(
      'device/ESP32-ABCDEF123456/config',
      expect.objectContaining({
        action: 'RESET_NVS',
        reason: 'DEVICE_UNPAIRED',
        deviceSerial: 'ESP32-ABCDEF123456',
        requestId: expect.any(String),
      }),
      { retain: true },
    );
  });

  it('allows events from PAIRED device through to handler', async () => {
    mockDeviceFindFirst.mockResolvedValue({
      status: 'PAIRED',
      elderId: 'elder-1',
    });

    const topic = 'device/ESP32-ABCDEF123456/status';
    const payload = Buffer.from(JSON.stringify({ online: true, timestamp: Date.now() }));

    await handleMessage(topic, payload, { retain: false });

    // statusHandler SHOULD have been called
    expect(mockStatusHandler).toHaveBeenCalledWith(
      'ESP32-ABCDEF123456',
      expect.objectContaining({ online: true }),
    );

    // No RESET_NVS should be sent
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('allows config/ack messages through without pairing check', async () => {
    const topic = 'device/ESP32-ABCDEF123456/config/ack';
    const payload = Buffer.from(
      JSON.stringify({ requestId: 'req-1', success: true, timestamp: Date.now() }),
    );

    await handleMessage(topic, payload, { retain: false });

    // Prisma should NOT have been queried (config/ack is exempt)
    expect(mockDeviceFindFirst).not.toHaveBeenCalled();
  });

  it('blocks heartrate events from UNPAIRED device', async () => {
    mockDeviceFindFirst.mockResolvedValue({
      status: 'UNPAIRED',
    });

    const topic = 'device/ESP32-ABCDEF123456/heartrate';
    const payload = Buffer.from(JSON.stringify({ heartRate: 72, timestamp: Date.now() }));

    await handleMessage(topic, payload, { retain: false });

    expect(mockHeartRateHandler).not.toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(
      'device/ESP32-ABCDEF123456/config',
      expect.objectContaining({ action: 'RESET_NVS' }),
      { retain: true },
    );
  });

  it('blocks fall events from UNPAIRED device', async () => {
    mockDeviceFindFirst.mockResolvedValue({
      status: 'UNPAIRED',
    });

    const topic = 'device/ESP32-ABCDEF123456/event';
    const payload = Buffer.from(
      JSON.stringify({
        type: 'fall',
        magnitude: 10,
        postureDelta: 45.2,
        timestamp: Date.now(),
      }),
    );

    await handleMessage(topic, payload, { retain: false });

    expect(mockFallHandler).not.toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(
      'device/ESP32-ABCDEF123456/config',
      expect.objectContaining({ action: 'RESET_NVS' }),
      { retain: true },
    );
  });

  it('blocks events when device is not found in DB (unknown device) and sends RESET_NVS', async () => {
    mockDeviceFindFirst.mockResolvedValue(null);

    const topic = 'device/ESP32-UNKNOWN/status';
    const payload = Buffer.from(JSON.stringify({ online: true, timestamp: Date.now() }));

    await handleMessage(topic, payload, { retain: false });

    // Should NOT pass through
    expect(mockStatusHandler).not.toHaveBeenCalled();

    // RESET_NVS should have been sent back with DEVICE_NOT_FOUND reason
    expect(mockPublish).toHaveBeenCalledWith(
      'device/ESP32-UNKNOWN/config',
      expect.objectContaining({
        action: 'RESET_NVS',
        reason: 'DEVICE_NOT_FOUND',
        deviceSerial: 'ESP32-UNKNOWN',
        requestId: expect.any(String),
      }),
      { retain: true },
    );
  });

  it('blocks unified event topic from UNPAIRED device', async () => {
    mockDeviceFindFirst.mockResolvedValue({
      status: 'UNPAIRED',
    });

    const topic = 'device/ESP32-ABCDEF123456/event';
    const payload = Buffer.from(
      JSON.stringify({
        type: 'heart_rate',
        bpm: 85,
        timestamp: Date.now(),
      }),
    );

    await handleMessage(topic, payload, { retain: false });

    expect(mockHeartRateHandler).not.toHaveBeenCalled();
    expect(mockFallHandler).not.toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(
      'device/ESP32-ABCDEF123456/config',
      expect.objectContaining({ action: 'RESET_NVS' }),
      { retain: true },
    );
  });
});
