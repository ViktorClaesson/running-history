import { describe, expect, it } from 'vitest';
import type { ParsedRun } from '../../src/lib/domain/parsedRun';
import { buildSamples, timerSeconds } from '../../src/lib/domain/samples';
import { makeRun } from '../helpers/runs';

const sum = (a: Float32Array) => a.reduce((x, y) => x + y, 0);

describe('buildSamples', () => {
  it('keeps every interval: distances and timer seconds sum to the stream', () => {
    const run = makeRun([{ seconds: 600, speed: 3 }]);
    const s = buildSamples('a', run, 2);
    expect(s.dt.length).toBe(600);
    expect(sum(s.dist)).toBeCloseTo(1800, 3);
    expect(sum(s.dt)).toBeCloseTo(600, 3);
    expect(s.speed[10]).toBeCloseTo(3, 6); // the watch's speed
  });

  it('assigns each interval to its segment; lap totals are sums over a segment', () => {
    const run = makeRun([
      { seconds: 300, speed: 2.5, lap: { trigger: 'manual' } },
      { seconds: 100, speed: 4, lap: { trigger: 'manual' } },
      { seconds: 300, speed: 2.5, lap: { trigger: 'sessionEnd' } },
    ]);
    const s = buildSamples('b', run, 2);
    expect(s.lapRule).toBe('button');
    expect(s.segmentCount).toBe(3);
    const segDist = [0, 0, 0];
    s.seg.forEach((g, i) => (segDist[g]! += s.dist[i]!));
    expect(segDist[0]).toBeCloseTo(750, 3);
    expect(segDist[1]).toBeCloseTo(400, 3);
    for (let i = 1; i < s.seg.length; i++) expect(s.seg[i]).toBeGreaterThanOrEqual(s.seg[i - 1]!);
  });

  it('leaves paused time out', () => {
    const run = makeRun([{ seconds: 600, speed: 3 }], [{ from: 300, to: 506 }]);
    expect(sum(buildSamples('c', run, 2).dt)).toBeCloseTo(600, 3);
    expect(timerSeconds(290, 520, [{ from: 300, to: 506 }])).toBe(24);
  });

  it('reads the gradient from the altitude', () => {
    const run = makeRun([{ seconds: 300, speed: 3, climb: 45 }]); // 900 m rising 45 m: 5%
    const s = buildSamples('d', run, 2);
    expect(s.grade[150]).toBeCloseTo(0.05, 6);
  });

  it('falls back to distance ÷ time when the watch recorded no speed', () => {
    const run = makeRun([{ seconds: 60, speed: 3 }]);
    run.speed.fill(NaN);
    expect(buildSamples('e', run, 2).speed[5]).toBeCloseTo(3, 6);
  });

  it('a manual entry with no samples becomes one interval from the session totals', () => {
    const run: ParsedRun = {
      t: new Float64Array(0),
      dist: new Float64Array(0),
      alt: new Float64Array(0),
      hr: new Float64Array(0),
      speed: new Float64Array(0),
      pauses: [],
      laps: [],
      totals: { distM: 6000, timerS: 1800 },
    };
    const s = buildSamples('f', run, 2);
    expect(Array.from(s.dist)).toEqual([6000]);
    expect(Array.from(s.dt)).toEqual([1800]);
  });
});
