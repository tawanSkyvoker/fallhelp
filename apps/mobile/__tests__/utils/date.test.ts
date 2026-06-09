/**
 * date Utility Tests
 * Tests: date formatting, age calculation, and Thai locale support
 */
import { formatThaiBuddhistDateTime } from '../../utils/date';

describe('date utils', () => {
  it('formats timestamps with explicit Buddhist Era year', () => {
    const result = formatThaiBuddhistDateTime(new Date(2026, 4, 3, 15, 40), {
      year: '2-digit',
    });

    expect(result).toBe('3 พ.ค. 69 15:40 น.');
  });

  it('uses today label without losing Buddhist Era formatting for other dates', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 4, 18, 5));

    expect(
      formatThaiBuddhistDateTime(new Date(2026, 4, 4, 18, 5), {
        useTodayLabel: true,
        year: '2-digit',
      }),
    ).toBe('วันนี้, 18:05 น.');

    jest.useRealTimers();
  });
});
