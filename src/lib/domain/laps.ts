import type { LapRule } from './chunkTypes';
import type { WatchLap } from './parsedRun';

export interface Segmentation {
  rule: LapRule;
  /** For each watch lap, the segment it belongs to. Non-decreasing, starting at 0. */
  segmentOfLap: number[];
  /** Number of segments, ≥ 1 (a run with no laps at all is one segment). */
  count: number;
}

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
  const segmentOfLap: number[] = [];
  let seg = 0;
  let button = false;
  let workout = false;
  for (let i = 0; i < laps.length; i++) {
    segmentOfLap.push(seg);
    const next = laps[i + 1];
    if (!next) break;
    const byButton = laps[i]!.trigger === 'manual';
    const byStep = laps[i]!.wktStepIndex !== next.wktStepIndex;
    if (byButton) button = true;
    if (byStep) workout = true;
    if (byButton || byStep) seg++;
  }
  const rule: LapRule =
    button && workout ? 'button+workout' : button ? 'button' : workout ? 'workout' : 'none';
  return { rule, segmentOfLap, count: seg + 1 };
}
