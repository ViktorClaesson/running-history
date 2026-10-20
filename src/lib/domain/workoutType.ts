import { todo } from '../exercise';
import type { Chunks } from './chunks';
import { ZONES } from './paceZones';

/**
 * What kind of session a run was. Every chunk scores speed (km/h)^exp × distance (km)
 * towards its zone; then, from the hardest zone down, each zone is pooled with every faster
 * one, and the first pool to reach `share`% of the total names the run. Pooling is what
 * stops a hard session split across two zones losing to the easy running around it.
 * Standing and Walking score nothing; Recovery is what's left when no pool reaches the
 * share. See legacy/CLAUDE.md, "Workout type".
 */
export const WORKOUT_TYPES = [
  { key: 'recovery', label: 'Recovery' },
  ...ZONES.map((z) => ({ key: z.key, label: z.label })),
] as const;
/** Index into WORKOUT_TYPES: 0 = recovery, 1–5 = the zones endurance … repetition. */
export type WorkoutTypeIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface WorkoutType {
  type: WorkoutTypeIndex;
  /** The winning pool's share of the score, percent. */
  pct: number;
  /** The pool included faster zones too ("threshold+"). */
  plus: boolean;
  /** The run had no running chunks at all (only standing/walking). */
  noRunning: boolean;
}

/*
 * TODO(E11) · workout type · difficulty ★★☆ · phase 2
 *   zoneScores(c, vdot, exp, gapPace)
 *     A score per type [recovery, endurance, marathon, threshold, interval, repetition]: every
 *     chunk with a speed adds (speed in km/h)^exp × (its km) to the type of the bin it falls in
 *     (binEdges(vdot, 1), so bin = whole zone). Recovery's bin scores to type 0, the zones to
 *     1–5. Standing and Walking score nothing. m/min × 0.06 = km/h.
 *   workoutFromScores(sc, share)
 *     From the hardest type down to endurance, pool each type with every faster one; the first
 *     pool reaching share% of the total names the run: { type, pct (that pool's share), plus
 *     (the pool included faster types too), noRunning: false }. If none does, it's Recovery
 *     with pct = recovery's share. A total of 0 is { type: 0, pct: 0, plus: false, noRunning: true }.
 * Edge cases that matter, and why:
 * - Pooling is what stops a hard session split across two zones (intervals spilling into
 *   repetition) losing to the easy running around it.
 * - Scoring by speed^exp × distance, not × duration: duration favoured slow running.
 * Background: legacy/CLAUDE.md, "Workout type (the other bar colouring)", with worked examples
 * the tests use.
 * Concepts:
 * - Array.prototype.reduce: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce
 * - exponentiation (**): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Exponentiation
 * Check: npm run exercise E11 (tests/domain/zones.test.ts, "E11 workout type"). In the app the
 * bars take workout-type colours (the default colouring), and the table and readout name them.
 * Spoiler: `zoneScoresOf()` and `workoutFromScores()` in legacy/running-history.html.
 */
/** Score per type [recovery, endurance … repetition] for one run, at that day's VDOT. */
export function zoneScores(c: Chunks, vdot: number, exp: number, gapPace: boolean): number[] {
  return todo('E11', c, vdot, exp, gapPace);
}

export function workoutFromScores(sc: readonly number[], share: number): WorkoutType {
  return todo('E11', sc, share);
}
