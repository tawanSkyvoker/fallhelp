/**
 * AuthContext — isSignedIn lifecycle, signIn, signOut
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import {
  clearAllSetupForCurrentUser,
  clearScopeCache,
  clearBootCache,
} from '../../utils/setupStorage';
import { logout as logoutFromBackend } from '../../services/authService';

jest.mock('../../utils/setupStorage', () => ({
  __esModule: true,
  clearSetupTransientForCurrentUser: jest.fn(async () => {}),
  clearScopeCache: jest.fn(),
  clearBootCache: jest.fn(),
  clearAllSetupForCurrentUser: jest.fn(async () => {}),
}));

jest.mock('../../services/authService', () => ({
  __esModule: true,
  logout: jest.fn(async () => {}),
}));

const mockClearAllSetupForCurrentUser = clearAllSetupForCurrentUser as jest.Mock;
const mockClearScopeCache = clearScopeCache as jest.Mock;
const mockClearBootCache = clearBootCache as jest.Mock;
const mockLogoutFromBackend = logoutFromBackend as jest.Mock;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts as not signed in when no token in storage', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // After bootstrap resolves
      await act(async () => {});
      expect(result.current.isSignedIn).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('starts as signed in when token exists in storage', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('existing-token');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {});
      expect(result.current.isSignedIn).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('skips token read when initialSignedIn is provided', async () => {
      const wrapperWithInitial = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider initialSignedIn={true}>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper: wrapperWithInitial });

      expect(result.current.isSignedIn).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('stores token and sets isSignedIn to true', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {});

      await act(async () => {
        await result.current.signIn('new-jwt-token');
      });

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'fallhelp_auth_token',
        'new-jwt-token',
      );
      expect(result.current.isSignedIn).toBe(true);
    });

    it('clears boot cache on signIn', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {});

      await act(async () => {
        await result.current.signIn('token');
      });

      expect(mockClearBootCache).toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('clears token and sets isSignedIn to false', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('existing-token');

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {});
      expect(result.current.isSignedIn).toBe(true);

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockLogoutFromBackend).toHaveBeenCalled();
      expect(result.current.isSignedIn).toBe(false);
    });

    it('clears setup data and caches on signOut', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('token');

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {});

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockClearAllSetupForCurrentUser).toHaveBeenCalled();
      expect(mockClearScopeCache).toHaveBeenCalled();
      expect(mockClearBootCache).toHaveBeenCalled();
    });

    it('clears setup data before backend logout clears the token', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('token');
      const calls: string[] = [];
      mockClearAllSetupForCurrentUser.mockImplementationOnce(async () => {
        calls.push('clear-setup');
      });
      mockLogoutFromBackend.mockImplementationOnce(async () => {
        calls.push('backend-logout');
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      await act(async () => {});

      await act(async () => {
        await result.current.signOut();
      });

      expect(calls).toEqual(['clear-setup', 'backend-logout']);
    });
  });
});
