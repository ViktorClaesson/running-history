import { todo, whenDone } from '../../exercise';

/*
 * TODO(E29) · axis ticks · difficulty ★★☆ · phase 5
 *   niceTicks(max)   about four even steps from 0 to at least max, on a step of 1, 2, 2.5 or 5
 *                    × 10ⁿ: raw = max ÷ 4, mag = 10^floor(log10(raw)), step = the first of
 *                    1/2/2.5/5/10 × mag that is ≥ raw; ticks 0, step, 2·step … up to the first
 *                    ≥ max. Returns { ticks, step }.
 *   logUp(v)         v rounded up to 1, 2 or 5 × 10ⁿ (LOG_MANT; logDec gives the 10ⁿ).
 *   logDown(v)       v rounded down to 1, 2 or 5 × 10ⁿ.
 *   logTicks(lo, hi) every 1/2/5 × 10ⁿ value in [lo, hi], ends included.
 * Edge cases that matter, and why:
 * - Floating point: 0.1 × 3 isn't 0.3, so compare with a small tolerance (1e-9) when testing
 *   "≥ raw", "≥ max" or "in range", or 50 might round up to 100.
 * - A log axis wants gridlines on numbers you'd say out loud, so uneven spacing is the point.
 * Background: legacy/CLAUDE.md, "The bar panel's axis: log, linear, and the cap".
 * Concepts:
 * - Math.log10: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/log10
 * - logarithmic scales: https://en.wikipedia.org/wiki/Logarithmic_scale
 * Check: npm run exercise E29 (tests/ui/ticks.test.ts). In the app the line panels' axes land
 * on round numbers (until now: four plain equal steps).
 * Spoiler: `niceTicks()`, `logUp()`, `logDown()` and `logTicks()` in legacy/running-history.html.
 */
/** Axis ticks. */

/** About four even steps from 0 to at least `max`, on 1/2/2.5/5 × 10ⁿ. */
export function niceTicks(max: number): { ticks: number[]; step: number } {
  return todo('E29', max);
}

/**
 * The ticks the linear panels use: niceTicks, or until exercise E29 is done four plain
 * equal steps, so every panel can draw from the start.
 */
export function axisTicks(max: number): { ticks: number[]; step: number } {
  return whenDone(
    () => niceTicks(max),
    () => ({ ticks: [0, 1, 2, 3, 4].map((k) => (k * max) / 4), step: max / 4 }),
  );
}

/**
 * A log axis wants gridlines on numbers you'd say out loud, so both ends round out to
 * 1/2/5 × 10ⁿ and every such value between becomes a tick (uneven spacing is the point).
 */
export const LOG_MANT = [1, 2, 5];
/** The power of ten at or below v (2.5 → 1, 12 → 10, 0.7 → 0.1). */
export const logDec = (v: number): number => 10 ** Math.floor(Math.log10(v) + 1e-12);

export function logUp(v: number): number {
  return todo('E29', v);
}

export function logDown(v: number): number {
  return todo('E29', v);
}

export function logTicks(lo: number, hi: number): number[] {
  return todo('E29', lo, hi);
}

/** Enough decimals to tell ticks apart below 1. */
export const logTickText = (v: number): string =>
  v >= 1 ? String(+v.toFixed(2)) : v.toFixed(Math.max(0, -Math.floor(Math.log10(v) + 1e-12)));
