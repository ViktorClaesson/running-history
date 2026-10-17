import type { ChunkSet } from './chunkTypes';
import { addDays, daysBetween, type IsoDate } from './dates';
import type { ActivityId, ActivitySummary } from './types';

/**
 * The daily series: one entry per calendar day from the first run to *today*, so a break
 * shows as rest days and falling lines rather than a chart frozen on the last run.
 *
 * Each day keeps its runs apart (`runs[i]`, earliest first) and never sums them into one
 * effort for anything pace-related: two runs with a rest between are two efforts, and
 * gluing them together inflates VDOT (legacy/CLAUDE.md, "An effort is an activity, never a day").
 */

/** One segment's (manual lap's) totals: the sums of its chunks. */
export interface SegmentTotals {
  km: number;
  sec: number;
  flatSec: number;
}

export interface RunData {
  id: ActivityId;
  startLocal: string;
  name: string;
  km: number;
  /** Timer seconds and flat-equivalent seconds of the whole run. */
  sec: number;
  flatSec: number;
  /** null until the run has been processed; everything pace-related then skips it. */
  chunks: ChunkSet | null;
  /** Per segment, indexed by segment number. A segment with no chunks has zero totals. */
  segments: SegmentTotals[];
}

export interface Daily {
  /** The first day (index 0). */
  start: IsoDate;
  /** Number of days, first run → today inclusive. */
  n: number;
  /** That day's total distance, km, rounded to metres (see the dust snap in rolling.ts). */
  km: Float64Array;
  nRuns: Int32Array;
  /** The day's runs, earliest first. */
  runs: RunData[][];
  /** Index of the most recent day with a run, or −1. */
  lastRunIdx: number;
}

/** Distances are kept to the metre, so anything smaller than this in a sum is float dust. */
const roundKm = (km: number) => Math.round(km * 1000) / 1000;

export function buildDaily(
  activities: readonly ActivitySummary[],
  chunks: ReadonlyMap<ActivityId, ChunkSet>,
  today: IsoDate,
): Daily | null {
  if (!activities.length) return null;
  const sorted = [...activities].sort((a, b) => (a.startLocal < b.startLocal ? -1 : 1));
  const start = sorted[0]!.localDate;
  const n = Math.max(daysBetween(start, today), daysBetween(start, sorted[sorted.length - 1]!.localDate)) + 1;
  const runs: RunData[][] = Array.from({ length: n }, () => []);
  for (const a of sorted) runs[daysBetween(start, a.localDate)]!.push(runData(a, chunks.get(a.id) ?? null));
  const km = new Float64Array(n);
  const nRuns = new Int32Array(n);
  let lastRunIdx = -1;
  for (let i = 0; i < n; i++) {
    km[i] = roundKm(runs[i]!.reduce((s, r) => s + r.km, 0));
    nRuns[i] = runs[i]!.length;
    if (km[i]! > 0) lastRunIdx = i;
  }
  return { start, n, km, nRuns, runs, lastRunIdx };
}

function runData(a: ActivitySummary, chunks: ChunkSet | null): RunData {
  const segments = chunks ? segmentTotals(chunks) : [];
  const fromChunks = segments.reduce((t, s) => ({ sec: t.sec + s.sec, flatSec: t.flatSec + s.flatSec }), {
    sec: 0,
    flatSec: 0,
  });
  return {
    id: a.id,
    startLocal: a.startLocal,
    name: a.name,
    km: a.distanceM / 1000,
    // Time from the chunks when we have them (so it matches the pace maths), else the summary.
    sec: chunks ? fromChunks.sec : a.movingS,
    flatSec: chunks ? fromChunks.flatSec : a.movingS,
    chunks,
    segments,
  };
}

/** Sums each segment's chunks: lap-level totals are derivable from chunks by construction. */
export function segmentTotals(set: ChunkSet): SegmentTotals[] {
  const out: SegmentTotals[] = Array.from({ length: set.segmentCount }, () => ({
    km: 0,
    sec: 0,
    flatSec: 0,
  }));
  for (let i = 0; i < set.distM.length; i++) {
    const s = out[set.seg[i]!]!;
    s.km += set.distM[i]! / 1000;
    s.sec += set.durS[i]!;
    s.flatSec += set.flatDurS[i]!;
  }
  return out;
}

/** The calendar date of day `i`. */
export const dateAt = (d: Daily, i: number): IsoDate => addDays(d.start, i);
