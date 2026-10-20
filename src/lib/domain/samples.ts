import { todo } from '../exercise';
import type { ParsedRun, Pause, WatchLap } from './parsedRun';
import type { SampleSet } from './sampleTypes';
import type { ActivityId } from './types';

/*
 * TODO(E18) · samples · difficulty ★★☆ · phase 3
 *   timerSeconds(from, to, pauses)
 *     Seconds of timer time between two sample times: to − from, minus the overlap of every
 *     pause [p.from, p.to] with [from, to]; never negative.
 *   buildSamples(id, run, processingVersion)
 *     A decoded recording → the SampleSet processing stores. One entry per *interval*
 *     (sample i − 1 → sample i), so n − 1 entries for n samples:
 *       dt    timerSeconds between the two sample times
 *       dist  the distance gained (never negative: GPS can step back)
 *       grade sampleGrades over the run's altitude (filled with fillAltitude) at sample i,
 *             or 0 when the run has no altitude at all
 *       hr    the heart rate at sample i
 *       seg   the segment of the interval's lap: detectSegments(run.laps).segmentOfLap of
 *             lapOfIntervals(t, laps)[i] (0 when there are no laps)
 *     plus activityId, processingVersion, lapRule and segmentCount from the segmentation.
 *     A run with fewer than two samples (a manual entry) is one interval: singleSample(run).
 * Edge cases that matter, and why:
 * - Pauses: the watch's timer stops, the clock doesn't. Standing at a light with the timer
 *   running still counts, as on the watch.
 * - Columns are typed arrays (Uint16Array, Float32Array): compact in IndexedDB, fast to loop.
 * Background: the comment above buildSamples; docs/intervals-api-findings.md on what the FIT
 * records hold.
 * Concepts:
 * - typed arrays: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays
 * - interval overlap: max(0, min(ends) − max(starts)).
 * Check: npm run exercise E18 (tests/domain/samples.test.ts). The app only runs this when it
 * processes a FIT file, in the worker: after E27, "Reprocess all" rebuilds every run with it.
 * Spoiler: none, the legacy app read a CSV of summaries.
 */
/**
 * Raw recording → cleaned samples: per interval (sample i−1 → sample i) the timer seconds
 * (pauses removed), metres, the gradient, heart rate and segment. Speed is always read as
 * metres ÷ seconds over a chunk: the watch's own smoothed speed lags several seconds behind
 * every acceleration, which under-reads short reps.
 * Chunking happens later and in memory (chunks.ts), so changing the chunk length needs no
 * reprocessing.
 */
export function buildSamples(id: ActivityId, run: ParsedRun, processingVersion: number): SampleSet {
  return todo('E18', id, run, processingVersion);
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
  return todo('E18', from, to, pauses);
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
