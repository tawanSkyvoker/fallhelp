/**
 * param Utility Tests
 * Tests: toStringParam normalizes Express route/query params to string
 */

import { toStringParam } from '../../../utils/param';

describe('toStringParam', () => {
  it('should return empty string for undefined', () => {
    expect(toStringParam(undefined)).toBe('');
  });

  it('should return the string as-is for a plain string', () => {
    expect(toStringParam('hello')).toBe('hello');
  });

  it('should return empty string for empty string input', () => {
    expect(toStringParam('')).toBe('');
  });

  it('should return the first element of an array', () => {
    expect(toStringParam(['first', 'second', 'third'])).toBe('first');
  });

  it('should return the first element of a single-element array', () => {
    expect(toStringParam(['only'])).toBe('only');
  });

  it('should return first element even if it is empty string', () => {
    expect(toStringParam(['', 'second'])).toBe('');
  });

  it('should work with UUID-style strings', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(toStringParam(uuid)).toBe(uuid);
  });
});
