/**
 * Gradient and grade-adjusted pace.
 *
 * **Gradient.** The watch records altitude (barometric, 0.2 m steps), not gradient, and
 * samples ~3 m apart, so the slope between neighbouring samples jumps in ~7% steps. The
 * gradient at a sample is therefore read over GRADE_WINDOW_M of distance centred on it
 * (about 8 samples): long enough to smooth the altimeter, short enough that a 300 m hill rep
 * keeps its real shape. Measured on a hill session and Lidingöloppet in docs/intervals-api-findings.md.
 *
 * **Grade-adjusted pace.** Minetti et al. (2002), "Energy cost of walking and running at
 * extreme uphill and downhill slopes", J Appl Physiol 93:1039–1046,
 * https://doi.org/10.1152/japplphysiol.01177.2001 gives the energy cost per metre C(g)
 * at gradient g. A metre at gradient g costs as much as C(g) ÷ C(0) metres on the flat, so a
 * stretch's grade-adjusted speed is (flat-equivalent metres) ÷ (time). Energy adds up, so the
 * *flat-equivalent metres* are what gets summed, never a flat-equivalent time: that way a
 * downhill counts as easier and a course with equal up and down counts as harder than flat.
 */

export const GRADE_WINDOW_M = 25;
/** Minetti measured −0.45 … +0.45; beyond that the polynomial isn't meaningful. */
export const MINETTI_GRADE_LIMIT = 0.45;

/** Energy cost of running at gradient `g` (rise/run), J/kg/m. C(0) = 3.6. */
export function minettiCost(g: number): number {
  const x = Math.max(-MINETTI_GRADE_LIMIT, Math.min(MINETTI_GRADE_LIMIT, g));
  return 155.4 * x ** 5 - 30.4 * x ** 4 - 43.3 * x ** 3 + 46.3 * x ** 2 + 19.5 * x + 3.6;
}

/** Flat-equivalent metres per real metre at gradient `g`: > 1 uphill, < 1 downhill. */
export function flatMetresFactor(g: number): number {
  return minettiCost(g) / minettiCost(0);
}

/**
 * Altitude at distance `d` along the run, linearly interpolated between samples by binary
 * search. `dist` is non-decreasing (it repeats while standing still).
 */
export function altitudeAt(dist: ArrayLike<number>, alt: ArrayLike<number>, d: number): number {
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

/**
 * Gradient at each sample: altitude `windowM / 2` ahead minus altitude `windowM / 2` behind,
 * over that distance (the window is clipped at the ends of the run, not zero-padded).
 */
export function sampleGrades(
  dist: ArrayLike<number>,
  alt: ArrayLike<number>,
  windowM = GRADE_WINDOW_M,
): Float64Array {
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
