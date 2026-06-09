/**
 * Jest Test Setup
 * FallHelp Backend Safety Net Testing
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '7d';
process.env.MQTT_DISABLED = 'true';
process.env.DEVICE_ONLINE_THRESHOLD_MS = '15000';

// Global test timeout
jest.setTimeout(30000);

// Global mock for mqtt (ESM v5 package)
jest.mock('mqtt', () => {
  return {
    connect: jest.fn(() => ({
      on: jest.fn(),
      subscribe: jest.fn(),
      publish: jest.fn(),
      end: jest.fn(),
    })),
  };
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});
