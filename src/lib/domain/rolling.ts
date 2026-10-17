/**
 * Trailing-window sums, the one loop behind every rolling line on the page.
 *
 * Two rules from the legacy app (legacy/CLAUDE.md, "The model" and "Negative zero"):
 * - **Divided by the full window, always**, never by days elapsed: each window's first
 *   stretch ramps up from zero rather than reading one run on day one as a huge average.
 * - **Snap float dust to zero.** A sliding sum adds and subtracts the same numbers in a
 *   different order, so over a stretch with no runs it lands on ±1e-15 instead of 0, and
 *   negative dust prints as "-0.0 km". Inputs are rounded (km to the metre), so anything
 *   below DUST is dust by definition.
 */
export const DUST = 1e-9;

/** out[i] = sum of values[i − window + 1 … i] (fewer at the start), dust-snapped. */
export function rollingSum(values: ArrayLike<number>, window: number): Float64Array {
  const out = new Float64Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!;
    if (i >= window) {
      sum -= values[i - window]!;
      if (sum < DUST) sum = 0;
    }
    out[i] = sum;
  }
  return out;
}

/** The rolling sum as a rate per week: sum × 7 ÷ window days. */
export function perWeek(values: ArrayLike<number>, windowDays: number): Float64Array {
  const sums = rollingSum(values, windowDays);
  return sums.map((s) => (s * 7) / windowDays);
}
