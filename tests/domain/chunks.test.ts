import { describe, expect, it } from 'vitest';
import { buildChunks, chunkVelocity } from '../../src/lib/domain/chunks';
import { flatMetresFactor } from '../../src/lib/domain/gap';
import { sampleSet } from '../helpers/daily';

const sum = (a: Float32Array) => a.reduce((x, y) => x + y, 0);
const seconds = (n: number, seg = 0, m = 3) => Array.from({ length: n }, () => ({ m, s: 1, seg }));

describe('buildChunks', () => {
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

  it('reads raw speed from the watch and grade-adjusted speed from flat-equivalent metres', () => {
    const c = buildChunks(sampleSet('f', [{ m: 30, s: 10, grade: 0.05 }]), 0);
    expect(chunkVelocity(c, 0, false)).toBeCloseTo(180, 4); // 3 m/s = 180 m/min
    expect(chunkVelocity(c, 0, true)).toBeCloseTo(180 * flatMetresFactor(0.05), 4);
  });
});
