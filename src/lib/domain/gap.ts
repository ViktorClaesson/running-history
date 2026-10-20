import { todo } from '../exercise';
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
 * https://doi.org/10.1152/japplphysiol.01177.2001 gives the energy cost per metre C(g) at
 * gradient g, measured on a treadmill. Taken at face value it makes a 6% climb worth +36%
 * in pace, far more than Garmin, Strava/Intervals.icu (+13%) or Runalyze (+17%) credit.
 * Runalyze's own code softens it with an exponent, (C(g) / C(0))^0.83. The same
 * construction with exponent 0.5 matches Garmin's per-lap GAP best on 399 of my laps
 * (median error 0.8%, against 1.4% for the raw curve): see docs/intervals-api-findings.md.
 * The exponent is a setting, so 1 (pure Minetti) is one change away.
 *
 * Flat-equivalent *metres* are what gets summed over a stretch, never a flat-equivalent
 * time: that way a downhill counts as easier and equal up and down as harder than flat.
 */

export const GRADE_WINDOW_M = 25;
/** Minetti measured −0.45 … +0.45; beyond that the polynomial isn't meaningful. */
export const MINETTI_GRADE_LIMIT = 0.45;

/*
 * TODO(E17) · grade-adjusted pace · difficulty ★★☆ · phase 3
 *   minettiCost(g)        energy cost of running (J/kg/m) at gradient g (rise ÷ run), Minetti's
 *                         fitted polynomial, with g clamped to ±MINETTI_GRADE_LIMIT first:
 *                         C(g) = 155.4g⁵ − 30.4g⁴ − 43.3g³ + 46.3g² + 19.5g + 3.6
 *   flatMetresFactor(g, exp = DEFAULT_GAP_EXP)
 *                         flat-equivalent metres per real metre: (C(g) ÷ C(0))^exp.
 *   altitudeAt(dist, alt, d)
 *                         the altitude at distance d along the run, linearly interpolated
 *                         between the two samples around it, found by binary search (dist is
 *                         non-decreasing). Before the start or past the end: the end value.
 *   sampleGrades(dist, alt, windowM = GRADE_WINDOW_M)
 *                         the gradient at every sample: altitude windowM ÷ 2 ahead minus
 *                         windowM ÷ 2 behind, over that distance. Clip the window at the ends
 *                         of the run (don't pad with zeros). 0 where the window is under 1 m.
 * Edge cases that matter, and why:
 * - dist repeats while you stand still: two samples at the same distance give a zero-length
 *   span, so interpolate only when the span is > 0.
 * - The altimeter has 0.2 m steps and samples are ~3 m apart, so neighbour-to-neighbour slopes
 *   jump by ~7%: that's why the gradient is read over 25 m (a test checks the smoothing).
 * - Sum flat-equivalent metres over a stretch, never a flat-equivalent time: then a downhill
 *   counts as easier, and equal up and down as harder than flat, as the energy does.
 * Background: the comment at the top of this file; docs/intervals-api-findings.md for how 25 m
 * and exponent 0.5 were measured.
 * Concepts:
 * - Minetti et al. (2002), J Appl Physiol 93:1039–1046: https://doi.org/10.1152/japplphysiol.01177.2001
 * - binary search: https://en.wikipedia.org/wiki/Binary_search_algorithm
 * - linear interpolation: https://en.wikipedia.org/wiki/Linear_interpolation
 * Check: npm run exercise E17 (tests/domain/gap.test.ts). In the app grade-adjusted VDOT and
 * pace start differing from the raw ones (they were equal until now), and laps count for VDOT.
 * Spoiler: `gapRatioOf()` in legacy/running-history.html (a different, Runalyze-based model).
 */
/** Energy cost of running at gradient `g` (rise/run), J/kg/m. C(0) = 3.6. */
export function minettiCost(g: number): number {
  return todo('E17', g);
}

/** The default GAP strength: Minetti's curve to this power (see above). */
export const DEFAULT_GAP_EXP = 0.5;

/**
 * Flat-equivalent metres per real metre at gradient `g`: > 1 uphill, < 1 downhill.
 * `exp` softens Minetti's curve (1 = pure Minetti).
 */
export function flatMetresFactor(g: number, exp = DEFAULT_GAP_EXP): number {
  return todo('E17', g, exp);
}

/**
 * Altitude at distance `d` along the run, linearly interpolated between samples by binary
 * search. `dist` is non-decreasing (it repeats while standing still).
 */
export function altitudeAt(dist: ArrayLike<number>, alt: ArrayLike<number>, d: number): number {
  return todo('E17', dist, alt, d);
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
  return todo('E17', dist, alt, windowM);
}
