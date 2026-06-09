/**
 * configValidator Utility Tests
 * Tests: env var validation, error/warning detection, startup throw behavior
 */

import { validateConfig, validateAndLogConfig } from '../../../utils/configValidator';

const VALID_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a-very-long-and-secure-jwt-secret-key-here',
  FRONTEND_URL: 'http://localhost:3000',
  ADMIN_URL: 'http://localhost:3001',
};

describe('validateConfig', () => {
  describe('DATABASE_URL', () => {
    it('should pass with valid DATABASE_URL', () => {
      const result = validateConfig(VALID_ENV);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error when DATABASE_URL is missing', () => {
      const env = { ...VALID_ENV, DATABASE_URL: undefined };
      const result = validateConfig(env);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('DATABASE_URL is required')]),
      );
    });

    it('should error when DATABASE_URL has invalid format', () => {
      const env = { ...VALID_ENV, DATABASE_URL: 'not-a-valid-url' };
      const result = validateConfig(env);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('DATABASE_URL has invalid format')]),
      );
    });
  });

  describe('JWT_SECRET', () => {
    it('should error when JWT_SECRET is missing', () => {
      const env = { ...VALID_ENV, JWT_SECRET: undefined };
      const result = validateConfig(env);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('JWT_SECRET is required')]),
      );
    });

    it('should warn when JWT_SECRET is shorter than 32 chars', () => {
      const env = { ...VALID_ENV, JWT_SECRET: 'short' };
      const result = validateConfig(env);
      expect(result.isValid).toBe(true); // warning only
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('JWT_SECRET should be at least 32')]),
      );
    });

    it('should not warn when JWT_SECRET is 32+ chars', () => {
      const env = { ...VALID_ENV, JWT_SECRET: 'a'.repeat(32) };
      const result = validateConfig(env);
      expect(result.warnings.filter((w) => w.includes('JWT_SECRET'))).toHaveLength(0);
    });
  });

  describe('PORT', () => {
    it('should pass when PORT is a valid number', () => {
      const env = { ...VALID_ENV, PORT: '3000' };
      const result = validateConfig(env);
      expect(result.isValid).toBe(true);
    });

    it('should error when PORT is not a number', () => {
      const env = { ...VALID_ENV, PORT: 'abc' };
      const result = validateConfig(env);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('PORT must be a number')]),
      );
    });

    it('should error when PORT is out of range', () => {
      const env = { ...VALID_ENV, PORT: '99999' };
      const result = validateConfig(env);
      expect(result.isValid).toBe(false);
    });

    it('should pass when PORT is not set (optional)', () => {
      const env = { ...VALID_ENV, PORT: undefined };
      const result = validateConfig(env);
      expect(result.isValid).toBe(true);
    });
  });

  describe('MQTT_BROKER_URL', () => {
    it('should error when MQTT_BROKER_URL is invalid and MQTT not disabled', () => {
      const env = { ...VALID_ENV, MQTT_BROKER_URL: 'not-a-url', MQTT_DISABLED: undefined };
      const result = validateConfig(env);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('MQTT_BROKER_URL has invalid format')]),
      );
    });

    it('should skip MQTT_BROKER_URL validation when MQTT_DISABLED is set', () => {
      const env = { ...VALID_ENV, MQTT_BROKER_URL: 'not-a-url', MQTT_DISABLED: 'true' };
      const result = validateConfig(env);
      expect(result.errors.filter((e) => e.includes('MQTT'))).toHaveLength(0);
    });

    it('should pass with valid MQTT_BROKER_URL', () => {
      const env = { ...VALID_ENV, MQTT_BROKER_URL: 'mqtts://broker.example.com:8883' };
      const result = validateConfig(env);
      expect(result.isValid).toBe(true);
    });
  });

  describe('optional warnings', () => {
    it('should warn when RESEND_API_KEY is missing in production', () => {
      const env = { ...VALID_ENV, NODE_ENV: 'production', RESEND_API_KEY: undefined };
      const result = validateConfig(env);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('RESEND_API_KEY')]),
      );
    });

    it('should not warn about RESEND_API_KEY in non-production', () => {
      const env = { ...VALID_ENV, NODE_ENV: 'test', RESEND_API_KEY: undefined };
      const result = validateConfig(env);
      expect(result.warnings.filter((w) => w.includes('RESEND_API_KEY'))).toHaveLength(0);
    });

    it('should warn when FRONTEND_URL is missing', () => {
      const env = { ...VALID_ENV, FRONTEND_URL: undefined };
      const result = validateConfig(env);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('FRONTEND_URL')]),
      );
    });

    it('should warn when ADMIN_URL is missing', () => {
      const env = { ...VALID_ENV, ADMIN_URL: undefined };
      const result = validateConfig(env);
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('ADMIN_URL')]),
      );
    });
  });

  describe('result structure', () => {
    it('should return isValid=true and empty errors for valid config', () => {
      const result = validateConfig(VALID_ENV);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accumulate multiple errors', () => {
      const env: NodeJS.ProcessEnv = {};
      const result = validateConfig(env);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});

describe('validateAndLogConfig', () => {
  it('should not throw for valid config', () => {
    expect(() => validateAndLogConfig(VALID_ENV)).not.toThrow();
  });

  it('should throw Error for invalid config', () => {
    const env: NodeJS.ProcessEnv = {};
    expect(() => validateAndLogConfig(env)).toThrow('Configuration validation failed');
  });

  it('should include error messages in thrown error', () => {
    const env = { ...VALID_ENV, DATABASE_URL: undefined };
    expect(() => validateAndLogConfig(env)).toThrow('DATABASE_URL is required');
  });
});
