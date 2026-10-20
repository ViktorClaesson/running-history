import { describe, expect, it } from 'vitest';
import { ZONE_ANCHOR_PCT, enduranceFloorPct } from '../../src/lib/domain/paceZones';
import {
  dayVdots,
  impliedVdot,
  isNearMax,
  pctVo2max,
  rollingMax,
  velocityFromVo2,
  vdotVsPeak,
  vo2FromVelocity,
} from '../../src/lib/domain/vdot';
import { evenRun, makeDaily } from '../helpers/daily';

const paceMinKm = (vel: number) => 1000 / vel; // m/min → min/km
const mmss = (min: number) => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`;

describe('Daniels & Gilbert', () => {
  it('round-trips vdoto2.com: VDOT 51.8 gives 5:14 / 4:23 / 4:08 / 3:48 / 3:33 min/km', () => {
    const paces = ZONE_ANCHOR_PCT.map((p) => mmss(paceMinKm(velocityFromVo2(51.8 * p))));
    expect(paces).toEqual(['5:14', '4:23', '4:08', '3:48', '3:33']);
  });

  it('velocityFromVo2 inverts vo2FromVelocity', () => {
    for (const v of [150, 200, 250, 300, 350]) expect(velocityFromVo2(vo2FromVelocity(v))).toBeCloseTo(v, 9);
  });

  it('a 5 km race in 20:00 implies about VDOT 49.8', () => {
    // Daniels' tables: 5K 19:57 ≈ VDOT 50.
    expect(impliedVdot(5, 1200)).toBeCloseTo(49.8, 1);
    expect(pctVo2max(10000)).toBeCloseTo(0.8, 3);
  });
});

describe('day VDOT', () => {
  it('treats each run as its own effort, never the day glued together', () => {
    // Two 5 km runs at 4:00/km on one day: each implies the 5 km-in-20:00 VDOT. Glued into
    // one 10 km in 40:00 they would imply a much higher one.
    const d = makeDaily([[evenRun(5, 240), evenRun(5, 240)]]);
    const { value } = dayVdots(d, { minLapM: 1500, correction: 1, gap: false });
    expect(value[0]).toBeCloseTo(impliedVdot(5, 1200), 6);
    expect(value[0]).toBeLessThan(impliedVdot(10, 2400));
  });

  it('reads long-enough laps, ignores short ones, and applies the correction', () => {
    // Warm-up 2 km easy, a 1.6 km lap at 3:30/km, a 400 m lap at 3:00/km, cool-down 2 km.
    const run = [
      ...evenRun(2, 360).map((c) => ({ ...c, seg: 0 })),
      ...evenRun(1.6, 210).map((c) => ({ ...c, seg: 1 })),
      ...evenRun(0.4, 180).map((c) => ({ ...c, seg: 2 })),
      ...evenRun(2, 360).map((c) => ({ ...c, seg: 3 })),
    ];
    const d = makeDaily([[run]]);
    const lap = impliedVdot(1.6, 1.6 * 210);
    let r = dayVdots(d, { minLapM: 1500, correction: 1, gap: false });
    expect(r.value[0]).toBeCloseTo(lap, 6);
    expect(r.source[0]?.kind).toBe('lap');
    r = dayVdots(d, { minLapM: 1500, correction: 0.98, gap: false });
    expect(r.value[0]).toBeCloseTo(lap * 0.98, 6);
    // With the floor at 300 m, the 400 m sprint wins (that's why the floor exists).
    r = dayVdots(d, { minLapM: 300, correction: 1, gap: false });
    expect(r.value[0]).toBeCloseTo(impliedVdot(0.4, 72), 6);
  });

  it('reads flat-equivalent time when asked', () => {
    const run = evenRun(5, 300).map((c) => ({ ...c, grade: 0.03 })); // uphill all the way
    const d = makeDaily([[run]]);
    const raw = dayVdots(d, { minLapM: 1500, correction: 1, gap: false });
    const gap = dayVdots(d, { minLapM: 1500, correction: 1, gap: true });
    expect(gap.value[0]).toBeGreaterThan(raw.value[0]!);
    expect(gap.source[0]?.adjusted).toBe(true);
  });
});

describe('rolling max', () => {
  it('equals a brute-force max, null before the first reading', () => {
    const v = [0, 0, 40, 0, 45, 0, 0, 0, 0, 0, 30, 0, 0];
    const out = rollingMax(v, 4);
    v.forEach((_, i) => {
      const brute = Math.max(...v.slice(Math.max(0, i - 3), i + 1));
      expect(out[i]).toBe(brute > 0 ? brute : null);
    });
  });

  it('near-max: 0% is exactly the days that set the peak', () => {
    expect(vdotVsPeak(50, 50)).toBe(1);
    expect(isNearMax(50, 50, 0)).toBe(true);
    expect(isNearMax(49.9, 50, 0)).toBe(false);
    expect(isNearMax(47.6, 50, 5)).toBe(true);
    expect(isNearMax(0, 50, 100)).toBe(false); // a day with no reading never qualifies
  });
});

describe('endurance floor', () => {
  it('59% at VDOT 52.55 is 5:38/km (legacy figure), and collapses Recovery only below VDOT ~24.9', () => {
    expect(mmss(paceMinKm(velocityFromVo2(52.55 * enduranceFloorPct(52.55))))).toBe('5:38');
    expect(enduranceFloorPct(30)).toBe(0.59);
    expect(enduranceFloorPct(24)).toBeGreaterThan(0.59);
  });
});
