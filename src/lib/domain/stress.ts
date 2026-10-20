import { todo } from '../exercise';
import type { Daily } from './daily';

/**
 * How hard the running was on the body, not just how much. Every chunk scores
 *   raw       hours × (km/h)²
 *   relative  100 × hours × (speed ÷ threshold speed)²
 * so an hour at threshold is exactly 100 relative (the TSS convention). Threshold speed is
 * the threshold anchor (88% VDOT) at that day's own rolling VDOT.
 *
 * Always the **raw** speed (metres ÷ time), never grade-adjusted: this is meant to measure
 * the mechanical stress of landing, and a faster stride lands harder whatever the gradient.
 * (The legacy app followed the grade-adjusted-pace toggle here; that changed on purpose.)
 */
export interface DayStress {
  raw: Float64Array;
  rel: Float64Array;
}

/*
 * TODO(E12) · stress score · difficulty ★☆☆ · phase 2
 *   dayStress(daily, vdot)
 *     For every day, over every chunk of every run (runs with chunks === null are skipped):
 *       raw  += hours × (km/h)²
 *       rel  += 100 × hours × (km/h ÷ threshold km/h)²
 *     where hours = durS ÷ 3600, km/h = (distM ÷ 1000) ÷ hours, and the threshold speed is
 *     velocityFromVo2(THRESHOLD_PCT × vdot[i]) × 0.06 (m/min → km/h). rel stays 0 on a day
 *     with no VDOT yet.
 * Edge cases that matter, and why:
 * - Always the raw speed (distM), never flatM: stress measures the landing, and a faster stride
 *   lands harder whatever the gradient. (The legacy app followed the GAP toggle; that changed.)
 * - Skip chunks with no time: km/h would divide by zero.
 * - An hour at threshold is exactly 100 relative, the TSS convention.
 * Background: legacy/CLAUDE.md, "Stress score".
 * Concepts:
 * - nested loops over typed arrays: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Loops_and_iteration
 * Check: npm run exercise E12 (tests/domain/zones.test.ts, "E12 stress"). In the app the stress
 * panels (turn them on under the settings) and the readout's stress rows appear.
 * Spoiler: `recomputeDayStress()` in legacy/running-history.html.
 */
export function dayStress(daily: Daily, vdot: readonly (number | null)[]): DayStress {
  return todo('E12', daily, vdot);
}
