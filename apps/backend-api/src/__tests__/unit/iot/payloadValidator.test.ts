/**
 * payloadValidator Utility Tests
 * Tests: heart rate range validation, fall payload integrity
 */
import {
  HEART_RATE_PAYLOAD_BPM_MAX,
  HEART_RATE_PAYLOAD_BPM_MIN,
  validateHeartRatePayload,
  validateFallPayload,
} from '../../../iot/payloadValidator';

describe('payloadValidator - heart rate range', () => {
  it('accepts BPM at configured lower boundary', () => {
    const result = validateHeartRatePayload({
      timestamp: Date.now(),
      heartRate: HEART_RATE_PAYLOAD_BPM_MIN,
    });

    expect(result).toEqual(
      expect.objectContaining({
        heartRate: HEART_RATE_PAYLOAD_BPM_MIN,
      }),
    );
  });

  it('accepts BPM at configured upper boundary', () => {
    const result = validateHeartRatePayload({
      timestamp: Date.now(),
      heartRate: HEART_RATE_PAYLOAD_BPM_MAX,
    });

    expect(result).toEqual(
      expect.objectContaining({
        heartRate: HEART_RATE_PAYLOAD_BPM_MAX,
      }),
    );
  });

  it('rejects BPM lower than configured minimum', () => {
    const result = validateHeartRatePayload({
      timestamp: Date.now(),
      heartRate: HEART_RATE_PAYLOAD_BPM_MIN - 1,
    });

    expect(result).toBeNull();
  });

  it('rejects BPM higher than configured maximum', () => {
    const result = validateHeartRatePayload({
      timestamp: Date.now(),
      heartRate: HEART_RATE_PAYLOAD_BPM_MAX + 1,
    });

    expect(result).toBeNull();
  });

  it('accepts valid alertType from device classification', () => {
    const result = validateHeartRatePayload({
      timestamp: Date.now(),
      heartRate: 88,
      isAbnormal: true,
      alertType: 'HIGH',
    });

    expect(result).toEqual(
      expect.objectContaining({
        heartRate: 88,
        isAbnormal: true,
        alertType: 'HIGH',
      }),
    );
  });

  it('accepts valid zone from device classification', () => {
    const result = validateHeartRatePayload({
      timestamp: Date.now(),
      heartRate: 88,
      zone: 'high',
      isAbnormal: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        heartRate: 88,
        zone: 'high',
      }),
    );
  });

  it('ignores invalid alertType values', () => {
    const result = validateHeartRatePayload({
      timestamp: Date.now(),
      heartRate: 88,
      isAbnormal: true,
      alertType: 'urgent',
    });

    // optional field ที่ไม่ผ่าน validation ต้องถูกตัดทิ้งจาก payload
    // ไม่ควรคง key ไว้เป็น undefined เพราะจะทำให้ contract ของ MQTT payload หลวมเกินจำเป็น
    expect(result).toEqual(
      expect.objectContaining({
        heartRate: 88,
        isAbnormal: true,
      }),
    );
    expect(result).not.toHaveProperty('alertType');
  });
});

describe('validateFallPayload — optional field validation failures', () => {
  const BASE = {
    timestamp: '2024-01-01T00:00:00Z',
    magnitude: 15.5,
    postureDelta: 45.2,
  };

  it('returns null when postureDelta is present but out of range', () => {
    expect(validateFallPayload({ ...BASE, postureDelta: 999 })).toBeNull();
  });

  it('returns null when magnitude is missing', () => {
    expect(
      validateFallPayload({ timestamp: BASE.timestamp, postureDelta: BASE.postureDelta }),
    ).toBeNull();
  });

  it('returns null when postureDelta is missing', () => {
    expect(
      validateFallPayload({ timestamp: BASE.timestamp, magnitude: BASE.magnitude }),
    ).toBeNull();
  });

  it('returns null when timestamp is missing', () => {
    expect(
      validateFallPayload({ magnitude: BASE.magnitude, postureDelta: BASE.postureDelta }),
    ).toBeNull();
  });
});

describe('MQTT_TOPICS utility functions', () => {
  // Import directly (not mocked) to get real implementation
  it('getConfigAckTopic returns correct topic string', async () => {
    jest.resetModules();
    const { MQTT_TOPICS } = await import('../../../iot/topics');
    expect(MQTT_TOPICS.getConfigAckTopic('ESP32-ABC')).toBe('device/ESP32-ABC/config/ack');
  });
});
