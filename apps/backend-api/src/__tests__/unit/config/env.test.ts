/**
 * env.ts unit tests
 * Covers every getter and helper in backendEnv, including error branches.
 * Uses jest.resetModules() to re-import with fresh process.env values.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Re-import backendEnv with the current process.env snapshot */
const freshEnv = async () => {
  jest.resetModules();
  const mod = await import('../../../config/env');
  return mod.backendEnv;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('backendEnv', () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    // Restore process.env to original state after every test
    for (const key of Object.keys(process.env)) {
      if (!(key in snapshot)) {
        Reflect.deleteProperty(process.env, key);
      }
    }
    Object.assign(process.env, snapshot);
    jest.resetModules();
  });

  // ─── nodeEnv / isProduction / isDevelopment ─────────────────────────────────
  describe('nodeEnv / isProduction / isDevelopment', () => {
    it('returns process.env.NODE_ENV via nodeEnv getter', async () => {
      process.env.NODE_ENV = 'staging';
      const env = await freshEnv();
      expect(env.nodeEnv).toBe('staging');
    });

    it('isProduction is true when NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      const env = await freshEnv();
      expect(env.isProduction).toBe(true);
      expect(env.isDevelopment).toBe(false);
    });

    it('isProduction is false when NODE_ENV=development', async () => {
      process.env.NODE_ENV = 'development';
      const env = await freshEnv();
      expect(env.isProduction).toBe(false);
      expect(env.isDevelopment).toBe(true);
    });

    it('defaults NODE_ENV to development when env var is absent', async () => {
      delete process.env.NODE_ENV;
      const env = await freshEnv();
      expect(env.nodeEnv).toBe('development');
    });
  });

  // ─── port ────────────────────────────────────────────────────────────────────
  describe('port', () => {
    it('returns parsed PORT when set to a valid positive integer', async () => {
      process.env.PORT = '4000';
      const env = await freshEnv();
      expect(env.port).toBe(4000);
    });

    it('falls back to 3000 when PORT is not set', async () => {
      delete process.env.PORT;
      const env = await freshEnv();
      expect(env.port).toBe(3000);
    });

    it('falls back to 3000 when PORT is zero', async () => {
      process.env.PORT = '0';
      const env = await freshEnv();
      expect(env.port).toBe(3000);
    });

    it('falls back to 3000 when PORT is negative', async () => {
      process.env.PORT = '-1';
      const env = await freshEnv();
      expect(env.port).toBe(3000);
    });

    it('falls back to 3000 when PORT is non-numeric', async () => {
      process.env.PORT = 'abc';
      const env = await freshEnv();
      expect(env.port).toBe(3000);
    });
  });

  // ─── databaseUrl ─────────────────────────────────────────────────────────────
  describe('databaseUrl', () => {
    it('returns DATABASE_URL when set', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
      const env = await freshEnv();
      expect(env.databaseUrl).toBe('postgresql://user:pass@localhost/db');
    });

    it('throws when DATABASE_URL is missing', async () => {
      delete process.env.DATABASE_URL;
      const env = await freshEnv();
      expect(() => env.databaseUrl).toThrow('DATABASE_URL is required');
    });
  });

  // ─── jwtSecret ───────────────────────────────────────────────────────────────
  describe('jwtSecret', () => {
    it('returns JWT_SECRET when set', async () => {
      process.env.JWT_SECRET = 'my-secret';
      const env = await freshEnv();
      expect(env.jwtSecret).toBe('my-secret');
    });

    it('throws when JWT_SECRET is missing', async () => {
      delete process.env.JWT_SECRET;
      const env = await freshEnv();
      expect(() => env.jwtSecret).toThrow('JWT_SECRET');
    });
  });

  // ─── jwtExpiresIn ────────────────────────────────────────────────────────────
  describe('jwtExpiresIn', () => {
    it('returns JWT_EXPIRES_IN when set', async () => {
      process.env.JWT_EXPIRES_IN = '30d';
      const env = await freshEnv();
      expect(env.jwtExpiresIn).toBe('30d');
    });

    it('defaults to 7d when not set', async () => {
      delete process.env.JWT_EXPIRES_IN;
      const env = await freshEnv();
      expect(env.jwtExpiresIn).toBe('7d');
    });
  });

  // ─── mqttDisabled ────────────────────────────────────────────────────────────
  describe('mqttDisabled', () => {
    it('returns true when MQTT_DISABLED=true', async () => {
      process.env.MQTT_DISABLED = 'true';
      const env = await freshEnv();
      expect(env.mqttDisabled).toBe(true);
    });

    it('returns false when MQTT_DISABLED is not set', async () => {
      delete process.env.MQTT_DISABLED;
      const env = await freshEnv();
      expect(env.mqttDisabled).toBe(false);
    });
  });

  // ─── mqttBrokerUrl ───────────────────────────────────────────────────────────
  describe('mqttBrokerUrl', () => {
    it('returns MQTT_BROKER_URL when set', async () => {
      process.env.MQTT_BROKER_URL = 'mqtt://broker:1883';
      const env = await freshEnv();
      expect(env.mqttBrokerUrl).toBe('mqtt://broker:1883');
    });

    it('defaults to mqtt://localhost:1883 when not set', async () => {
      delete process.env.MQTT_BROKER_URL;
      const env = await freshEnv();
      expect(env.mqttBrokerUrl).toBe('mqtt://localhost:1883');
    });
  });

  // ─── mqttUsername / mqttPassword ─────────────────────────────────────────────
  describe('mqttUsername / mqttPassword', () => {
    it('returns MQTT_USERNAME when set', async () => {
      process.env.MQTT_USERNAME = 'mqttuser';
      const env = await freshEnv();
      expect(env.mqttUsername).toBe('mqttuser');
    });

    it('returns undefined when MQTT_USERNAME is not set', async () => {
      delete process.env.MQTT_USERNAME;
      const env = await freshEnv();
      expect(env.mqttUsername).toBeUndefined();
    });

    it('returns MQTT_PASSWORD when set', async () => {
      process.env.MQTT_PASSWORD = 'secret';
      const env = await freshEnv();
      expect(env.mqttPassword).toBe('secret');
    });

    it('returns undefined when MQTT_PASSWORD is not set', async () => {
      delete process.env.MQTT_PASSWORD;
      const env = await freshEnv();
      expect(env.mqttPassword).toBeUndefined();
    });
  });

  // ─── frontendUrl / adminUrl / apiBaseUrl ─────────────────────────────────────
  describe('frontendUrl / adminUrl / apiBaseUrl', () => {
    it('returns FRONTEND_URL when set', async () => {
      process.env.FRONTEND_URL = 'https://app.example.com';
      const env = await freshEnv();
      expect(env.frontendUrl).toBe('https://app.example.com');
    });

    it('defaults FRONTEND_URL to http://localhost:8081', async () => {
      delete process.env.FRONTEND_URL;
      const env = await freshEnv();
      expect(env.frontendUrl).toBe('http://localhost:8081');
    });

    it('returns ADMIN_URL when set', async () => {
      process.env.ADMIN_URL = 'https://admin.example.com';
      const env = await freshEnv();
      expect(env.adminUrl).toBe('https://admin.example.com');
    });

    it('defaults ADMIN_URL to http://localhost:5173', async () => {
      delete process.env.ADMIN_URL;
      const env = await freshEnv();
      expect(env.adminUrl).toBe('http://localhost:5173');
    });

    it('returns API_BASE_URL when set', async () => {
      process.env.API_BASE_URL = 'https://api.example.com';
      const env = await freshEnv();
      expect(env.apiBaseUrl).toBe('https://api.example.com');
    });

    it('returns undefined when API_BASE_URL is not set', async () => {
      delete process.env.API_BASE_URL;
      const env = await freshEnv();
      expect(env.apiBaseUrl).toBeUndefined();
    });
  });

  // ─── allowedOrigins ──────────────────────────────────────────────────────────
  describe('allowedOrigins', () => {
    it('includes FRONTEND_URL and ADMIN_URL', async () => {
      process.env.FRONTEND_URL = 'https://app.example.com';
      process.env.ADMIN_URL = 'https://admin.example.com';
      delete process.env.API_BASE_URL;
      const env = await freshEnv();
      expect(env.allowedOrigins).toContain('https://app.example.com');
      expect(env.allowedOrigins).toContain('https://admin.example.com');
    });

    it('includes API_BASE_URL when set', async () => {
      process.env.FRONTEND_URL = 'https://app.example.com';
      process.env.ADMIN_URL = 'https://admin.example.com';
      process.env.API_BASE_URL = 'https://api.example.com';
      const env = await freshEnv();
      expect(env.allowedOrigins).toContain('https://api.example.com');
    });

    it('deduplicates when FRONTEND_URL equals default', async () => {
      delete process.env.FRONTEND_URL;
      delete process.env.ADMIN_URL;
      delete process.env.API_BASE_URL;
      const env = await freshEnv();
      const origins = env.allowedOrigins;
      const unique = new Set(origins);
      expect(origins.length).toBe(unique.size);
    });
  });

  // ─── isKnownDevelopmentOrigin ─────────────────────────────────────────────────
  describe('isKnownDevelopmentOrigin', () => {
    it('returns true for http://localhost:3000', async () => {
      const env = await freshEnv();
      expect(env.isKnownDevelopmentOrigin('http://localhost:3000')).toBe(true);
    });

    it('returns true for http://127.0.0.1:8080', async () => {
      const env = await freshEnv();
      expect(env.isKnownDevelopmentOrigin('http://127.0.0.1:8080')).toBe(true);
    });

    it('returns true for http://192.168.1.5:19000', async () => {
      const env = await freshEnv();
      expect(env.isKnownDevelopmentOrigin('http://192.168.1.5:19000')).toBe(true);
    });

    it('returns true for http://10.0.0.1:3000', async () => {
      const env = await freshEnv();
      expect(env.isKnownDevelopmentOrigin('http://10.0.0.1:3000')).toBe(true);
    });

    it('returns true for exp:// origins', async () => {
      const env = await freshEnv();
      expect(env.isKnownDevelopmentOrigin('exp://192.168.1.1:19000')).toBe(true);
    });

    it('returns true for expo:// origins', async () => {
      const env = await freshEnv();
      expect(env.isKnownDevelopmentOrigin('expo://slug')).toBe(true);
    });

    it('returns false for https://example.com', async () => {
      const env = await freshEnv();
      expect(env.isKnownDevelopmentOrigin('https://example.com')).toBe(false);
    });
  });

  // ─── logLevel ────────────────────────────────────────────────────────────────
  describe('logLevel', () => {
    it('returns explicit LOG_LEVEL when set to a valid value', async () => {
      for (const level of ['debug', 'info', 'warn', 'error'] as const) {
        process.env.LOG_LEVEL = level;
        const env = await freshEnv();
        expect(env.logLevel).toBe(level);
        jest.resetModules();
      }
    });

    it('returns info in production when LOG_LEVEL is not set', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      const env = await freshEnv();
      expect(env.logLevel).toBe('info');
    });

    it('returns debug in development when LOG_LEVEL is not set', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_LEVEL;
      const env = await freshEnv();
      expect(env.logLevel).toBe('debug');
    });

    it('falls back to environment-based default for invalid LOG_LEVEL', async () => {
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'verbose'; // not a valid BackendLogLevel
      const env = await freshEnv();
      expect(env.logLevel).toBe('debug');
    });
  });

  // ─── resendApiKey / disableEmail / emailFrom ─────────────────────────────────
  describe('resendApiKey / disableEmail / emailFrom', () => {
    it('returns RESEND_API_KEY when set', async () => {
      process.env.RESEND_API_KEY = 're_abc123';
      const env = await freshEnv();
      expect(env.resendApiKey).toBe('re_abc123');
    });

    it('returns undefined when RESEND_API_KEY is not set', async () => {
      delete process.env.RESEND_API_KEY;
      const env = await freshEnv();
      expect(env.resendApiKey).toBeUndefined();
    });

    it('returns true when DISABLE_EMAIL=true', async () => {
      process.env.DISABLE_EMAIL = 'true';
      const env = await freshEnv();
      expect(env.disableEmail).toBe(true);
    });

    it('returns false when DISABLE_EMAIL is not set', async () => {
      delete process.env.DISABLE_EMAIL;
      const env = await freshEnv();
      expect(env.disableEmail).toBe(false);
    });

    it('returns EMAIL_FROM when set', async () => {
      process.env.EMAIL_FROM = 'Test <test@example.com>';
      const env = await freshEnv();
      expect(env.emailFrom).toBe('Test <test@example.com>');
    });

    it('defaults EMAIL_FROM to the FallHelp default', async () => {
      delete process.env.EMAIL_FROM;
      const env = await freshEnv();
      expect(env.emailFrom).toContain('FallHelp');
    });
  });

  // ─── numeric thresholds ──────────────────────────────────────────────────────
  describe('numeric threshold getters', () => {
    it('wifiConfiguringStaleMs uses parsePositiveInt with 120000 default', async () => {
      delete process.env.WIFI_CONFIGURING_STALE_MS;
      const env = await freshEnv();
      expect(env.wifiConfiguringStaleMs).toBe(120000);
    });

    it('wifiConfiguringStaleMs returns custom value', async () => {
      process.env.WIFI_CONFIGURING_STALE_MS = '60000';
      const env = await freshEnv();
      expect(env.wifiConfiguringStaleMs).toBe(60000);
    });

    it('mqttConfigAckTimeoutMs uses 15000 default', async () => {
      delete process.env.MQTT_CONFIG_ACK_TIMEOUT_MS;
      const env = await freshEnv();
      expect(env.mqttConfigAckTimeoutMs).toBe(15000);
    });

    it('deviceOnlineThresholdMs uses 15000 default', async () => {
      delete process.env.DEVICE_ONLINE_THRESHOLD_MS;
      const env = await freshEnv();
      expect(env.deviceOnlineThresholdMs).toBe(15000);
    });
  });

  // ─── packageVersion / raw ────────────────────────────────────────────────────
  describe('packageVersion / raw', () => {
    it('returns npm_package_version when set', async () => {
      process.env.npm_package_version = '2.3.4';
      const env = await freshEnv();
      expect(env.packageVersion).toBe('2.3.4');
    });

    it('defaults to 1.0.0 when npm_package_version is absent', async () => {
      delete process.env.npm_package_version;
      const env = await freshEnv();
      expect(env.packageVersion).toBe('1.0.0');
    });

    it('raw returns process.env', async () => {
      const env = await freshEnv();
      expect(env.raw).toBe(process.env);
    });
  });
});
