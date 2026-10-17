import type { Daily, RunData } from './daily';

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

/** The inverse: the speed (m/min) whose VO2 cost is `vo2`. */
export function velocityFromVo2(vo2: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/** Fraction of VO2max sustainable for `tMin` minutes. */
export function pctVo2max(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
}

/** The VDOT a stretch of `km` in `sec` seconds implies; 0 when there is nothing to read. */
export function impliedVdot(km: number, sec: number): number {
  if (!(km > 0) || !(sec > 0)) return 0;
  const v = (km * 1000) / (sec / 60);
  return vo2FromVelocity(v) / pctVo2max(sec / 60);
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

/**
 * Each day's best effort. An effort is a whole *run*, or one of its segments (manual laps)
 * at least `minLapM` long; never the day, since two runs glued together overstate VDOT.
 */
export function dayVdots(daily: Daily, opts: VdotOptions): DayVdots {
  const value = new Float64Array(daily.n);
  const source: (VdotSource | null)[] = new Array(daily.n).fill(null);
  for (let i = 0; i < daily.n; i++) {
    let best = 0;
    for (const run of daily.runs[i]!) {
      for (const e of efforts(run, opts)) {
        const v = impliedVdot(e.km, e.sec);
        if (v > best) {
          best = v;
          source[i] = e;
        }
      }
    }
    value[i] = best * opts.correction;
  }
  return { value, source };
}

function efforts(run: RunData, opts: VdotOptions): VdotSource[] {
  const pick = (sec: number, flatSec: number) => (opts.gap && flatSec > 0 ? flatSec : sec);
  const out: VdotSource[] = [];
  const whole = pick(run.sec, run.flatSec);
  if (run.km > 0 && whole > 0) out.push({ kind: 'act', km: run.km, sec: whole, adjusted: whole !== run.sec });
  // A run with one segment has no laps worth reading separately: the whole run is the effort.
  if (run.segments.length > 1) {
    for (const s of run.segments) {
      if (s.km * 1000 < opts.minLapM) continue;
      const sec = pick(s.sec, s.flatSec);
      out.push({ kind: 'lap', km: s.km, sec, adjusted: sec !== s.sec });
    }
  }
  return out;
}

/**
 * Rolling maximum over the trailing `window` days, today included, in O(N) with a
 * monotonic deque. null (not 0) before any reading exists: VDOT has no meaningful zero.
 */
export function rollingMax(values: ArrayLike<number>, window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length);
  const dq: number[] = []; // indices, values decreasing; front = current max
  let head = 0;
  for (let i = 0; i < values.length; i++) {
    while (head < dq.length && dq[head]! <= i - window) head++;
    while (dq.length > head && values[dq[dq.length - 1]!]! <= values[i]!) dq.pop();
    dq.push(i);
    const max = values[dq[head]!]!;
    out[i] = max > 0 ? max : null;
  }
  return out;
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
