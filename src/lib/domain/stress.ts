import type { Daily } from './daily';
import { effortSec, THRESHOLD_PCT } from './paceZones';
import { velocityFromVo2 } from './vdot';

/**
 * How hard the running was, not just how much. Every chunk scores
 *   raw       hours × (km/h)²
 *   relative  100 × hours × (speed ÷ threshold speed)²
 * so an hour at threshold is exactly 100 relative (the TSS convention). Threshold speed is
 * the threshold anchor (88% VDOT) at that day's own rolling VDOT. Speed follows `gapPace`.
 * See legacy/CLAUDE.md, "Stress score".
 */
export interface DayStress {
  raw: Float64Array;
  rel: Float64Array;
}

export function dayStress(daily: Daily, vdot: readonly (number | null)[], gapPace: boolean): DayStress {
  const raw = new Float64Array(daily.n);
  const rel = new Float64Array(daily.n);
  for (let i = 0; i < daily.n; i++) {
    const v = vdot[i];
    const thresholdKmh = v ? velocityFromVo2(THRESHOLD_PCT * v) * 0.06 : 0;
    for (const run of daily.runs[i]!) {
      const set = run.chunks;
      if (!set) continue;
      for (let c = 0; c < set.distM.length; c++) {
        const h = effortSec(set, c, gapPace) / 3600;
        if (!(h > 0)) continue;
        const kmh = set.distM[c]! / 1000 / h;
        raw[i] += h * kmh * kmh;
        if (thresholdKmh > 0) rel[i] += 100 * h * (kmh / thresholdKmh) ** 2;
      }
    }
  }
  return { raw, rel };
}
