import { describe, expect, it } from 'vitest';
import {
  binCount,
  binForVelocity,
  binVelocityRange,
  bucketOfBin,
  N_BUCKETS,
  paceHistogram,
  RECOVERY_BIN,
  STANDING_BIN,
  WALKING_BIN,
  ZONE_BIN_OFFSET,
  zoneEdgeVel,
} from '../../src/lib/domain/paceZones';
import { dayStress } from '../../src/lib/domain/stress';
import { velocityFromVo2 } from '../../src/lib/domain/vdot';
import { workoutFromScores, zoneScores } from '../../src/lib/domain/workoutType';
import { buildWindows, windowSeries } from '../../src/lib/domain/windows';
import { dayBuckets, zoneArea } from '../../src/lib/domain/zoneVolume';
import { chunkVelocity } from '../../src/lib/domain/chunks';
import { chunksOf, evenRun, makeDaily } from '../helpers/daily';

const V = 52;
const kmhToMpm = (kmh: number) => kmh / 0.06;

describe('E09 pace-zone binning', () => {
  it('sorts the slow end by fixed paces, then into zones', () => {
    expect(binForVelocity(kmhToMpm(2), V, 3)).toBe(STANDING_BIN); // 30:00/km
    expect(binForVelocity(kmhToMpm(5), V, 3)).toBe(WALKING_BIN); // 12:00/km
    expect(binForVelocity(kmhToMpm(9), V, 3)).toBe(RECOVERY_BIN); // 6:40/km at VDOT 52
    expect(binForVelocity(kmhToMpm(30), V, 3)).toBe(binCount(3) - 1); // clamps into the top bin
  });

  it('cuts each zone into equal steps of speed', () => {
    const e = [0, 1, 2, 3].map((k) => zoneEdgeVel(V, 1, k, 3));
    expect(e[1]! - e[0]!).toBeCloseTo(e[3]! - e[2]!, 9);
  });

  it('tiles the speed axis: every bin starts where the one before it ends', () => {
    for (const bars of [1, 3, 7]) {
      for (let b = 1; b < binCount(bars); b++) {
        expect(binVelocityRange(b, V, bars).lo).toBeCloseTo(binVelocityRange(b - 1, V, bars).hi!, 9);
      }
      expect(binVelocityRange(binCount(bars) - 1, V, bars).hi).toBeNull();
    }
  });
});

describe('E10 pace histogram', () => {
  it("reads a chunk's speed in m/min: raw from metres, grade-adjusted from flat-equivalent metres", () => {
    const c = chunksOf([
      { m: 30, s: 10, flat: 1.2 },
      { m: 0, s: 0 },
    ]);
    expect(chunkVelocity(c, 0, false)).toBeCloseTo(180, 4); // 3 m/s
    expect(chunkVelocity(c, 0, true)).toBeCloseTo(216, 4);
    expect(chunkVelocity(c, 1, false)).toBeNull(); // no time, no speed
  });

  it("a histogram's km sum to the run's chunk distances; zone bars never move the buckets", () => {
    const set = chunksOf([
      ...evenRun(2, 360),
      ...evenRun(1, 230),
      { m: 0, s: 40 }, // stood at a light
      ...evenRun(2, 300),
    ]);
    const buckets = (bars: number) => {
      const h = paceHistogram(set, V, bars, false);
      const out = new Array(N_BUCKETS).fill(0);
      h.km.forEach((km, b) => (out[bucketOfBin(b, bars)] += km));
      return out;
    };
    const h = paceHistogram(set, V, 3, false);
    expect(h.km.reduce((a, b) => a + b, 0)).toBeCloseTo(5, 9);
    expect(h.mins[STANDING_BIN]).toBeCloseTo(40 / 60, 9); // standing time now shows up
    for (const bars of [1, 2, 7, 20]) expect(buckets(bars)).toEqual(buckets(3));
  });
});

describe('E11 workout type', () => {
  // legacy/CLAUDE.md: shares across endurance/marathon/threshold/interval/repetition.
  // Those were recorded at a 50% share; at today's 35% default, repetition alone (36%)
  // would already win 30 Sep.
  it('30 Sep 2026 (32/0/0/32/36) is Interval at 68% interval+ (share 50)', () => {
    expect(workoutFromScores([0, 32, 0, 0, 32, 36], 35).type).toBe(5);
    const w = workoutFromScores([0, 32, 0, 0, 32, 36], 50);
    expect(w.type).toBe(4);
    expect(w.plus).toBe(true);
    expect(w.pct).toBeCloseTo(68, 6);
  });
  it('16 Sep 2026 (22/0/65/0/13) is Threshold', () => {
    expect(workoutFromScores([0, 22, 0, 65, 0, 13], 35).type).toBe(3);
  });
  it('falls back to Recovery, and says when there was no running at all', () => {
    expect(workoutFromScores([10, 2, 0, 0, 0, 0], 35)).toMatchObject({ type: 0 });
    expect(workoutFromScores([0, 0, 0, 0, 0, 0], 35)).toMatchObject({ type: 0, noRunning: true });
  });
  it('scores speed^exp × km, and ignores standing and walking', () => {
    const tempo = velocityFromVo2(V * 0.88); // threshold pace
    const set = chunksOf([
      { m: 1000, s: 60_000 / tempo },
      { m: 100, s: 120 }, // walking pace: scores nothing
    ]);
    const sc = zoneScores(set, V, 2, false);
    expect(sc[3]).toBeCloseTo((tempo * 0.06) ** 2 * 1, 3); // chunks store float32 seconds
    expect(sc.reduce((a, b) => a + b, 0)).toBeCloseTo(sc[3]!, 9);
  });
});

describe('E12 stress', () => {
  it('1 h at 12 km/h is 144 raw; 1 h at threshold is exactly 100 relative', () => {
    const vT = velocityFromVo2(V * 0.88) * 0.06; // km/h
    const d = makeDaily([[evenRun(12, 300)], [[{ m: vT * 1000, s: 3600 }]]]);
    const vdot = [V, V];
    const s = dayStress(d, vdot);
    expect(s.raw[0]).toBeCloseTo(144, 6);
    expect(s.rel[1]).toBeCloseTo(100, 4);
  });

  it('reads the raw speed: the same run uphill scores the same (landing stress, not effort)', () => {
    const flat = makeDaily([[evenRun(10, 300)]]);
    const hilly = makeDaily([[evenRun(10, 300).map((c) => ({ ...c, flat: 1.3 }))]]);
    expect(dayStress(hilly, [V]).raw[0]).toBeCloseTo(dayStress(flat, [V]).raw[0]!, 9);
  });
});

describe('E13 zone volume', () => {
  it('the stack adds up to the distance-per-week line', () => {
    const days = Array.from({ length: 40 }, (_, i) =>
      i % 3 ? [] : [evenRun(5 + (i % 4), 300 + 10 * (i % 5))],
    );
    const d = makeDaily(days);
    const vdot = new Array(d.n).fill(V);
    const b = dayBuckets(d, vdot, false);
    const w = buildWindows(1, 4);
    const series = windowSeries(d, w);
    for (const win of w) {
      const area = zoneArea(b.km, d.n, win.days);
      for (let i = 0; i < d.n; i++) expect(area.total[i]).toBeCloseTo(series.vol[win.slot]![i]!, 6);
    }
    expect(ZONE_BIN_OFFSET).toBe(3);
  });
});
