import { describe, expect, it } from 'vitest';
import { chunkRun, timerSeconds } from '../../src/lib/domain/chunking';
import type { ChunkSet } from '../../src/lib/domain/chunkTypes';
import type { ParsedRun } from '../../src/lib/domain/parsedRun';
import { makeRun } from '../helpers/runs';

const opts = { chunkDistanceM: 100, processingVersion: 1 };
const sum = (a: Float32Array) => a.reduce((x, y) => x + y, 0);

/** Interval-level totals straight from the run, to compare chunk sums against. */
function streamTotals(run: ParsedRun) {
  let dur = 0;
  for (let i = 1; i < run.t.length; i++) dur += timerSeconds(run.t[i - 1]!, run.t[i]!, run.pauses);
  return { dist: run.dist[run.dist.length - 1]! - run.dist[0]!, dur };
}

function checkInvariants(run: ParsedRun, set: ChunkSet) {
  const tot = streamTotals(run);
  expect(sum(set.distM)).toBeCloseTo(tot.dist, 2);
  expect(sum(set.durS)).toBeCloseTo(tot.dur, 2);
  for (let i = 1; i < set.seg.length; i++) expect(set.seg[i]).toBeGreaterThanOrEqual(set.seg[i - 1]!);
  for (let i = 1; i < set.startM.length; i++) {
    expect(set.startM[i]).toBeCloseTo(set.startM[i - 1]! + set.distM[i - 1]!, 2);
  }
}

describe('chunkRun', () => {
  it('cuts an even run into ~100 m chunks whose sums equal the stream', () => {
    const run = makeRun([{ seconds: 1000, speed: 3 }]); // 3 km
    const set = chunkRun('a', run, opts);
    checkInvariants(run, set);
    expect(set.distM.length).toBe(30);
    expect(set.lapRule).toBe('none');
    expect(set.segmentCount).toBe(1);
    expect(Math.min(...set.distM)).toBeGreaterThanOrEqual(99);
  });

  it('never lets a chunk cross a manual lap, and lap aggregates are chunk sums', () => {
    // 1 km warm-up, then 4 x (400 m fast / 200 m jog) on the lap button, then 1 km.
    const reps = Array.from({ length: 4 }, () => [
      { seconds: 100, speed: 4, lap: { trigger: 'manual' } },
      { seconds: 100, speed: 2, lap: { trigger: 'manual' } },
    ]).flat();
    const run = makeRun([
      { seconds: 400, speed: 2.5, lap: { trigger: 'manual' } },
      ...reps,
      { seconds: 400, speed: 2.5, lap: { trigger: 'sessionEnd' } },
    ]);
    const set = chunkRun('b', run, opts);
    checkInvariants(run, set);
    expect(set.lapRule).toBe('button');
    expect(set.segmentCount).toBe(10);
    // Per segment, the chunk distances add up to the lap's own distance.
    const segDist = new Map<number, number>();
    set.seg.forEach((s, i) => segDist.set(s, (segDist.get(s) ?? 0) + set.distM[i]!));
    expect(segDist.get(0)).toBeCloseTo(1000, 3);
    for (let k = 0; k < 4; k++) {
      expect(segDist.get(1 + 2 * k)).toBeCloseTo(400, 3);
      expect(segDist.get(2 + 2 * k)).toBeCloseTo(200, 3);
    }
    // Every rep's time is exactly its own 100 s: nothing leaked across the boundary.
    const segDur = new Map<number, number>();
    set.seg.forEach((s, i) => segDur.set(s, (segDur.get(s) ?? 0) + set.durS[i]!));
    expect(segDur.get(1)).toBeCloseTo(100, 3);
  });

  it('merges a short remainder into the previous chunk, keeps a long one', () => {
    // 312 m at 3 m/sample: cuts at the samples past 100 and 200 m, 12 m left over → merged.
    const short = chunkRun('c', makeRun([{ seconds: 104, speed: 3 }]), opts);
    expect(Array.from(short.distM).map(Math.round)).toEqual([102, 99, 111]);
    // 360 m: 60 m left over is more than half a chunk, so it stays a chunk of its own.
    const long = chunkRun('d', makeRun([{ seconds: 120, speed: 3 }]), opts);
    expect(Array.from(long.distM).map(Math.round)).toEqual([102, 99, 99, 60]);
  });

  it('leaves paused time out of every duration', () => {
    const run = makeRun([{ seconds: 600, speed: 3 }], [{ from: 300, to: 506 }]);
    const set = chunkRun('e', run, opts);
    checkInvariants(run, set);
    expect(sum(set.durS)).toBeCloseTo(600, 3); // not 806
  });

  it('a manual entry with no samples becomes one chunk from the session totals', () => {
    const run: ParsedRun = {
      t: new Float64Array(0),
      dist: new Float64Array(0),
      alt: new Float64Array(0),
      hr: new Float64Array(0),
      pauses: [],
      laps: [],
      totals: { distM: 6000, timerS: 1800 },
    };
    const set = chunkRun('f', run, opts);
    expect(Array.from(set.distM)).toEqual([6000]);
    expect(Array.from(set.durS)).toEqual([1800]);
    expect(set.gapMethod).toBe('none');
  });

  it('flat-equivalent time is shorter uphill, and matches the watch per lap when it has a figure', () => {
    const run = makeRun([
      {
        seconds: 300,
        speed: 3,
        climb: 45,
        lap: { trigger: 'manual', avgGapSpeed: 3.3, distM: 900, timerS: 300 },
      },
      { seconds: 300, speed: 3, lap: { trigger: 'sessionEnd' } },
    ]);
    const set = chunkRun('g', run, opts);
    checkInvariants(run, set);
    expect(set.gapMethod).toBe('minetti-scaled');
    let dur0 = 0;
    let flat0 = 0;
    set.seg.forEach((s, i) => {
      if (s === 0) {
        dur0 += set.durS[i]!;
        flat0 += set.flatDurS[i]!;
      }
    });
    expect(dur0 / flat0).toBeCloseTo(1.1, 3); // the watch's 3.3 / 3.0
    expect(set.gainM[0]).toBeGreaterThan(0);
  });

  it('time-weights heart rate and leaves it NaN when missing', () => {
    const run = makeRun([{ seconds: 34, speed: 3, hr: 150 }]);
    const set = chunkRun('h', run, opts);
    expect(set.hr[0]).toBeCloseTo(150, 5);
    run.hr.fill(NaN);
    expect(Number.isNaN(chunkRun('h', run, opts).hr[0])).toBe(true);
  });
});
