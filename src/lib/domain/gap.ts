import type { WatchLap } from './parsedRun';

/**
 * Grade-adjusted ("flat-equivalent") time.
 *
 * Running uphill costs more energy per metre than running on the flat, so a slow climb
 * can be as hard as a fast flat stretch. The flat-equivalent time of a stretch is how long
 * the same effort would have taken on level ground.
 *
 * Model: Minetti et al. (2002), "Energy cost of walking and running at extreme uphill and
 * downhill slopes", J Appl Physiol 93:1039-1046, https://doi.org/10.1152/japplphysiol.01177.2001
 * gives the energy cost per metre as a polynomial in the grade. Equal effort means equal
 * power (cost × speed), so the flat-equivalent speed is v × C(g) / C(0), and the
 * flat-equivalent time is dt × C(0) / C(g).
 *
 * Minetti on its own gives downhills their full energy saving, which neither Garmin's nor
 * Strava's model does (they come out ~1% higher over a run). So per sample we use
 * Minetti's *shape* (where in the lap the hills were), then scale each watch lap so its
 * total matches the watch's own grade-adjusted speed for that lap. See
 * docs/intervals-api-findings.md, "GAP".
 */

/** Grade is measured over this much distance, centred on the sample: smooths altimeter noise. */
export const GRADE_WINDOW_M = 50;
/** Minetti measured −0.45 … +0.45; beyond that the polynomial isn't meaningful. */
export const MINETTI_GRADE_LIMIT = 0.45;
/** A lap's flat/raw ratio is trusted only inside this range (the real max seen is 1.17). */
const RATIO_LIMITS = [0.5, 2] as const;

/** Energy cost of running at `grade` (rise/run), J/kg/m. C(0) = 3.6. */
export function minettiCost(grade: number): number {
  const g = Math.max(-MINETTI_GRADE_LIMIT, Math.min(MINETTI_GRADE_LIMIT, grade));
  return 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6;
}

/** Flat-equivalent seconds per real second at `grade`: < 1 uphill, > 1 downhill. */
export function flatTimeFactor(grade: number): number {
  return minettiCost(0) / minettiCost(grade);
}

/**
 * Altitude at distance `d` along the run, linearly interpolated between samples.
 * `dist` is non-decreasing (it repeats while standing still).
 */
export function altitudeAt(dist: Float64Array, alt: Float64Array, d: number): number {
  const n = dist.length;
  if (d <= dist[0]!) return alt[0]!;
  if (d >= dist[n - 1]!) return alt[n - 1]!;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (dist[mid]! < d) lo = mid;
    else hi = mid;
  }
  const span = dist[hi]! - dist[lo]!;
  return span > 0 ? alt[lo]! + ((alt[hi]! - alt[lo]!) * (d - dist[lo]!)) / span : alt[hi]!;
}

/** Fills NaN altitudes from their neighbours. Returns null when there is no altitude at all. */
export function fillAltitude(alt: Float64Array): Float64Array | null {
  const out = Float64Array.from(alt);
  const first = out.findIndex((v) => Number.isFinite(v));
  if (first < 0) return null;
  for (let i = 0; i < first; i++) out[i] = out[first]!;
  for (let i = first + 1; i < out.length; i++) if (!Number.isFinite(out[i]!)) out[i] = out[i - 1]!;
  return out;
}

/** Grade at each sample over a GRADE_WINDOW_M window centred on it. */
export function sampleGrades(dist: Float64Array, alt: Float64Array, windowM = GRADE_WINDOW_M): Float64Array {
  const g = new Float64Array(dist.length);
  const half = windowM / 2;
  const start = dist[0] ?? 0;
  const end = dist[dist.length - 1] ?? 0;
  for (let i = 0; i < dist.length; i++) {
    const a = Math.max(start, dist[i]! - half);
    const b = Math.min(end, dist[i]! + half);
    g[i] = b - a > 1 ? (altitudeAt(dist, alt, b) - altitudeAt(dist, alt, a)) / (b - a) : 0;
  }
  return g;
}

/**
 * Rescales `flatDt` in place so each watch lap's flat/raw ratio equals the watch's own:
 * avgGapSpeed / (distance / timer time). `lapOf[i]` is interval i's lap (−1 for none).
 * Returns whether any lap was scaled.
 */
export function scaleToWatchLaps(
  dt: Float64Array,
  flatDt: Float64Array,
  lapOf: Int32Array,
  laps: readonly WatchLap[],
): boolean {
  const sumDt = new Float64Array(laps.length);
  const sumFlat = new Float64Array(laps.length);
  for (let i = 0; i < dt.length; i++) {
    const k = lapOf[i]!;
    if (k < 0) continue;
    sumDt[k] += dt[i]!;
    sumFlat[k] += flatDt[i]!;
  }
  const scale = laps.map((lap, k) => {
    const target = watchRatio(lap);
    return target !== null && sumFlat[k]! > 0 ? sumDt[k]! / sumFlat[k]! / target : null;
  });
  for (let i = 0; i < dt.length; i++) {
    const s = lapOf[i]! >= 0 ? scale[lapOf[i]!] : null;
    if (s != null) flatDt[i] = flatDt[i]! * s;
  }
  return scale.some((s) => s !== null);
}

/** The watch's flat/raw speed ratio for a lap, or null when it didn't record one. */
function watchRatio(lap: WatchLap): number | null {
  if (!(lap.avgGapSpeed! > 0) || !(lap.distM > 0) || !(lap.timerS > 0)) return null;
  const ratio = lap.avgGapSpeed! / (lap.distM / lap.timerS);
  return ratio >= RATIO_LIMITS[0] && ratio <= RATIO_LIMITS[1] ? ratio : null;
}
