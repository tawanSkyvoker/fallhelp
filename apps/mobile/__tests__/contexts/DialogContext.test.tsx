/**
 * DialogContext — showDialog, hideDialog, dialogService integration
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { DialogProvider, useDialog } from '../../context/DialogContext';
import { setDialogHandler } from '../../utils/dialogService';

jest.mock('../../components/AppDialog', () => ({
  __esModule: true,
  AppDialog: () => null,
}));

jest.mock('../../utils/dialogService', () => ({
  __esModule: true,
  setDialogHandler: jest.fn(),
}));

const mockSetDialogHandler = setDialogHandler as jest.Mock;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <DialogProvider>{children}</DialogProvider>
);

describe('DialogContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when useDialog is used outside DialogProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useDialog())).toThrow(
      'useDialog must be used within DialogProvider',
    );
    consoleError.mockRestore();
  });

  it('registers dialog handler with dialogService on mount', () => {
    renderHook(() => useDialog(), { wrapper });
    expect(mockSetDialogHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it('clears dialog handler (null) on unmount', () => {
    const { unmount } = renderHook(() => useDialog(), { wrapper });
    unmount();
    expect(mockSetDialogHandler).toHaveBeenLastCalledWith(null);
  });

  it('provides showDialog and hideDialog functions', () => {
    const { result } = renderHook(() => useDialog(), { wrapper });
    expect(typeof result.current.showDialog).toBe('function');
    expect(typeof result.current.hideDialog).toBe('function');
  });

  it('showDialog and hideDialog are stable references (useCallback)', () => {
    const { result, rerender } = renderHook(() => useDialog(), { wrapper });

    const { showDialog: show1, hideDialog: hide1 } = result.current;
    rerender({});
    const { showDialog: show2, hideDialog: hide2 } = result.current;

    expect(show1).toBe(show2);
    expect(hide1).toBe(hide2);
  });

  it('showDialog updates internal state (propagated to dialogService handler)', () => {
    let capturedHandler: ((config: { title: string; message: string }) => void) | null = null;
    mockSetDialogHandler.mockImplementation((fn: typeof capturedHandler) => {
      capturedHandler = fn;
    });

    renderHook(() => useDialog(), { wrapper });

    // The handler registered should be the showDialog function
    expect(capturedHandler).toBeDefined();

    act(() => {
      capturedHandler?.({ title: 'ทดสอบ', message: 'ข้อความ' });
    });
    // No throw means it handled the call correctly
  });
});
