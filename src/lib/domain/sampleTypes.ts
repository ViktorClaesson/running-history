import type { ActivityId } from './types';

/**
 * Which rule cut a run into segments (see `detectSegments` in laps.ts):
 * - `button`: the lap button was pressed at least once
 * - `workout`: a structured Garmin workout changed step
 * - `button+workout`: both
 * - `none`: only autolaps or no laps at all, so the whole run is one segment
 */
export type LapRule = 'button' | 'workout' | 'button+workout' | 'none';

/**
 * One run's recording, cleaned up: what processing stores and everything else reads.
 * Stored *columnar*: one typed array per field, all the same length, so sample `i` is
 * `s.dist[i]`, `s.grade[i]`, … Compact in IndexedDB (typed arrays are stored natively) and
 * fast to loop over.
 *
 * Each entry is an *interval*: the stretch from the previous sample to this one (about a
 * second at 1 Hz). Sums over intervals are the run's totals.
 */
export interface SampleSet {
  activityId: ActivityId;
  /** The PROCESSING_VERSION this was built with; a mismatch means "rebuild from raw". */
  processingVersion: number;
  lapRule: LapRule;
  /** How many segments the run has (≥ 1). Segment indexes run 0 … segmentCount − 1. */
  segmentCount: number;
  /** Segment (manual lap / workout step) of each interval. Non-decreasing. */
  seg: Uint16Array;
  /** Timer seconds in the interval (paused time excluded). */
  dt: Float32Array;
  /** Metres covered in the interval, from the distance record. */
  dist: Float32Array;
  /** Gradient (rise ÷ run) over GRADE_WINDOW_M centred on the sample. */
  grade: Float32Array;
  /** Heart rate, bpm, or NaN when there is none. */
  hr: Float32Array;
}

export const sampleCount = (s: SampleSet): number => s.dt.length;
