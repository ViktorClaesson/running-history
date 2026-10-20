import { todo, whenDone } from '../exercise';
import { buildChunks, type Chunks } from './chunks';
import { addDays, type IsoDate } from './dates';
import { flatMetresFactor } from './gap';
import type { SampleSet } from './sampleTypes';
import type { ActivityId, ActivitySummary } from './types';

/**
 * The daily series: one entry per calendar day from the first run to *today*, so a break
 * shows as rest days and falling lines rather than a chart frozen on the last run.
 *
 * Each day keeps its runs apart (`runs[i]`, earliest first) and never sums them into one
 * effort for anything pace-related: two runs with a rest between are two efforts, and
 * gluing them together inflates VDOT (legacy/CLAUDE.md, "An effort is an activity, never a day").
 */

/** One segment's (manual lap's) totals, summed from its samples. */
export interface SegmentTotals {
  km: number;
  sec: number;
  /** The time it would have taken at its grade-adjusted speed (sec × metres ÷ flat-equivalent metres). */
  flatSec: number;
}

export interface RunData {
  id: ActivityId;
  startLocal: string;
  name: string;
  km: number;
  /** Timer seconds, and the time at grade-adjusted speed, of the whole run. */
  sec: number;
  flatSec: number;
  /** The run's chunks at the current chunk length; null until the run has been processed. */
  chunks: Chunks | null;
  /** Per segment, indexed by segment number. */
  segments: SegmentTotals[];
}

export interface Daily {
  start: IsoDate;
  /** Number of days, first run → today inclusive. */
  n: number;
  /** That day's total distance, km, rounded to metres (see the dust snap in rolling.ts). */
  km: Float64Array;
  nRuns: Int32Array;
  runs: RunData[][];
  /** Index of the most recent day with a run, or −1. */
  lastRunIdx: number;
}

/** km rounded to the metre: what makes the dust snap in rolling.ts safe. */
export const roundKm = (km: number): number => Math.round(km * 1000) / 1000;

/*
 * TODO(E03) · daily series · difficulty ★★☆ · phase 1
 *   buildDaily(activities, samples, chunkSec, gapExp, today)
 *     One entry per calendar day from the first run's day to `today` inclusive (or to the
 *     last run, if that is later), so a break shows as rest days rather than a chart frozen
 *     on the last run. null when there are no activities.
 *     - start = the earliest run's localDate; n = days from start to today, + 1.
 *     - runs[i] = that day's runs, earliest first (sort by startLocal), each built with the
 *       provided runData(activity, samples.get(id) ?? null, chunkSec, gapExp).
 *     - km[i] = the day's total, rounded to the metre with roundKm; nRuns[i] = runs that day.
 *     - lastRunIdx = the last day with km > 0, or −1.
 *   segmentTotals(s, flatFactor)
 *     Per segment (manual lap), summed over its samples: km, timer seconds, and flatSec, the
 *     time it would have taken at its grade-adjusted speed: sec × metres ÷ flat-equivalent
 *     metres, where each sample's flat-equivalent metres are dist × flatFactor(grade). With
 *     no flat metres at all (a stretch of standing), flatSec = sec.
 * Edge cases that matter, and why:
 * - Keep the runs apart. Two runs on one day are two efforts; gluing them into one inflates
 *   VDOT later (legacy/CLAUDE.md, "VDOT and pace zones", "An effort is an activity, never a day").
 * - Days are counted with daysBetween (E01), never by stepping a Date object.
 * - Round each day's km: the dust snap in rolling.ts relies on it.
 * - Sum metres, not speeds or times: grade adjustment is combined by energy (see gap.ts).
 * Background: legacy/CLAUDE.md, "Data pipeline" ("The day arrays run to today") and "Days with
 * more than one run".
 * Concepts:
 * - Array.prototype.sort with a comparator: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
 * - Array.from({ length: n }, …): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from
 * - Map.prototype.get: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/get
 * Check: npm run exercise E03 (tests/domain/windows.test.ts, "E03 daily series"). In the app the
 * "Exercise E03" card goes and the bars appear (the lines need E04).
 * Spoiler: `buildData()` in legacy/running-history.html did this from the CSV rows.
 */
export function buildDaily(
  activities: readonly ActivitySummary[],
  samples: ReadonlyMap<ActivityId, SampleSet>,
  chunkSec: number,
  gapExp: number,
  today: IsoDate,
): Daily | null {
  return todo('E03', activities, samples, chunkSec, gapExp, today);
}

/**
 * One run's entry in the daily series: the summary's distance, and from its samples (when
 * it has been processed) the segment totals, the grade-adjusted time and the chunks.
 *
 * On the exercise branch the samples side is built from later exercises, so until those
 * are done it falls back: no grade adjustment before E17 (gap.ts), and the whole run as a
 * single chunk before E19 (chunks.ts). The charts work from the start and sharpen as you go.
 */
export function runData(a: ActivitySummary, s: SampleSet | null, chunkSec: number, gapExp: number): RunData {
  const factor = flatFactor(gapExp);
  const segments = s ? segmentTotals(s, factor) : [];
  const sec = s ? segments.reduce((t, x) => t + x.sec, 0) : a.movingS;
  const flatSec = s ? wholeRunFlatSec(s, factor) : a.movingS;
  return {
    id: a.id,
    startLocal: a.startLocal,
    name: a.name,
    km: a.distanceM / 1000,
    sec,
    flatSec,
    chunks: s
      ? whenDone(
          () => buildChunks(s, chunkSec, gapExp),
          () => wholeRunChunk(s),
        )
      : null,
    segments,
  };
}

/** Flat-equivalent metres per metre at a gradient, at this GAP strength (1 everywhere before E17). */
function flatFactor(gapExp: number): (grade: number) => number {
  const f = (g: number) => flatMetresFactor(g, gapExp);
  return whenDone(
    () => {
      f(0); // throws here, once, if E17 isn't done
      return f;
    },
    () => () => 1,
  );
}

/** Per segment: km and seconds summed from its samples, and the time at its grade-adjusted speed. */
export function segmentTotals(s: SampleSet, flatFactor: (grade: number) => number): SegmentTotals[] {
  return todo('E03', s, flatFactor);
}

function wholeRunFlatSec(s: SampleSet, flatFactor: (grade: number) => number): number {
  let sec = 0;
  let m = 0;
  let flat = 0;
  for (let i = 0; i < s.dt.length; i++) {
    sec += s.dt[i]!;
    m += s.dist[i]!;
    flat += s.dist[i]! * flatFactor(s.grade[i]!);
  }
  return flat > 0 ? (sec * m) / flat : sec;
}

/** The whole run as one chunk: the stand-in for the chunks until exercise E19 is done. */
function wholeRunChunk(s: SampleSet): Chunks {
  const sum = (a: Float32Array) => a.reduce((x, y) => x + y, 0);
  const distM = sum(s.dist);
  return {
    seg: Uint16Array.of(0),
    durS: Float32Array.of(sum(s.dt)),
    distM: Float32Array.of(distM),
    flatM: Float32Array.of(distM),
    hr: Float32Array.of(NaN),
  };
}

/** The calendar date of day `i`. */
export const dateAt = (d: Daily, i: number): IsoDate => addDays(d.start, i);
