import { describe, expect, it } from 'vitest';
import { buildDaily } from '../../src/lib/domain/daily';
import { isoDate } from '../../src/lib/domain/dates';
import { DUST, perWeek, rollingSum } from '../../src/lib/domain/rolling';
import { classify, highestSlot } from '../../src/lib/domain/verdict';
import { buildWindows, windowSeries } from '../../src/lib/domain/windows';
import { evenRun, makeDaily } from '../helpers/daily';

/** A deterministic pseudo-random sequence, so the "random" tests are repeatable. */
function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

describe('rolling sums', () => {
  it('equal a brute-force sum over the window, and never go negative', () => {
    const r = rng(1);
    const v = Array.from({ length: 500 }, () => (r() < 0.5 ? 0 : Math.round(r() * 20000) / 1000));
    for (const w of [1, 7, 28, 112]) {
      const fast = rollingSum(v, w);
      for (let i = 0; i < v.length; i++) {
        let brute = 0;
        for (let j = Math.max(0, i - w + 1); j <= i; j++) brute += v[j]!;
        expect(fast[i]).toBeCloseTo(brute, 9);
        expect(fast[i]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('snaps float dust to an exact zero (no "-0.0 km")', () => {
    const v = [0.1, 0.2, 0.3, 0, 0, 0, 0, 0];
    const s = rollingSum(v, 3);
    expect(s[5]).toBe(0);
    expect(Object.is(s[7], 0)).toBe(true);
    expect(DUST).toBe(1e-9);
  });

  it('divides by the full window, so history ramps in from zero', () => {
    // One run on day one over a 64-week window is 1 × 7 / 448 = 0.016 a week, not 7 a week.
    expect(perWeek([1], 448)[0]).toBeCloseTo(7 / 448, 12);
  });
});

describe('windows', () => {
  it('derive 1/4/16/64 weeks from base 1 and multiple 4, keyed by slot', () => {
    expect(buildWindows(1, 4).map((w) => [w.key, w.weeks, w.days, w.label])).toEqual([
      ['s0', 1, 7, '1w'],
      ['s1', 4, 28, '4w'],
      ['s2', 16, 112, '16w'],
      ['s3', 64, 448, '64w'],
    ]);
    expect(buildWindows(2, 3).map((w) => w.weeks)).toEqual([2, 6, 18, 54]);
  });

  it('count a two-run day once for run days and twice for runs', () => {
    const daily = makeDaily([[evenRun(5, 300), evenRun(3, 300)], [], [evenRun(10, 300)]]);
    const s = windowSeries(daily, buildWindows(1, 4));
    expect(s.runDaysIn[0]![2]).toBe(2);
    expect(s.runsIn[0]![2]).toBe(3);
    expect(s.vol[0]![2]).toBeCloseTo(18, 9); // 18 km in a 1-week window = 18 km/week
    expect(s.freq[0]![2]).toBeCloseTo(2, 9);
    expect(s.runs[0]![2]).toBeCloseTo(3, 9);
  });

  it('run the daily series to today, with a late-evening run on its own day', () => {
    const run = {
      id: 'x',
      startLocal: '2026-10-10T23:36:46',
      localDate: isoDate('2026-10-10'),
      name: '',
      type: 'Run',
      distanceM: 5000,
      movingS: 1500,
      elapsedS: 1500,
      avgHr: null,
      elevGainM: null,
      changeMarker: '',
      fileSportIndex: 0,
    };
    const d = buildDaily([run], new Map(), isoDate('2026-10-17'))!;
    expect(d.n).toBe(8);
    expect(d.km[0]).toBe(5);
    expect(d.km[7]).toBe(0);
    expect(d.lastRunIdx).toBe(0);
  });
});

describe('verdict', () => {
  it('is the highest window, shortest winning ties, none on a rest day', () => {
    const vol = [[5], [5], [3], [1]].map((a) => Float64Array.from(a));
    expect(classify(vol, 4, 0)).toBe(0);
    expect(classify(vol, 0, 0)).toBeNull();
    const vol2 = [[1], [2], [9], [9]].map((a) => Float64Array.from(a));
    expect(classify(vol2, 4, 0)).toBe(2);
    expect(highestSlot(vol2, 0, [0, 1])).toBe(1); // the highlight reads only drawn lines
  });

  it('is the same function as the legacy ladder of rungs (re-derived, compared on random data)', () => {
    const r = rng(7);
    const ladder = (v: number[]) => {
      // slot k wins if it is >= every longer window and no shorter slot already won
      for (let k = 0; k < 4; k++) if (v.slice(k + 1).every((x) => v[k]! >= x)) return k;
      return 3;
    };
    for (let n = 0; n < 2000; n++) {
      const v = Array.from({ length: 4 }, () => Math.round(r() * 10) / 2);
      const vol = v.map((x) => Float64Array.of(x));
      expect(classify(vol, 1, 0)).toBe(ladder(v));
    }
  });
});
