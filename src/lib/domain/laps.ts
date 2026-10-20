import { todo } from '../exercise';
import type { LapRule } from './sampleTypes';
import type { WatchLap } from './parsedRun';

export interface Segmentation {
  rule: LapRule;
  /** For each watch lap, the segment it belongs to. Non-decreasing, starting at 0. */
  segmentOfLap: number[];
  /** Number of segments, ≥ 1 (a run with no laps at all is one segment). */
  count: number;
}

/*
 * TODO(E16) · lap detection · difficulty ★★☆ · phase 3
 *   detectSegments(laps)
 *     Cut a run into segments at its *intentional* lap boundaries. A boundary falls at the end
 *     of lap i (never after the last lap) when
 *       1. lap i was ended by the lap button (trigger === 'manual'), or
 *       2. laps i and i + 1 belong to different workout steps (wktStepIndex differs).
 *     Return segmentOfLap (each lap's segment: 0, 0, 1, 1, 1, 2 …), count (≥ 1; no laps at all
 *     is one segment) and rule: 'button+workout', 'button', 'workout' or 'none', from which
 *     of the two kinds of boundary occurred.
 * Edge cases that matter, and why:
 * - Autolaps (every 1 km) are not boundaries: they cut nothing you did on purpose.
 * - Don't just test "trigger is not distance/time": a structured Garmin workout ends its steps
 *   with time or distance triggers exactly like autolap. The step index tells them apart, and
 *   autolaps inside one long workout step share the same index (so they stay together).
 * Background: docs/intervals-api-findings.md, "Laps: manual vs automatic" (the evidence), and
 * PROJECT.md section 5.3 if you have it.
 * Concepts:
 * - the FIT lap message (lap_trigger, wkt_step_index): https://developer.garmin.com/fit/file-types/activity/
 * Check: npm run exercise E16 (tests/domain/laps.test.ts). Visible in the app once the runs are
 * reprocessed with your E18 (after E27): laps then count as efforts for VDOT.
 * Spoiler: none, the legacy app read Runalyze's own lap column (`parseSplits`).
 */
/**
 * Cuts a run into segments at its *intentional* lap boundaries, ignoring autolaps.
 *
 * The heuristic (evidence in docs/intervals-api-findings.md, "Laps: manual vs automatic"):
 * a boundary falls at the end of lap i (not the last lap) when
 *   1. lap i was ended by the lap button (`trigger === 'manual'`), or
 *   2. laps i and i + 1 belong to different workout steps (`wktStepIndex` differs).
 *
 * Why not just "trigger is not distance/time": a structured Garmin workout ends its steps
 * with `time` or `distance` triggers, exactly like autolap does. What tells them apart is
 * the workout step index: workout laps carry one, plain autolaps don't, and autolaps
 * *inside* one workout step (a 3 km warm-up with 1 km autolap on) share the same index.
 */
export function detectSegments(laps: readonly WatchLap[]): Segmentation {
  return todo('E16', laps);
}
