import { buildDaily, type Daily } from '../../src/lib/domain/daily';
import { addDays, isoDate, type IsoDate } from '../../src/lib/domain/dates';
import type { SampleSet } from '../../src/lib/domain/sampleTypes';
import type { ActivitySummary } from '../../src/lib/domain/types';

/** One interval of a run: `m` metres in `s` seconds, at gradient `grade`, in segment `seg`. */
export interface SampleSpec {
  m: number;
  s: number;
  grade?: number;
  seg?: number;
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

/**
 * days[i] = the runs on day i (each a list of intervals). Day 0 is `start`; the series runs
 * to `today` (default: the last day given). Chunk length 0, so chunks are the intervals.
 */
export function makeDaily(
  days: SampleSpec[][][],
  start = isoDate('2026-01-01'),
  today?: IsoDate,
  chunkSec = 0,
): Daily {
  const acts: ActivitySummary[] = [];
  const samples = new Map<string, SampleSet>();
  days.forEach((runs, i) =>
    runs.forEach((spec, k) => {
      const id = `d${i}r${k}`;
      const date = addDays(start, i);
      const m = spec.reduce((a, c) => a + c.m, 0);
      const s = spec.reduce((a, c) => a + c.s, 0);
      acts.push({
        id,
        startLocal: `${date}T${String(8 + k).padStart(2, '0')}:00:00`,
        localDate: date,
        name: id,
        type: 'Run',
        distanceM: m,
        movingS: s,
        elapsedS: s,
        avgHr: null,
        elevGainM: null,
        changeMarker: '',
        fileSportIndex: 0,
      });
      samples.set(id, sampleSet(id, spec));
    }),
  );
  return buildDaily(acts, samples, chunkSec, 0.5, today ?? addDays(start, days.length - 1))!;
}
