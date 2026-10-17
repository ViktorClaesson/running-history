import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayNumber,
  daysBetween,
  fmtDate,
  fmtShort,
  fromDayNumber,
  isoDate,
  localDateOf,
  parseIsoDate,
  todayLocal,
  weekdayMon0,
} from '../../src/lib/domain/dates';

describe('dates', () => {
  it('parses and validates calendar dates', () => {
    expect(parseIsoDate('2026-10-14')).toBe('2026-10-14');
    expect(parseIsoDate('2026-02-29')).toBeNull(); // not a leap year
    expect(parseIsoDate('2024-02-29')).toBe('2024-02-29');
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('14 Oct 2026')).toBeNull();
    expect(() => isoDate('nope')).toThrow();
  });

  it('takes the day of a late-evening run from the local wall clock, never via UTC', () => {
    // A real run of mine: 23:36 local is 21:36Z. The day is the 20th either way, but a
    // version that added the +2h offset to a UTC time would have put it on the 21st.
    expect(localDateOf('2023-07-20T23:36:46')).toBe('2023-07-20');
    expect(localDateOf('2024-01-01T23:59:59')).toBe('2024-01-01');
    expect(localDateOf('2024-03-01T00:00:01')).toBe('2024-03-01');
  });

  it('round-trips day numbers across DST changes and leap days', () => {
    expect(dayNumber(isoDate('1970-01-01'))).toBe(0);
    for (const d of ['2024-02-29', '2026-03-29', '2026-10-25', '2023-01-30']) {
      expect(fromDayNumber(dayNumber(isoDate(d)))).toBe(d);
    }
    // The DST weekends must not gain or lose a day.
    expect(daysBetween(isoDate('2026-03-28'), isoDate('2026-03-30'))).toBe(2);
    expect(daysBetween(isoDate('2026-10-24'), isoDate('2026-10-26'))).toBe(2);
    expect(addDays(isoDate('2024-02-28'), 1)).toBe('2024-02-29');
    expect(addDays(isoDate('2026-01-01'), -3)).toBe('2025-12-29');
  });

  it('formats like the legacy app', () => {
    expect(fmtDate(isoDate('2026-10-14'))).toBe('14 Oct 2026 (Wed)');
    expect(fmtShort(isoDate('2026-10-04'))).toBe('4 Oct 2026');
    expect(weekdayMon0(isoDate('2026-10-12'))).toBe(0); // a Monday
    expect(weekdayMon0(isoDate('2026-10-18'))).toBe(6); // a Sunday
  });

  it('reads today from the local clock', () => {
    expect(todayLocal(new Date(2026, 9, 17, 23, 30))).toBe('2026-10-17');
    expect(todayLocal(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
  });
});
