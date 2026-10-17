import type { ChunkSet, GapMethod } from './chunkTypes';
import { fillAltitude, flatTimeFactor, sampleGrades, scaleToWatchLaps } from './gap';
import { detectSegments } from './laps';
import type { ParsedRun, Pause, WatchLap } from './parsedRun';
import type { ActivityId } from './types';

/**
 * Raw recording → chunks: the run cut into ~`chunkDistanceM` pieces of distance, never
 * across a segment (manual lap) boundary, each with a handful of aggregated values.
 *
 * Works on *intervals*: interval i is the stretch between sample i−1 and sample i, and
 * carries that stretch's time, distance, flat-equivalent time, heart rate and climb.
 * Chunks are runs of whole intervals, so every sum over chunks equals the same sum over
 * intervals exactly (these are the invariants the tests check).
 *
 * The end of a segment rarely lands on a whole chunk. The short remainder is merged into
 * the previous chunk of the same segment when it is under half a chunk, and kept as its
 * own shorter chunk otherwise, so no chunk is ever shorter than half a chunk unless its
 * whole segment is.
 */

export interface ChunkOptions {
  chunkDistanceM: number;
  processingVersion: number;
}

/** Per-interval values (index 0 is the empty interval before the first sample). */
interface Intervals {
  dt: Float64Array;
  dd: Float64Array;
  flatDt: Float64Array;
  hr: Float64Array;
  dAlt: Float64Array;
  seg: Int32Array;
  gapMethod: GapMethod;
}

export function chunkRun(id: ActivityId, run: ParsedRun, opts: ChunkOptions): ChunkSet {
  const segmentation = detectSegments(run.laps);
  if (run.t.length < 2) return singleChunk(id, run, opts);
  const iv = buildIntervals(run, segmentation.segmentOfLap);
  const columns = cutChunks(iv, opts.chunkDistanceM);
  return {
    activityId: id,
    processingVersion: opts.processingVersion,
    chunkDistanceM: opts.chunkDistanceM,
    lapRule: segmentation.rule,
    gapMethod: iv.gapMethod,
    segmentCount: segmentation.count,
    ...columns,
  };
}

/** A run with no samples (a manual entry): one chunk from the session totals. */
function singleChunk(id: ActivityId, run: ParsedRun, opts: ChunkOptions): ChunkSet {
  const { distM, timerS } = run.totals;
  return {
    activityId: id,
    processingVersion: opts.processingVersion,
    chunkDistanceM: opts.chunkDistanceM,
    lapRule: 'none',
    gapMethod: 'none',
    segmentCount: 1,
    seg: Uint16Array.of(0),
    startM: Float32Array.of(0),
    distM: Float32Array.of(distM),
    durS: Float32Array.of(timerS),
    flatDurS: Float32Array.of(timerS),
    hr: Float32Array.of(NaN),
    gainM: Float32Array.of(0),
    lossM: Float32Array.of(0),
  };
}

