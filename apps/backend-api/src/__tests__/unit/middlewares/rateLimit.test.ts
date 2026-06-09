/**
 * rateLimit.ts unit tests
 * Verifies that all four rate-limit middleware exports are callable functions.
 * The actual rate-limiting logic is provided by express-rate-limit and does
 * not need to be re-tested here.
 */

// env.ts reads process.env at getter-call time, so we can control the env
// before importing rateLimit (which reads backendEnv.isProduction at module load).

describe('rateLimit middleware — development mode (default in tests)', () => {
  let apiLimiter: unknown;
  let authLimiter: unknown;
  let loginLimiter: unknown;
  let otpLimiter: unknown;

  beforeAll(async () => {
    // NODE_ENV is already 'test' (set by setup.ts), which makes isProduction=false
    ({ apiLimiter, authLimiter, loginLimiter, otpLimiter } =
      await import('../../../middlewares/rateLimit'));
  });

  it('apiLimiter is a function', () => {
    expect(typeof apiLimiter).toBe('function');
  });

  it('authLimiter is a function', () => {
    expect(typeof authLimiter).toBe('function');
  });

  it('loginLimiter is a function', () => {
    expect(typeof loginLimiter).toBe('function');
  });

  it('otpLimiter is a function', () => {
    expect(typeof otpLimiter).toBe('function');
  });
});

describe('rateLimit middleware — production mode', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
    // Reset the module so rateLimit.ts re-evaluates isProduction at module load
    jest.resetModules();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  it('all four limiters are still functions in production mode', async () => {
    const { apiLimiter, authLimiter, loginLimiter, otpLimiter } =
      await import('../../../middlewares/rateLimit');
    expect(typeof apiLimiter).toBe('function');
    expect(typeof authLimiter).toBe('function');
    expect(typeof loginLimiter).toBe('function');
    expect(typeof otpLimiter).toBe('function');
  });
});
