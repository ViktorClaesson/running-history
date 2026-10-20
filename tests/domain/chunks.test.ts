import { describe, expect, it } from 'vitest';
import { buildChunks, chunkVelocity } from '../../src/lib/domain/chunks';
import { buildDaily } from '../../src/lib/domain/daily';
import { isoDate } from '../../src/lib/domain/dates';
import { flatMetresFactor } from '../../src/lib/domain/gap';
import type { ActivitySummary } from '../../src/lib/domain/types';
import { evenRun, makeDaily, sampleSet, type SampleSpec } from '../helpers/daily';

const sum = (a: Float32Array) => a.reduce((x, y) => x + y, 0);
const seconds = (n: number, seg = 0, m = 3) => Array.from({ length: n }, () => ({ m, s: 1, seg }));

describe('E19 buildChunks', () => {
  it('0 seconds: every sample is its own chunk', () => {
    const c = buildChunks(sampleSet('a', seconds(25)), 0);
    expect(c.durS.length).toBe(25);
  });

  it('groups samples into chunks of at least minSec, and keeps every sum', () => {
    const s = sampleSet('b', seconds(95));
    const c = buildChunks(s, 10);
    expect(Array.from(c.durS)).toEqual([10, 10, 10, 10, 10, 10, 10, 10, 10, 5]); // 5 ≥ half: kept
    expect(sum(c.distM)).toBeCloseTo(sum(s.dist), 4);
    expect(sum(c.durS)).toBeCloseTo(sum(s.dt), 4);
  });

  it('merges a short remainder (under half) into the previous chunk of the same segment', () => {
    expect(Array.from(buildChunks(sampleSet('c', seconds(93)), 10).durS).slice(-1)).toEqual([13]);
  });

  it('never crosses a segment, even if a segment is shorter than minSec', () => {
    const c = buildChunks(sampleSet('d', [...seconds(12, 0), ...seconds(4, 1), ...seconds(12, 2)]), 10);
    expect(Array.from(c.seg)).toEqual([0, 1, 2]);
    expect(Array.from(c.durS)).toEqual([12, 4, 12]);
  });

  it('an instant after a pause (no timer time) joins its neighbours instead of being a chunk', () => {
    const c = buildChunks(sampleSet('e', [{ m: 1, s: 0 }, ...seconds(3)]), 0);
    expect(c.durS.length).toBe(3);
    expect(sum(c.distM)).toBeCloseTo(10, 6);
  });

  it('reads raw speed as metres ÷ time and grade-adjusted speed from flat-equivalent metres', () => {
    const c = buildChunks(sampleSet('f', [{ m: 30, s: 10, grade: 0.05 }]), 0);
    expect(chunkVelocity(c, 0, false)).toBeCloseTo(180, 4); // 3 m/s = 180 m/min
    expect(chunkVelocity(c, 0, true)).toBeCloseTo(180 * flatMetresFactor(0.05), 4);
    const pure = buildChunks(sampleSet('g', [{ m: 30, s: 10, grade: 0.05 }]), 0, 1);
    expect(chunkVelocity(pure, 0, true)).toBeCloseTo(180 * flatMetresFactor(0.05, 1), 4);
  });

  it('buildDaily carries them per run, exactly like the hand-built series the other tests use', () => {
    const days: SampleSpec[][][] = [
      [evenRun(5, 300), [...evenRun(1, 240), ...evenRun(1.6, 210).map((c) => ({ ...c, seg: 1 }))]],
      [],
      [evenRun(3, 330)],
    ];
    const acts: ActivitySummary[] = [];
    const samples = new Map(
      days.flatMap((runs, i) =>
        runs.map((spec, k) => {
          const id = `d${i}r${k}`;
          const startLocal = `2026-01-0${i + 1}T${String(8 + k).padStart(2, '0')}:00:00`;
          const m = spec.reduce((a, c) => a + c.m, 0);
          const localDate = isoDate(startLocal.slice(0, 10));
          acts.push({
            id,
            startLocal,
            localDate,
            name: id,
            type: 'Run',
            distanceM: m,
            movingS: 0,
          } as ActivitySummary);
          return [id, sampleSet(id, spec)] as const;
        }),
      ),
    );
    const built = buildDaily(acts, samples, 0, 0.5, isoDate('2026-01-03'))!;
    const hand = makeDaily(days);
    expect(built.n).toBe(hand.n);
    expect(Array.from(built.km)).toEqual(Array.from(hand.km));
    for (let i = 0; i < hand.n; i++) {
      built.runs[i]!.forEach((r, k) => {
        const h = hand.runs[i]![k]!;
        expect(r.km).toBeCloseTo(h.km, 9);
        expect(r.sec).toBeCloseTo(h.sec, 4);
        expect(r.segments.map((g) => g.km)).toEqual(h.segments.map((g) => expect.closeTo(g.km, 9)));
        expect(Array.from(r.chunks!.durS)).toEqual(Array.from(h.chunks!.durS));
        expect(Array.from(r.chunks!.distM)).toEqual(Array.from(h.chunks!.distM));
        expect(Array.from(r.chunks!.seg)).toEqual(Array.from(h.chunks!.seg));
      });
    }
  });
});
