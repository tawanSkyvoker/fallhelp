/**
 * safeRouter Utility Tests
 * Tests: navigation safety guards and route parameter normalization
 */
import * as safeRouterModule from '../../utils/safeRouter';

type MockRouterMethods = {
  canGoBack: jest.Mock;
  push: jest.Mock;
  replace: jest.Mock;
  back: jest.Mock;
  setParams: jest.Mock;
  dismiss: jest.Mock;
  dismissAll: jest.Mock;
  dismissTo: jest.Mock;
  navigate: jest.Mock;
  prefetch: jest.Mock;
  reload: jest.Mock;
};

let mockOriginalRouterMethods: MockRouterMethods;

jest.mock('expo-router', () => {
  mockOriginalRouterMethods = {
    canGoBack: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    setParams: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    dismissTo: jest.fn(),
    navigate: jest.fn(),
    prefetch: jest.fn(),
    reload: jest.fn(),
  };
  return { router: { ...mockOriginalRouterMethods } };
});

const { safeRouter, setNavigationReady } = safeRouterModule;

describe('safeRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNavigationReady(false);
    globalThis.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false when navigation is not ready', () => {
    setNavigationReady(false);
    expect(safeRouter.canGoBack()).toBe(false);
  });

  it('delegates canGoBack when navigation is ready', () => {
    mockOriginalRouterMethods.canGoBack.mockReturnValue(true);
    setNavigationReady(true);
    expect(safeRouter.canGoBack()).toBe(true);
  });

  it('blocks duplicate push calls to the same route within guard window', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1000;
    nowSpy.mockImplementation(() => now);

    setNavigationReady(true);
    safeRouter.push('/(tabs)');
    safeRouter.push('/(tabs)');

    expect(mockOriginalRouterMethods.push).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });

  it('allows push again after guard window', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 5000;
    nowSpy.mockImplementation(() => now);

    setNavigationReady(true);
    safeRouter.push('/(tabs)');
    now += 1300;
    safeRouter.push('/(tabs)');

    expect(mockOriginalRouterMethods.push).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('does not block navigation to different routes', () => {
    setNavigationReady(true);

    safeRouter.push('/(tabs)');
    safeRouter.push('/(auth)/login');

    expect(mockOriginalRouterMethods.push).toHaveBeenCalledTimes(2);
  });
});
