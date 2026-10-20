import { todo } from '../exercise';
import type { Daily } from './daily';

/**
 * VDOT, Jack Daniels' fitness score, from two published Daniels & Gilbert (1979) curves:
 * the VO2 cost of running at a speed, and the fraction of VO2max a runner can hold for a
 * duration. A stretch's own pace and duration through both gives the VDOT it implies,
 * exactly like a race calculator, generalised to any effort. Checked against vdoto2.com's
 * worked example (tests/domain/vdot.test.ts). See legacy/CLAUDE.md, "VDOT and pace zones".
 *
 * Velocities in this file are metres per minute, as in the published formulas.
 */

/** VO2 cost (ml/kg/min) of running at `v` m/min. */
export function vo2FromVelocity(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

/*
 * TODO(E06) · VDOT formulas · difficulty ★☆☆ · phase 2
 *   velocityFromVo2(vo2)   the speed (m/min) whose VO2 cost is vo2: solve
 *                          vo2FromVelocity(v) = vo2 for v. It's a quadratic a·v² + b·v + c = 0
 *                          with a = 0.000104, b = 0.182258, c = −4.6 − vo2; take the positive root.
 *   impliedVdot(km, sec)   the VDOT a stretch of km in sec seconds implies: its speed's VO2 cost
 *                          (vo2FromVelocity, speed in m/min) divided by the fraction of VO2max
 *                          sustainable for that long (pctVo2max, duration in minutes).
 *                          0 when km or sec is not > 0.
 * Edge cases that matter, and why:
 * - Units: metres per minute and minutes, as in the published formulas.
 * - Return 0, not NaN or Infinity, for an empty stretch: callers take maxima over many efforts.
 * Background: legacy/CLAUDE.md, "VDOT and pace zones" (the opening paragraphs).
 * Concepts:
 * - the quadratic formula: https://en.wikipedia.org/wiki/Quadratic_formula
 * - Math.sqrt: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sqrt
 * - Daniels' VDOT, and a calculator to compare with: https://vdoto2.com/calculator
 * Check: npm run exercise E06 (tests/domain/vdot.test.ts, "E06 Daniels & Gilbert").
 * Spoiler: `velocityFromVo2()` and `impliedVdot()` in legacy/running-history.html.
 */
/** The inverse: the speed (m/min) whose VO2 cost is `vo2`. */
export function velocityFromVo2(vo2: number): number {
  return todo('E06', vo2);
}

/** Fraction of VO2max sustainable for `tMin` minutes. */
export function pctVo2max(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
}

/** The VDOT a stretch of `km` in `sec` seconds implies; 0 when there is nothing to read. */
export function impliedVdot(km: number, sec: number): number {
  return todo('E06', km, sec);
}

export interface VdotOptions {
  /** Laps (segments) shorter than this are not trusted on their own: pctVo2max is calibrated for ~3.5 min and up. */
  minLapM: number;
  /** Every reading × this: the watch reads a little fast. */
  correction: number;
  /** Read the flat-equivalent time instead of the real one. */
  gap: boolean;
}

/** What a day's reading is based on, for the readout. */
export interface VdotSource {
  kind: 'act' | 'lap';
  km: number;
  sec: number;
  /** The time is grade-adjusted (differs from the real one). */
  adjusted: boolean;
}

export interface DayVdots {
  /** Each day's own best reading (corrected), 0 when it has none. */
  value: Float64Array;
  source: (VdotSource | null)[];
}

/*
 * TODO(E07) · VDOT per day · difficulty ★★☆ · phase 2
 *   dayVdots(daily, opts)
 *     For each day, its best reading: the highest impliedVdot over every *effort* of every run
 *     that day, times opts.correction (0 when there is none). Also record which effort it was
 *     (`source[i]`, a VdotSource, null when none).
 *     The efforts of one run are:
 *     - the whole run (kind 'act'): run.km in run.sec seconds, when both are > 0;
 *     - and, only when the run has more than one segment, each segment (kind 'lap') at least
 *       opts.minLapM metres long.
 *     With opts.gap, read the grade-adjusted time (flatSec) instead of sec, where it is > 0;
 *     `adjusted` says whether the time used differs from the real one.
 * Edge cases that matter, and why:
 * - Never the day: two 5 km runs at 4:00/km imply a 5 km VDOT, not a 10 km-in-40:00 one. That
 *   mistake inflated the legacy app's VDOT until it was fixed.
 * - Laps shorter than minLapM are skipped: pctVo2max is calibrated for efforts of minutes, and
 *   a 400 m sprint reads absurdly high.
 * - A one-segment run has no laps worth reading separately (the "lap" is the whole run).
 * Background: legacy/CLAUDE.md, "VDOT and pace zones" ("An effort is an activity, never a day",
 * "VDOT correction", and the grade-adjusted pace bullets).
 * Concepts:
 * - Float64Array: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float64Array
 * - Array.prototype.fill: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill
 * Check: npm run exercise E07 (tests/domain/vdot.test.ts, "E07 day VDOT"). With E08, the VDOT
 * panel and the readout's VDOT row appear.
 * Spoiler: `recomputeDayVdot()` and `lapsOfAct()` in legacy/running-history.html.
 */
/**
 * Each day's best effort. An effort is a whole *run*, or one of its segments (manual laps)
 * at least `minLapM` long; never the day, since two runs glued together overstate VDOT.
 */
export function dayVdots(daily: Daily, opts: VdotOptions): DayVdots {
  return todo('E07', daily, opts);
}

/*
 * TODO(E08) · rolling max · difficulty ★★★ · phase 2
 *   rollingMax(values, window)
 *     out[i] = the largest of values[i − window + 1 … i] (today included, fewer at the start),
 *     or null when that largest value is not > 0: VDOT has no meaningful zero, it just doesn't
 *     exist yet.
 * Do it in O(N), not O(N × window): the VDOT window is 350 days by default, over ten years of
 * days. Keep a *monotonic deque* of indices whose values decrease from front to back:
 * - drop indices from the front once they have left the window;
 * - before pushing i, pop from the back every index whose value is ≤ values[i] (it can never
 *   be the maximum again: i is newer and at least as big);
 * - the front is then the current maximum.
 * Edge cases that matter, and why:
 * - window = 1 is just the values themselves (with 0 → null).
 * - An empty input gives an empty output.
 * - Shifting from the front of a JS array is O(n); keep a head index instead of shift().
 * Background: legacy/CLAUDE.md, "VDOT and pace zones" (the rolling peak and "Near-max days").
 * Concepts:
 * - the minimum/maximum queue: https://cp-algorithms.com/data_structures/stack_queue_modification.html
 * - Array.prototype.pop: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/pop
 * Check: npm run exercise E08 (tests/domain/vdot.test.ts, "E08 rolling max"). In the app the
 * VDOT panel appears; with E09 onwards everything that reads pace against VDOT can follow.
 * Spoiler: `recomputeVdot()` in legacy/running-history.html.
 */
/**
 * Rolling maximum over the trailing `window` days, today included, in O(N) with a
 * monotonic deque. null (not 0) before any reading exists: VDOT has no meaningful zero.
 */
export function rollingMax(values: ArrayLike<number>, window: number): (number | null)[] {
  return todo('E08', values, window);
}

/** A day's own reading as a share of the peak in force that day (1 = it is the peak), or null. */
export function vdotVsPeak(dayValue: number, peak: number | null): number | null {
  return dayValue > 0 && peak !== null && peak > 0 ? dayValue / peak : null;
}

/** Within `pct` percent of the peak (0 = only the days that set it). */
export function isNearMax(dayValue: number, peak: number | null, pct: number): boolean {
  const r = vdotVsPeak(dayValue, peak);
  return r !== null && r >= 1 - pct / 100;
}
