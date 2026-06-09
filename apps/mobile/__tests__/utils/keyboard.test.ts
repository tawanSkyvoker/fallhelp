/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Keyboard Dismiss Utility Tests
 * Tests: runAfterKeyboardDismiss helper function behavior
 */
import { Keyboard, TextInput, type EmitterSubscription } from 'react-native';
import { runAfterKeyboardDismiss } from '../../utils/keyboard';

describe('runAfterKeyboardDismiss', () => {
  let mockCallback: jest.Mock;
  let currentlyFocusedSpy: jest.SpyInstance;
  let currentlyFocusedFieldSpy: jest.SpyInstance;
  let keyboardMetricsSpy: jest.SpyInstance;
  let keyboardDismissSpy: jest.SpyInstance;
  let keyboardAddListenerSpy: jest.SpyInstance;
  let keyboardIsVisibleSpy: jest.SpyInstance;

  beforeEach(() => {
    mockCallback = jest.fn();
    jest.useFakeTimers();

    // เช็คก่อนว่า Keyboard.isVisible มีฟังก์ชันนี้ไหม ถ้าไม่มีก็ mocked ให้มี
    if (!(Keyboard as any).isVisible) {
      (Keyboard as any).isVisible = () => false;
    }

    // สร้าง Spies เพื่อจำลองพฤติกรรมโดยไม่กระทบกับ Native Modules
    currentlyFocusedSpy = jest
      .spyOn(TextInput.State, 'currentlyFocusedInput')
      .mockImplementation(() => null as any);
    currentlyFocusedFieldSpy = jest
      .spyOn(TextInput.State, 'currentlyFocusedField')
      .mockImplementation(() => null as any);
    keyboardMetricsSpy = jest.spyOn(Keyboard, 'metrics').mockImplementation(() => ({
      height: 0,
      width: 0,
      screenX: 0,
      screenY: 0,
    }));
    keyboardDismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    keyboardAddListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation(
      () =>
        ({
          remove: jest.fn(),
        }) as unknown as EmitterSubscription,
    );
    keyboardIsVisibleSpy = jest.spyOn(Keyboard as any, 'isVisible').mockImplementation(() => false);
  });

  afterEach(() => {
    currentlyFocusedSpy.mockRestore();
    currentlyFocusedFieldSpy.mockRestore();
    keyboardMetricsSpy.mockRestore();
    keyboardDismissSpy.mockRestore();
    keyboardAddListenerSpy.mockRestore();
    keyboardIsVisibleSpy.mockRestore();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('runs callback immediately when no input is focused (keyboard not visible)', () => {
    currentlyFocusedSpy.mockReturnValue(null as any);
    currentlyFocusedFieldSpy.mockReturnValue(null as any);
    keyboardIsVisibleSpy.mockReturnValue(false);
    keyboardMetricsSpy.mockReturnValue({ height: 0, width: 0, screenX: 0, screenY: 0 });

    const cleanup = runAfterKeyboardDismiss(mockCallback);

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(keyboardDismissSpy).not.toHaveBeenCalled();
    cleanup();
  });

  it('waits for keyboardDidHide when an input is focused and keyboard metrics indicate visible height', () => {
    currentlyFocusedSpy.mockReturnValue({} as any);
    keyboardIsVisibleSpy.mockReturnValue(true);
    keyboardMetricsSpy.mockReturnValue({ height: 300, width: 360, screenX: 0, screenY: 500 });

    let keyboardHideCallback: (() => void) | null = null;
    keyboardAddListenerSpy.mockImplementation((event, cb) => {
      if (event === 'keyboardDidHide') {
        keyboardHideCallback = cb;
      }
      return { remove: jest.fn() } as unknown as EmitterSubscription;
    });

    const cleanup = runAfterKeyboardDismiss(mockCallback);

    expect(mockCallback).not.toHaveBeenCalled();
    expect(keyboardDismissSpy).toHaveBeenCalledTimes(1);
    expect(keyboardAddListenerSpy).toHaveBeenCalledWith('keyboardDidHide', expect.any(Function));

    // จำลอง event keyboardDidHide
    if (keyboardHideCallback) {
      (keyboardHideCallback as () => void)();
    }

    // รัน timers
    jest.runAllTimers();

    expect(mockCallback).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('triggers fallback after maxWaitMs if keyboardDidHide does not fire', () => {
    currentlyFocusedSpy.mockReturnValue({} as any);
    keyboardIsVisibleSpy.mockReturnValue(true);
    keyboardMetricsSpy.mockReturnValue({ height: 300, width: 360, screenX: 0, screenY: 500 });

    const cleanup = runAfterKeyboardDismiss(mockCallback, { maxWaitMs: 320 });

    expect(mockCallback).not.toHaveBeenCalled();

    // เลื่อนเวลาไป 320ms เพื่อให้ fallback timer ทำงาน
    jest.advanceTimersByTime(320);
    jest.runAllTimers();

    expect(mockCallback).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('does not run callback if cancelled/unmounted before keyboard hides', () => {
    currentlyFocusedSpy.mockReturnValue({} as any);
    keyboardIsVisibleSpy.mockReturnValue(true);
    keyboardMetricsSpy.mockReturnValue({ height: 300, width: 360, screenX: 0, screenY: 500 });

    let keyboardHideCallback: (() => void) | null = null;
    keyboardAddListenerSpy.mockImplementation((event, cb) => {
      if (event === 'keyboardDidHide') {
        keyboardHideCallback = cb;
      }
      return { remove: jest.fn() } as unknown as EmitterSubscription;
    });

    const cleanup = runAfterKeyboardDismiss(mockCallback);

    // ทำการยกเลิก (cancel / cleanup)
    cleanup();

    // จำลอง event keyboardDidHide
    if (keyboardHideCallback) {
      (keyboardHideCallback as () => void)();
    }

    jest.runAllTimers();

    expect(mockCallback).not.toHaveBeenCalled();
  });
});
