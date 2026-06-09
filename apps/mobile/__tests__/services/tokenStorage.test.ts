/**
 * tokenStorage.ts — setToken, getToken, clearToken tests
 * expo-secure-store is already mocked in jest.setup.ts
 */
import * as SecureStore from 'expo-secure-store';
import { setToken, getToken, clearToken } from '../../services/tokenStorage';

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('tokenStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setToken', () => {
    it('stores token via SecureStore on native', async () => {
      await setToken('my-jwt-token');
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'fallhelp_auth_token',
        'my-jwt-token',
      );
    });
  });

  describe('getToken', () => {
    it('retrieves token from SecureStore', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('stored-token');
      const token = await getToken();
      expect(token).toBe('stored-token');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('fallhelp_auth_token');
    });

    it('returns null when no token stored', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      const token = await getToken();
      expect(token).toBeNull();
    });
  });

  describe('clearToken', () => {
    it('deletes token from SecureStore', async () => {
      await clearToken();
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('fallhelp_auth_token');
    });
  });
});
