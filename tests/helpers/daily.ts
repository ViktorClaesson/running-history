import type { Chunks } from '../../src/lib/domain/chunks';
import type { Daily, RunData, SegmentTotals } from '../../src/lib/domain/daily';
import type { IsoDate } from '../../src/lib/domain/dates';
import type { SampleSet } from '../../src/lib/domain/sampleTypes';

/**
 * One interval of a run: `m` metres in `s` seconds, at gradient `grade`, in segment `seg`.
 * `flat` is the flat-equivalent metres per metre (default 1): the hand-built series below
 * take it as given, so the tests of the fitness maths don't depend on the GAP exercise.
 */
export interface SampleSpec {
  m: number;
  s: number;
  grade?: number;
  seg?: number;
  flat?: number;
}

export function sampleSet(id: string, spec: SampleSpec[]): SampleSet {
  const segs = spec.map((c) => c.seg ?? 0);
  return {
    activityId: id,
    processingVersion: 1,
    lapRule: Math.max(...segs) > 0 ? 'button' : 'none',
    segmentCount: Math.max(...segs) + 1,
    seg: Uint16Array.from(segs),
    dt: Float32Array.from(spec, (c) => c.s),
    dist: Float32Array.from(spec, (c) => c.m),
    grade: Float32Array.from(spec, (c) => c.grade ?? 0),
    hr: Float32Array.from(spec, () => 140),
  };
}

/** Even pace: `km` at `paceSec` per km, as 100 m intervals in one segment. */
export function evenRun(km: number, paceSec: number): SampleSpec[] {
  const n = Math.round(km * 10);
  return Array.from({ length: n }, () => ({ m: 100, s: paceSec / 10 }));
}

/** Every interval its own chunk (what buildChunks does at chunk length 0), built by hand. */
export function chunksOf(spec: SampleSpec[]): Chunks {
  return {
    seg: Uint16Array.from(spec, (c) => c.seg ?? 0),
    durS: Float32Array.from(spec, (c) => c.s),
    distM: Float32Array.from(spec, (c) => c.m),
    flatM: Float32Array.from(spec, (c) => c.m * (c.flat ?? 1)),
    hr: Float32Array.from(spec, () => 140),
  };
}

/** "YYYY-MM-DD" `days` after `start`, without the dates exercise. */
const dayAfter = (start: IsoDate, days: number): IsoDate =>
  new Date(Date.parse(`${start}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10) as IsoDate;

function runOf(id: string, startLocal: string, spec: SampleSpec[]): RunData {
  const chunks = chunksOf(spec);
  const segments: SegmentTotals[] = [];
  let m = 0;
  let sec = 0;
  let flat = 0;
  spec.forEach((c, k) => {
    const g = (segments[c.seg ?? 0] ??= { km: 0, sec: 0, flatSec: 0 });
    g.km += c.m / 1000;
    g.sec += c.s;
    g.flatSec += chunks.flatM[k]!; // flat metres for now, turned into a time below
    m += c.m;
    sec += c.s;
    flat += chunks.flatM[k]!;
  });
  for (const g of segments) g.flatSec = g.flatSec > 0 ? (g.sec * g.km * 1000) / g.flatSec : g.sec;
  return {
    id,
    startLocal,
    name: id,
    km: m / 1000,
    sec,
    flatSec: flat > 0 ? (sec * m) / flat : sec,
    chunks,
    segments,
  };
}

/**
 * days[i] = the runs on day i (each a list of intervals), built by hand into the shape
 * buildDaily makes (tests/domain/chunks.test.ts checks the two agree). Day 0 is `start`;
 * the series runs to `today`, given as a number of extra rest days after the last one.
 * Chunks are the intervals themselves, as at chunk length 0.
 */
export function makeDaily(days: SampleSpec[][][], start = '2026-01-01' as IsoDate, restDays = 0): Daily {
  const n = days.length + restDays;
  const runs = Array.from({ length: n }, (_, i) =>
    (days[i] ?? []).map((spec, k) =>
      runOf(`d${i}r${k}`, `${dayAfter(start, i)}T${String(8 + k).padStart(2, '0')}:00:00`, spec),
    ),
  );
  const km = Float64Array.from(runs, (r) => Math.round(r.reduce((a, x) => a + x.km, 0) * 1000) / 1000);
  let lastRunIdx = -1;
  km.forEach((v, i) => (lastRunIdx = v > 0 ? i : lastRunIdx));
  return { start, n, km, nRuns: Int32Array.from(runs, (r) => r.length), runs, lastRunIdx };
}
