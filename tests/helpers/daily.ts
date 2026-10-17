import type { ChunkSet } from '../../src/lib/domain/chunkTypes';
import { buildDaily, type Daily } from '../../src/lib/domain/daily';
import { addDays, isoDate, type IsoDate } from '../../src/lib/domain/dates';
import type { ActivitySummary } from '../../src/lib/domain/types';

/** A run as a list of chunks, each [metres, seconds] (flat time = real unless given), with segment numbers. */
export interface ChunkSpec {
  m: number;
  s: number;
  flat?: number;
  seg?: number;
}

export function chunkSet(id: string, chunks: ChunkSpec[]): ChunkSet {
  const segs = chunks.map((c) => c.seg ?? 0);
  let at = 0;
  return {
    activityId: id,
    processingVersion: 1,
    chunkDistanceM: 100,
    lapRule: Math.max(...segs) > 0 ? 'button' : 'none',
    gapMethod: 'none',
    segmentCount: Math.max(...segs) + 1,
    seg: Uint16Array.from(segs),
    startM: Float32Array.from(chunks, (c) => {
      const s = at;
      at += c.m;
      return s;
    }),
    distM: Float32Array.from(chunks, (c) => c.m),
    durS: Float32Array.from(chunks, (c) => c.s),
    flatDurS: Float32Array.from(chunks, (c) => c.flat ?? c.s),
    hr: Float32Array.from(chunks, () => 140),
    gainM: new Float32Array(chunks.length),
    lossM: new Float32Array(chunks.length),
  };
}

/** Even pace: `km` at `paceSec` per km, as 100 m chunks in one segment. */
export function evenRun(km: number, paceSec: number): ChunkSpec[] {
  const n = Math.round(km * 10);
  return Array.from({ length: n }, () => ({ m: 100, s: paceSec / 10 }));
}

/**
 * days[i] = the runs on day i (each a chunk list). Day 0 is `start`; the series runs to `today`
 * (default: the last day given).
 */
export function makeDaily(days: ChunkSpec[][][], start = isoDate('2026-01-01'), today?: IsoDate): Daily {
  const acts: ActivitySummary[] = [];
  const chunks = new Map<string, ChunkSet>();
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
      chunks.set(id, chunkSet(id, spec));
    }),
  );
  return buildDaily(acts, chunks, today ?? addDays(start, days.length - 1))!;
}
