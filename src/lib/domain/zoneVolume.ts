import { todo } from '../exercise';
import type { Daily } from './daily';

/**
 * "What have the last N weeks been made of": every chunk sorted into one of eight
 * whole-zone buckets (Standing, Walking, Recovery, then the five zones), per day, then
 * rolled per week over a window like every other line. The buckets add up to the distance
 * actually binned, so the top of the stack is the distance-per-week line, decomposed.
 * See legacy/CLAUDE.md, "Running volume by pace zone".
 */
export interface DayBuckets {
  /** bucket b of day i at [i * N_BUCKETS + b] */
  km: Float64Array;
  min: Float64Array;
}

/*
 * TODO(E13) · volume by pace zone · difficulty ★★☆ · phase 2
 *   dayBuckets(daily, vdot, gapPace)
 *     Every chunk of every run sorted into one of N_BUCKETS whole-zone buckets (Standing,
 *     Walking, Recovery, then the five zones) with binEdges(vdot[i], 1); add its km and minutes
 *     to day i, bucket b at index i × N_BUCKETS + b. A day with no VDOT yet is left empty.
 *   zoneArea(buckets, n, windowDays)
 *     For each bucket, its per-day values rolled with perWeek(…, windowDays): bands[b][i].
 *     total[i] = the sum of the bands that day.
 * Edge cases that matter, and why:
 * - The buckets add up to the distance actually binned, so the top of the stack is the
 *   distance-per-week line, decomposed (the test checks exactly that).
 * - One flat Float64Array of n × N_BUCKETS, not n small arrays: one allocation instead of
 *   thousands.
 * Background: legacy/CLAUDE.md, "Running volume by pace zone".
 * Concepts:
 * - row-major layout of a 2-D table in one array: https://en.wikipedia.org/wiki/Row-_and_column-major_order
 * Check: npm run exercise E13 (tests/domain/zones.test.ts, "E13 zone volume"). In the app the
 * "by pace zone" panel and the readout's zone rows appear.
 * Spoiler: `recomputeDayZones()` and `recomputeZoneWindows()` in legacy/running-history.html.
 */
export function dayBuckets(daily: Daily, vdot: readonly (number | null)[], gapPace: boolean): DayBuckets {
  return todo('E13', daily, vdot, gapPace);
}

export interface ZoneArea {
  /** bands[b][i]: bucket b per week on day i */
  bands: Float64Array[];
  total: Float64Array;
}

/** One window's rolling per-week sums of each bucket (km or minutes). */
export function zoneArea(buckets: Float64Array, n: number, windowDays: number): ZoneArea {
  return todo('E13', buckets, n, windowDays);
}
