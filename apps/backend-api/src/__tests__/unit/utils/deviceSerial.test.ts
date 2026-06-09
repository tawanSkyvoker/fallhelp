/**
 * deviceSerial Utility Tests
 * Tests: constants, normalization, validation patterns
 */
import {
  DEVICE_SERIAL_PREFIX,
  DEVICE_SERIAL_HEX_LENGTH,
  DEVICE_SERIAL_TOTAL_LENGTH,
  normalizeDeviceSerial,
  isValidDeviceSerial,
} from '../../../utils/deviceSerial';

describe('deviceSerial utils', () => {
  describe('constants', () => {
    it('should have correct prefix and length constants', () => {
      expect(DEVICE_SERIAL_PREFIX).toBe('ESP32-');
      expect(DEVICE_SERIAL_HEX_LENGTH).toBe(12);
      expect(DEVICE_SERIAL_TOTAL_LENGTH).toBe(18);
    });
  });

  describe('normalizeDeviceSerial', () => {
    it('should uppercase and trim strings', () => {
      expect(normalizeDeviceSerial(' esp32-1a2b3c4d5e6f ')).toBe('ESP32-1A2B3C4D5E6F');
      expect(normalizeDeviceSerial('esp32-aabbccddeeff')).toBe('ESP32-AABBCCDDEEFF');
      expect(normalizeDeviceSerial(' ESP32-1234567890AB')).toBe('ESP32-1234567890AB');
    });
  });

  describe('isValidDeviceSerial', () => {
    it('should return true for valid serials', () => {
      expect(isValidDeviceSerial('ESP32-1A2B3C4D5E6F')).toBe(true);
      expect(isValidDeviceSerial('esp32-1a2b3c4d5e6f')).toBe(true); // Should normalize first
      expect(isValidDeviceSerial(' ESP32-AABBCCDDEEFF ')).toBe(true); // Should normalize first
      expect(isValidDeviceSerial('ESP32-000000000000')).toBe(true);
      expect(isValidDeviceSerial('ESP32-FFFFFFFFFFFF')).toBe(true);
    });

    it('should return false for invalid serials', () => {
      expect(isValidDeviceSerial('ESP32-1A2B3C4D5E6')).toBe(false); // Too short
      expect(isValidDeviceSerial('ESP32-1A2B3C4D5E6F7')).toBe(false); // Too long
      expect(isValidDeviceSerial('ESP8266-1A2B3C4D5E6F')).toBe(false); // Wrong prefix
      expect(isValidDeviceSerial('ESP32-1A2B3C4D5E6G')).toBe(false); // Invalid hex char (G)
      expect(isValidDeviceSerial('1A2B3C4D5E6F')).toBe(false); // No prefix
      expect(isValidDeviceSerial('')).toBe(false); // Empty
    });
  });
});
