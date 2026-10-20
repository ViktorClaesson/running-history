import { fillAltitude, sampleGrades } from './gap';
import { detectSegments } from './laps';
import type { ParsedRun, Pause, WatchLap } from './parsedRun';
import type { SampleSet } from './sampleTypes';
import type { ActivityId } from './types';

/**
 * Raw recording → cleaned samples: per interval (sample i−1 → sample i) the timer seconds
 * (pauses removed), metres, the gradient, heart rate and segment. Speed is always read as
 * metres ÷ seconds over a chunk: the watch's own smoothed speed lags several seconds behind
 * every acceleration, which under-reads short reps.
 * Chunking happens later and in memory (chunks.ts), so changing the chunk length needs no
 * reprocessing.
 */
export function buildSamples(id: ActivityId, run: ParsedRun, processingVersion: number): SampleSet {
  const segmentation = detectSegments(run.laps);
  const base = {
    activityId: id,
    processingVersion,
    lapRule: segmentation.rule,
    segmentCount: segmentation.count,
  };
  if (run.t.length < 2) return { ...base, ...singleSample(run) };
  const n = run.t.length - 1;
  const lapOf = lapOfIntervals(run.t, run.laps);
  const alt = fillAltitude(run.alt);
  const grades = alt ? sampleGrades(run.dist, alt) : null;
  const s = {
    seg: new Uint16Array(n),
    dt: new Float32Array(n),
    dist: new Float32Array(n),
    grade: new Float32Array(n),
    hr: new Float32Array(n),
  };
  for (let k = 0; k < n; k++) {
    const i = k + 1; // interval k ends at sample i
    s.dt[k] = timerSeconds(run.t[i - 1]!, run.t[i]!, run.pauses);
    s.dist[k] = Math.max(0, run.dist[i]! - run.dist[i - 1]!);
    s.grade[k] = grades ? grades[i]! : 0;
    s.hr[k] = run.hr[i]!;
    s.seg[k] = lapOf[i]! >= 0 ? segmentation.segmentOfLap[lapOf[i]!]! : 0;
  }
  return { ...base, ...s };
}

/** A run with no samples (a manual entry): one interval from the session totals. */
export function singleSample(
  run: ParsedRun,
): Omit<SampleSet, 'activityId' | 'processingVersion' | 'lapRule' | 'segmentCount'> {
  const { distM, timerS } = run.totals;
  return {
    seg: Uint16Array.of(0),
    dt: Float32Array.of(timerS),
    dist: Float32Array.of(distM),
    grade: Float32Array.of(0),
    hr: Float32Array.of(NaN),
  };
}

/**
 * Seconds of timer time between two samples: the gap minus any part of it the timer was
 * stopped. Standing at a red light with the timer running still counts, as on the watch.
 */
export function timerSeconds(from: number, to: number, pauses: readonly Pause[]): number {
  let paused = 0;
  for (const p of pauses) paused += Math.max(0, Math.min(to, p.to) - Math.max(from, p.from));
  return Math.max(0, to - from - paused);
}

/** Interval ending at sample i belongs to the last lap that started strictly before sample i (−1 if no laps). */
export function lapOfIntervals(t: Float64Array, laps: readonly WatchLap[]): Int32Array {
  const out = new Int32Array(t.length).fill(laps.length ? 0 : -1);
  let k = 0;
  for (let i = 1; i < t.length; i++) {
    while (k + 1 < laps.length && laps[k + 1]!.startT < t[i]!) k++;
    if (laps.length) out[i] = k;
  }
  return out;
}
