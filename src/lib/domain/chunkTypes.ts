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
 * Where a chunk's flat-equivalent (grade-adjusted) duration came from:
 * - `minetti-scaled`: Minetti's cost of running per sample, scaled so each watch lap
 *   matches the watch's own grade-adjusted speed (the normal case)
 * - `minetti`: Minetti alone, when the watch recorded no grade-adjusted speed
 * - `none`: no altitude to work from, so flat time = real time
 */
export type GapMethod = 'minetti-scaled' | 'minetti' | 'none';

/**
 * One run cut into roughly CHUNK_DISTANCE_M pieces that never cross a segment (manual
 * lap) boundary. Stored *columnar*: one typed array per field, all the same length, so
 * chunk `i` is `set.distM[i]`, `set.durS[i]`, and so on. That is compact in IndexedDB
 * (typed arrays are stored natively) and fast to loop over.
 */
export interface ChunkSet {
  activityId: ActivityId;
  /** The PROCESSING_VERSION this was built with; a mismatch means "rebuild from raw". */
  processingVersion: number;
  chunkDistanceM: number;
  lapRule: LapRule;
  gapMethod: GapMethod;
  /** How many segments the run has (≥ 1). Segment indexes run 0 … segmentCount − 1. */
  segmentCount: number;
  /** Segment (manual lap) index of each chunk. Non-decreasing. */
  seg: Uint16Array;
  /** Distance from the start of the run at which the chunk begins, metres. */
  startM: Float32Array;
  distM: Float32Array;
  /** Timer time in the chunk, seconds (paused time excluded). */
  durS: Float32Array;
  /** Flat-equivalent (grade-adjusted) duration, seconds. */
  flatDurS: Float32Array;
  /** Time-weighted mean heart rate, bpm, or NaN when there is none. */
  hr: Float32Array;
  gainM: Float32Array;
  lossM: Float32Array;
}

/** Number of chunks in a set. */
export const chunkCount = (set: ChunkSet): number => set.distM.length;