function buildIntervals(run: ParsedRun, segmentOfLap: number[]): Intervals {
  const n = run.t.length;
  const iv: Intervals = {
    dt: new Float64Array(n),
    dd: new Float64Array(n),
    flatDt: new Float64Array(n),
    hr: new Float64Array(n),
    dAlt: new Float64Array(n),
    seg: new Int32Array(n),
    gapMethod: 'none',
  };
  const lapOf = lapOfIntervals(run.t, run.laps);
  const alt = fillAltitude(run.alt);
  const grades = alt ? sampleGrades(run.dist, alt) : null;
  for (let i = 1; i < n; i++) {
    iv.dt[i] = timerSeconds(run.t[i - 1]!, run.t[i]!, run.pauses);
    iv.dd[i] = Math.max(0, run.dist[i]! - run.dist[i - 1]!);
    iv.flatDt[i] = grades ? iv.dt[i]! * flatTimeFactor(grades[i]!) : iv.dt[i]!;
    iv.hr[i] = run.hr[i]!;
    iv.dAlt[i] = alt ? alt[i]! - alt[i - 1]! : 0;
    iv.seg[i] = lapOf[i]! >= 0 ? segmentOfLap[lapOf[i]!]! : 0;
  }
  if (grades)
    iv.gapMethod = scaleToWatchLaps(iv.dt, iv.flatDt, lapOf, run.laps) ? 'minetti-scaled' : 'minetti';
  return iv;
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

/** Interval i belongs to the last lap that started strictly before sample i (−1 if no laps). */
function lapOfIntervals(t: Float64Array, laps: readonly WatchLap[]): Int32Array {
  const out = new Int32Array(t.length).fill(laps.length ? 0 : -1);
  let k = 0;
  for (let i = 1; i < t.length; i++) {
    while (k + 1 < laps.length && laps[k + 1]!.startT < t[i]!) k++;
    if (laps.length) out[i] = k;
  }
  return out;
}

type Columns = Pick<ChunkSet, 'seg' | 'startM' | 'distM' | 'durS' | 'flatDurS' | 'hr' | 'gainM' | 'lossM'>;

/** A chunk while it is being filled. */
interface Acc {
  seg: number;
  startM: number;
  distM: number;
  durS: number;
  flatDurS: number;
  hrSum: number;
  hrTime: number;
  gainM: number;
  lossM: number;
}

/**
 * Cuts at every `chunkDistanceM` mark counted from the segment's start (100 m, 200 m, …),
 * at the first sample past each mark. Counting from the start rather than from the last
 * cut keeps the marks from drifting: with 3 m between samples every chunk would otherwise
 * come out at 102 m.
 */
function cutChunks(iv: Intervals, chunkDistanceM: number): Columns {
  const done: Acc[] = [];
  let acc: Acc | null = null;
  let travelled = 0;
  let segStart = 0;
  let nextMark = chunkDistanceM;
  for (let i = 1; i < iv.dt.length; i++) {
    if (acc && iv.seg[i] !== acc.seg) {
      closeSegment(done, acc, chunkDistanceM);
      acc = null;
      segStart = travelled;
      nextMark = chunkDistanceM;
    }
    acc ??= emptyAcc(iv.seg[i]!, travelled);
    addInterval(acc, iv, i);
    travelled += iv.dd[i]!;
    if (travelled - segStart >= nextMark - MARK_EPSILON_M) {
      done.push(acc);
      acc = null;
      while (travelled - segStart >= nextMark - MARK_EPSILON_M) nextMark += chunkDistanceM;
    }
  }
  if (acc) closeSegment(done, acc, chunkDistanceM);
  return toColumns(done);
}

/** Float dust in summed distances must not push a cut one sample later. */
const MARK_EPSILON_M = 1e-6;

function emptyAcc(seg: number, startM: number): Acc {
  return { seg, startM, distM: 0, durS: 0, flatDurS: 0, hrSum: 0, hrTime: 0, gainM: 0, lossM: 0 };
}

function addInterval(acc: Acc, iv: Intervals, i: number): void {
  acc.distM += iv.dd[i]!;
  acc.durS += iv.dt[i]!;
  acc.flatDurS += iv.flatDt[i]!;
  if (Number.isFinite(iv.hr[i]!)) {
    acc.hrSum += iv.hr[i]! * iv.dt[i]!;
    acc.hrTime += iv.dt[i]!;
  }
  if (iv.dAlt[i]! > 0) acc.gainM += iv.dAlt[i]!;
  else acc.lossM -= iv.dAlt[i]!;
}

/** The segment's last, short chunk: merged into the previous one (same segment) if under half a chunk. */
function closeSegment(done: Acc[], last: Acc, chunkDistanceM: number): void {
  const prev = done[done.length - 1];
  if (prev && prev.seg === last.seg && last.distM < chunkDistanceM / 2) {
    prev.distM += last.distM;
    prev.durS += last.durS;
    prev.flatDurS += last.flatDurS;
    prev.hrSum += last.hrSum;
    prev.hrTime += last.hrTime;
    prev.gainM += last.gainM;
    prev.lossM += last.lossM;
  } else {
    done.push(last);
  }
}

function toColumns(chunks: Acc[]): Columns {
  const pick = (f: (c: Acc) => number) => Float32Array.from(chunks, f);
  return {
    seg: Uint16Array.from(chunks, (c) => c.seg),
    startM: pick((c) => c.startM),
    distM: pick((c) => c.distM),
    durS: pick((c) => c.durS),
    flatDurS: pick((c) => c.flatDurS),
    hr: pick((c) => (c.hrTime > 0 ? c.hrSum / c.hrTime : NaN)),
    gainM: pick((c) => c.gainM),
    lossM: pick((c) => c.lossM),
  };
}
