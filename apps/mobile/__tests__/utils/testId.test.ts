/**
 * testId Utility Tests
 * Tests: generation of stable test identifiers for E2E testing
 */
import { buildScreenTestId } from '../../utils/testId';

describe('testId utils', () => {
  it('returns root for empty segments', () => {
    expect(buildScreenTestId([])).toBe('screen:/');
  });

  it('builds screen id from segments', () => {
    expect(buildScreenTestId(['(tabs)', 'history'])).toBe('screen:/(tabs)/history');
  });
});
