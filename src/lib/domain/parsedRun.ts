/**
 * One run's recording, decoded into plain arrays: the input to chunking. Deliberately
 * independent of the FIT format (data/fit.ts does the decoding), so the domain never
 * imports a file-format library and tests can build runs by hand.
 *
 * All times are seconds since the first sample.
 */
export interface ParsedRun {
  /** Sample times, seconds, non-decreasing. */
  t: Float64Array;
  /** Cumulative distance at each sample, metres. */
  dist: Float64Array;
  /** Altitude at each sample, metres, NaN where missing. */
  alt: Float64Array;
  /** Heart rate at each sample, bpm, NaN where missing. */
  hr: Float64Array;
  /** The watch's smoothed speed at each sample, m/s, NaN where missing. */
  speed: Float64Array;
  /** Stretches when the watch timer was stopped, [from, to] in seconds. */
  pauses: Pause[];
  /** The watch's laps, in order, autolaps included. */
  laps: WatchLap[];
  /** The session's own totals; the fallback for a run with no samples (a manual entry). */
  totals: { distM: number; timerS: number };
}

export interface Pause {
  from: number;
  to: number;
}

export interface WatchLap {
  /** Seconds since the first sample. A lap runs until the next lap's start. */
  startT: number;
  /** FIT `lap_trigger`: 'manual', 'distance', 'time', 'sessionEnd', … or null if absent. */
  trigger: string | null;
  /** FIT `wkt_step_index`: set on laps a structured workout made, null otherwise. */
  wktStepIndex: number | null;
  distM: number;
  timerS: number;
}
