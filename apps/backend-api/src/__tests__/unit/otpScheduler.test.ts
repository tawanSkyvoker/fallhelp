/**
 * otpScheduler Tests
 * Tests: initSchedulers — OTP cleanup scheduling on startup
 */

const mockCleanupExpiredOtps = jest.fn();
const mockLogInfo = jest.fn();

jest.mock('../../services/authService', () => ({
  cleanupExpiredOtps: mockCleanupExpiredOtps,
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: mockLogInfo, error: jest.fn() },
}));

const mockRecoverInconsistentDevices = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/adminService', () => ({
  recoverInconsistentDevices: mockRecoverInconsistentDevices,
}));

jest.mock('debug', () => {
  const fn = () => {};
  return { __esModule: true, default: () => fn };
});

describe('otpScheduler', () => {
  let setIntervalSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockReturnValue(0 as unknown as ReturnType<typeof setInterval>);
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
  });

  it('should call cleanupExpiredOtps immediately on initSchedulers', async () => {
    mockCleanupExpiredOtps.mockResolvedValue(undefined);

    const { initSchedulers } = await import('../../schedulers/otpScheduler');
    initSchedulers();

    // Give the microtask queue a chance to run
    await Promise.resolve();

    expect(mockCleanupExpiredOtps).toHaveBeenCalledTimes(1);
    expect(mockRecoverInconsistentDevices).toHaveBeenCalledTimes(1);
  });

  it('should set up a setInterval for periodic cleanup', async () => {
    mockCleanupExpiredOtps.mockResolvedValue(undefined);

    const { initSchedulers } = await import('../../schedulers/otpScheduler');
    initSchedulers();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    // Interval should be 1 hour in milliseconds
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);
  });

  it('should call logger.info twice (scheduler registered + initialized)', async () => {
    mockCleanupExpiredOtps.mockResolvedValue(undefined);

    const { initSchedulers } = await import('../../schedulers/otpScheduler');
    initSchedulers();

    expect(mockLogInfo).toHaveBeenCalledTimes(2);
    expect(mockLogInfo).toHaveBeenNthCalledWith(
      1,
      'OTP cleanup scheduler registered',
      expect.objectContaining({ schedule: expect.any(String) }),
    );
    expect(mockLogInfo).toHaveBeenNthCalledWith(2, 'OTP scheduler initialized');
  });

  it('should not throw when cleanupExpiredOtps rejects on startup', async () => {
    mockCleanupExpiredOtps.mockRejectedValue(new Error('DB connection failed'));

    const { initSchedulers } = await import('../../schedulers/otpScheduler');

    // Should not throw — error is caught internally via .catch()
    expect(() => initSchedulers()).not.toThrow();

    // Allow the rejected promise microtask to settle without unhandled rejection
    await Promise.resolve();
  });

  it('should cover the setInterval callback body (success path)', async () => {
    mockCleanupExpiredOtps.mockResolvedValue(undefined);

    let capturedCallback: (() => Promise<void>) | null = null;
    // Override spy for this test to capture the callback
    setIntervalSpy.mockImplementation((fn: () => Promise<void>) => {
      capturedCallback = fn;
      return 0 as unknown as ReturnType<typeof setInterval>;
    });

    const { initSchedulers } = await import('../../schedulers/otpScheduler');
    initSchedulers();

    expect(capturedCallback).not.toBeNull();
    // Run the interval callback to cover lines 20-22
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await capturedCallback!();
    expect(mockCleanupExpiredOtps).toHaveBeenCalledTimes(2); // once on startup + once in interval
  });

  it('should cover the setInterval callback error path', async () => {
    mockCleanupExpiredOtps
      .mockResolvedValueOnce(undefined) // initial immediate call
      .mockRejectedValueOnce(new Error('periodic cleanup failed'));

    let capturedCallback: (() => Promise<void>) | null = null;
    setIntervalSpy.mockImplementation((fn: () => Promise<void>) => {
      capturedCallback = fn;
      return 0 as unknown as ReturnType<typeof setInterval>;
    });

    const { initSchedulers } = await import('../../schedulers/otpScheduler');
    initSchedulers();

    // Run the interval callback — error is caught, should not throw (covers lines 22-24)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await expect(capturedCallback!()).resolves.toBeUndefined();
  });
});
