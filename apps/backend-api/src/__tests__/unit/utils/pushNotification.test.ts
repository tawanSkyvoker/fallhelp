/**
 * pushNotification Utility Tests
 * Tests: token validation, single/multicast sending, response handling
 */

import { sendNotification } from '../../../utils/pushNotification';

const VALID_TOKEN_EXPO = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
const VALID_TOKEN_EAS = 'ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]';
const INVALID_TOKEN = 'InvalidToken123';

const PAYLOAD = { title: 'Test', body: 'Test body' };

// Helper to mock fetch response
function mockFetch(responseData: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    json: async () => responseData,
  });
}

describe('sendNotification', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return false for invalid token format', async () => {
    const result = await sendNotification(INVALID_TOKEN, PAYLOAD);
    expect(result).toBe(false);
  });

  it('should return false for empty token', async () => {
    const result = await sendNotification('', PAYLOAD);
    expect(result).toBe(false);
  });

  it('should return true for ExponentPushToken when API returns ok', async () => {
    mockFetch({ data: { status: 'ok' } });
    const result = await sendNotification(VALID_TOKEN_EXPO, PAYLOAD);
    expect(result).toBe(true);
  });

  it('should return true for ExpoPushToken format when API returns ok', async () => {
    mockFetch({ data: { status: 'ok' } });
    const result = await sendNotification(VALID_TOKEN_EAS, PAYLOAD);
    expect(result).toBe(true);
  });

  it('should return false when API returns non-ok status', async () => {
    mockFetch({ data: { status: 'error', message: 'DeviceNotRegistered' } });
    const result = await sendNotification(VALID_TOKEN_EXPO, PAYLOAD);
    expect(result).toBe(false);
  });

  it('should return false when API returns array result with error', async () => {
    mockFetch({ data: [{ status: 'error' }] });
    const result = await sendNotification(VALID_TOKEN_EXPO, PAYLOAD);
    expect(result).toBe(false);
  });

  it('should return true when API returns array result with ok', async () => {
    mockFetch({ data: [{ status: 'ok' }] });
    const result = await sendNotification(VALID_TOKEN_EXPO, PAYLOAD);
    expect(result).toBe(true);
  });

  it('should return false when fetch throws (network error)', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));
    const result = await sendNotification(VALID_TOKEN_EXPO, PAYLOAD);
    expect(result).toBe(false);
  });

  it('should call fetch with the Expo push API URL', async () => {
    mockFetch({ data: { status: 'ok' } });
    await sendNotification(VALID_TOKEN_EXPO, PAYLOAD);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.any(Object),
    );
  });

  it('should include payload data in fetch body', async () => {
    mockFetch({ data: { status: 'ok' } });
    await sendNotification(VALID_TOKEN_EXPO, {
      title: 'Alert',
      body: 'Message',
      data: { type: 'fall' },
    });
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.data).toEqual({ type: 'fall' });
  });
});
