import type { Daily } from './daily';
import { binForVelocity, chunkVelocity, effortSec, N_BUCKETS } from './paceZones';
import { perWeek } from './rolling';

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

export function dayBuckets(daily: Daily, vdot: readonly (number | null)[], gapPace: boolean): DayBuckets {
  const out: DayBuckets = {
    km: new Float64Array(daily.n * N_BUCKETS),
    min: new Float64Array(daily.n * N_BUCKETS),
  };
  for (let i = 0; i < daily.n; i++) {
    const v = vdot[i];
    if (!v) continue; // no VDOT yet: nothing to judge a pace against
    for (const run of daily.runs[i]!) {
      const set = run.chunks;
      if (!set) continue;
      for (let c = 0; c < set.distM.length; c++) {
        const vel = chunkVelocity(set, c, gapPace);
        if (vel === null) continue;
        const at = i * N_BUCKETS + binForVelocity(vel, v, 1); // zoneBars 1: bin = bucket
        out.km[at] += set.distM[c]! / 1000;
        out.min[at] += effortSec(set, c, gapPace) / 60;
      }
    }
  }
  return out;
}

export interface ZoneArea {
  /** bands[b][i]: bucket b per week on day i */
  bands: Float64Array[];
  total: Float64Array;
}

/** One window's rolling per-week sums of each bucket (km or minutes). */
export function zoneArea(buckets: Float64Array, n: number, windowDays: number): ZoneArea {
  const bands = Array.from({ length: N_BUCKETS }, (_, b) => {
    const perDay = new Float64Array(n);
    for (let i = 0; i < n; i++) perDay[i] = buckets[i * N_BUCKETS + b]!;
    return perWeek(perDay, windowDays);
  });
  const total = new Float64Array(n);
  for (const band of bands) for (let i = 0; i < n; i++) total[i] += band[i]!;
  return { bands, total };
}
