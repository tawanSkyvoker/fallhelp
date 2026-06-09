/**
 * origin.ts unit tests
 * Verifies isAllowedClientOrigin under development and production environments.
 */

// We control process.env before each scenario and re-import the module to get
// fresh instances of backendEnv (which uses getters reading process.env).

describe('isAllowedClientOrigin', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  // ─── No origin (mobile native client) ───────────────────────────────────────
  it('returns true when origin is undefined (native mobile)', async () => {
    process.env.NODE_ENV = 'test';
    const { isAllowedClientOrigin } = await import('../../../config/origin');
    expect(isAllowedClientOrigin(undefined)).toBe(true);
  });

  it('returns true when origin is empty string (treated as falsy)', async () => {
    process.env.NODE_ENV = 'test';
    const { isAllowedClientOrigin } = await import('../../../config/origin');
    // empty string is falsy — treated same as undefined
    expect(isAllowedClientOrigin('')).toBe(true);
  });

  // ─── Development mode ────────────────────────────────────────────────────────
  describe('development / test mode (isDevelopment=true)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      jest.resetModules();
    });

    it('allows http://localhost: origins', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('http://localhost:3000')).toBe(true);
    });

    it('allows http://127.0.0.1: origins', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('http://127.0.0.1:8080')).toBe(true);
    });

    it('allows http://192.168. origins', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('http://192.168.1.100:3000')).toBe(true);
    });

    it('allows http://10. origins', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('http://10.0.0.1:19000')).toBe(true);
    });

    it('allows exp:// origins (Expo Go)', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('exp://192.168.1.1:19000')).toBe(true);
    });

    it('allows expo:// origins', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('expo://some-slug')).toBe(true);
    });

    it('rejects unknown origins in development', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('https://evil.example.com')).toBe(false);
    });

    it('rejects https://example.com in development', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('https://example.com')).toBe(false);
    });

    it('allows TUNNEL_PUBLIC_HOSTNAME origins in development', async () => {
      process.env['TUNNEL_PUBLIC_HOSTNAME'] = 'api.tawanlab.site';
      jest.resetModules();
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('https://api.tawanlab.site')).toBe(true);
      expect(isAllowedClientOrigin('http://api.tawanlab.site')).toBe(true);
      delete process.env['TUNNEL_PUBLIC_HOSTNAME'];
    });
  });

  // ─── Production mode ─────────────────────────────────────────────────────────
  describe('production mode (isDevelopment=false)', () => {
    const FRONTEND = 'https://app.fallhelp.tawanlab.site';
    const ADMIN = 'https://admin.fallhelp.tawanlab.site';

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = FRONTEND;
      process.env.ADMIN_URL = ADMIN;
      delete process.env.API_BASE_URL;
      jest.resetModules();
    });

    afterEach(() => {
      delete process.env.FRONTEND_URL;
      delete process.env.ADMIN_URL;
    });

    it('allows the configured FRONTEND_URL', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin(FRONTEND)).toBe(true);
    });

    it('allows the configured ADMIN_URL', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin(ADMIN)).toBe(true);
    });

    it('rejects an origin not in allowedOrigins', async () => {
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('https://evil.example.com')).toBe(false);
    });

    it('allows API_BASE_URL when configured', async () => {
      process.env.API_BASE_URL = 'https://api.fallhelp.tawanlab.site';
      jest.resetModules();
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('https://api.fallhelp.tawanlab.site')).toBe(true);
      delete process.env.API_BASE_URL;
    });

    it('allows TUNNEL_PUBLIC_HOSTNAME origins in production', async () => {
      process.env['TUNNEL_PUBLIC_HOSTNAME'] = 'api.tawanlab.site';
      jest.resetModules();
      const { isAllowedClientOrigin } = await import('../../../config/origin');
      expect(isAllowedClientOrigin('https://api.tawanlab.site')).toBe(true);
      expect(isAllowedClientOrigin('http://api.tawanlab.site')).toBe(true);
      delete process.env['TUNNEL_PUBLIC_HOSTNAME'];
    });
  });
});
