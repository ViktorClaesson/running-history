import { describe, expect, it } from 'vitest';
import {
  fitPlan,
  maxRunsFor,
  PLAN_MAX_DAYS,
  targetFor,
  targetSeed,
  weekPlan,
  weekSlots,
} from '../../src/lib/domain/weeklyTarget';
import { evenRun, makeDaily } from '../helpers/daily';

const LONG = { long: true, weight: 2 };
const NOLONG = { long: false, weight: 2 };

describe('weekly target', () => {
  it('splits 60 km / 4 days / 6 runs into a 24 km long run and 7.2 km runs (w = 2), 20 / 8 at w = 1.5', () => {
    expect(targetFor({ km: 60, days: 4, runs: 6 }, LONG)).toMatchObject({
      long: true,
      longKm: 24,
      perRun: 7.2,
    });
    const t = targetFor({ km: 60, days: 4, runs: 6 }, { long: true, weight: 1.5 });
    expect(t.longKm).toBeCloseTo(20, 12);
    expect(t.perRun).toBeCloseTo(8, 12);
  });

  it('caps runs per days exactly as the legacy table', () => {
    const caps = (o: typeof LONG) => Array.from({ length: PLAN_MAX_DAYS }, (_, i) => maxRunsFor(i + 1, o));
    expect(caps(LONG)).toEqual([1, 2, 3, 7, 9, 14, 15]);
    expect(caps(NOLONG)).toEqual([1, 2, 3, 8, 10, 15, 16]);
  });

  it('every days × runs × weight × long combination sums to the weekly km', () => {
    for (const long of [true, false]) {
      for (let w10 = 10; w10 <= 30; w10++) {
        const o = { long, weight: w10 / 10 };
        for (let days = 1; days <= 7; days++) {
          for (let runs = days; runs <= maxRunsFor(days, o); runs++) {
            const week = weekPlan({ km: 63.7, days, runs }, o);
            expect(week.reduce((a, d) => a + d.km, 0)).toBeCloseTo(63.7, 12);
            expect(week.reduce((a, d) => a + d.runs, 0)).toBe(runs);
            if (long && days >= 3 && runs === days) {
              const t = targetFor({ km: 63.7, days, runs }, o);
              expect(t.longKm / t.perRun).toBeCloseTo(o.weight, 12);
            }
          }
        }
      }
    }
  });

  it('lays the template out by the rules', () => {
    // 5 days with a long run: Sat, Mon, Wed, Thu, Sun; extra runs Mon, Wed, Thu, Sun (Sat sits out).
    expect(weekSlots(5, LONG)).toEqual({ used: [5, 0, 2, 3, 6], slots: [0, 2, 3, 6] });
    // The legacy cap example: 6 days → 14 runs = 3+2+3+2+0+(L+1)+2, Monday first.
    const week = weekPlan({ km: 60, days: 6, runs: 14 }, LONG);
    expect(week.map((d) => d.runs)).toEqual([3, 2, 3, 2, 0, 2, 2]);
    expect(week[4]!.runs).toBe(0); // Friday rests below 7 days
    expect(week[5]!.long).toBe(true); // Saturday is L+1: the long run plus a short one
    expect(weekPlan({ km: 60, days: 7, runs: 16 }, NOLONG)[4]!.runs).toBe(1); // Friday never doubled
  });

  it('keeps an edited plan inside what a week can hold', () => {
    expect(fitPlan({ km: 50, days: 5, runs: 3 }, 'runs', LONG)).toEqual({ km: 50, days: 3, runs: 3 });
    expect(fitPlan({ km: 50, days: 4, runs: 12 }, 'runs', LONG)).toEqual({ km: 50, days: 6, runs: 12 });
    expect(fitPlan({ km: 50, days: 4, runs: 12 }, 'days', LONG)).toEqual({ km: 50, days: 4, runs: 7 });
    expect(fitPlan({ km: 900, days: 4.6, runs: 4.4 }, 'km', LONG)).toEqual({ km: 700, days: 5, runs: 5 });
  });

  it('seeds from the window ending yesterday when the last day is today', () => {
    const d = makeDaily([[evenRun(10, 300)], [], [evenRun(8, 300)], [evenRun(6, 300)]]);
    const s = targetSeed(d, 2, true); // days 1-2
    expect(s).toMatchObject({ kmSum: 8, runDays: 1, nRuns: 1, end: 2 });
    expect(s.km).toBeCloseTo(28, 12);
    expect(targetSeed(d, 2, false)).toMatchObject({ kmSum: 14, end: 3 });
  });
});
