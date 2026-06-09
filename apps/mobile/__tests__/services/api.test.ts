/**
 * api.ts — toApiError function tests
 * Tests error normalization for 3 response formats + non-axios errors
 */
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { toApiError } from '../../services/api';

const makeAxiosError = (
  status?: number,
  responseData?: unknown,
  code?: string,
  message = 'Request failed',
) => {
  const err = new axios.AxiosError(message);
  if (code !== undefined) {
    err.code = code;
  }
  if (status !== undefined) {
    err.response = {
      status,
      data: responseData,
      headers: {},
      config: {} as InternalAxiosRequestConfig,
      statusText: '',
    };
  }
  err.config = { method: 'get', url: '/test' } as InternalAxiosRequestConfig;
  return err;
};

describe('toApiError', () => {
  it('returns error as-is if already ApiError shape', () => {
    const existing = { status: 400, code: 'bad_request', message: 'Bad request' };
    expect(toApiError(existing)).toBe(existing);
  });

  it('normalizes Format 1: { error: { code, message } }', () => {
    const err = makeAxiosError(400, {
      error: { code: 'validation_error', message: 'ข้อมูลไม่ถูกต้อง' },
    });
    const result = toApiError(err);
    expect(result.message).toBe('ข้อมูลไม่ถูกต้อง');
    expect(result.code).toBe('validation_error');
    expect(result.status).toBe(400);
  });

  it('normalizes Format 2: { error: "string" }', () => {
    const err = makeAxiosError(404, { error: 'Not found' });
    const result = toApiError(err);
    expect(result.message).toBe('Not found');
    expect(result.status).toBe(404);
  });

  it('normalizes Format 3: { message: "string" }', () => {
    const err = makeAxiosError(500, { message: 'Internal server error' });
    const result = toApiError(err);
    expect(result.message).toBe('Internal server error');
    expect(result.status).toBe(500);
  });

  it('falls back to axios error message when no recognized format', () => {
    const err = makeAxiosError(503, { something: 'else' });
    const result = toApiError(err);
    expect(result.message).toBe('Request failed');
    expect(result.status).toBe(503);
  });

  it('handles network error (no response)', () => {
    const err = makeAxiosError(undefined, undefined, 'ERR_NETWORK', 'Network Error');
    const result = toApiError(err);
    expect(result.message).toBe('Network Error');
    expect(result.status).toBeUndefined();
  });

  it('handles plain Error (non-axios)', () => {
    const result = toApiError(new Error('Something went wrong'));
    expect(result.message).toBe('Something went wrong');
  });

  it('handles unknown error type', () => {
    const result = toApiError('string error');
    expect(result.message).toBe('Unknown error');
  });
});
