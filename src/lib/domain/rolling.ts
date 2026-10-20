import { todo } from '../exercise';
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

/*
 * TODO(E02) · rolling sums · difficulty ★☆☆ · phase 1
 * The one loop behind every rolling line on the page.
 *   rollingSum(values, window)  out[i] = values[i − window + 1] + … + values[i], fewer terms at
 *                               the start (nothing before index 0). O(N): keep a running sum,
 *                               add the value entering the window, subtract the one leaving.
 *   perWeek(values, windowDays) that sum as a rate per week: sum × 7 ÷ windowDays.
 * Edge cases that matter, and why:
 * - Snap float dust: adding and subtracting the same numbers in a different order leaves
 *   ±1e-15 instead of 0 over a stretch with no runs, and negative dust prints "-0.0 km".
 *   After subtracting, anything below DUST becomes exactly 0 (the inputs are rounded to the
 *   metre, so anything that small is dust by definition).
 * - Divide by the full window, always, never by the days elapsed so far: a 64-week line
 *   ramps up from zero rather than reading one run on day one as a huge weekly average.
 * Background: legacy/CLAUDE.md, "The model" (the bullet "Everything is divided by its full
 * window, always") and "Gotchas that have bitten before" ("Negative zero").
 * Concepts:
 * - Float64Array: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float64Array
 * - ArrayLike / typed array map: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/map
 * - why 0.1 + 0.2 isn't 0.3: https://floating-point-gui.de/basic/
 * Check: npm run exercise E02 (tests/domain/windows.test.ts, "E02 rolling sums").
 * Spoiler: the sliding sums inside `recompute()` in legacy/running-history.html.
 */
/** out[i] = sum of values[i − window + 1 … i] (fewer at the start), dust-snapped. */
export function rollingSum(values: ArrayLike<number>, window: number): Float64Array {
  return todo('E02', values, window);
}

/** The rolling sum as a rate per week: sum × 7 ÷ window days. */
export function perWeek(values: ArrayLike<number>, windowDays: number): Float64Array {
  return todo('E02', values, windowDays);
}
