import { flatMetresFactor } from './gap';
import type { SampleSet } from './sampleTypes';

/**
 * Chunks: a run's samples grouped into pieces of at least `minSec` timer seconds, never
 * across a segment (manual lap / workout step) boundary. Built in memory from the stored
 * samples, so the length is a setting (0 = every sample is its own chunk).
 *
 * Time-based rather than distance-based, so every chunk is the same amount of *effort*
 * whatever the pace, and the watch's speed noise averages out evenly. A segment's last,
 * short chunk merges into the previous chunk of the same segment when it is under half the
 * length, and otherwise stays as its own shorter chunk.
 */
export interface Chunks {
  seg: Uint16Array;
  /** Timer seconds. */
  durS: Float32Array;
  /** Metres from the distance record: what kilometre totals add up. */
  distM: Float32Array;
  /** Metres at the watch's speed (Σ speed × dt): what raw speed is read from. */
  moveM: Float32Array;
  /** Flat-equivalent metres (Σ speed × dt × Minetti factor): what grade-adjusted speed is read from. */
  flatM: Float32Array;
  /** Time-weighted mean heart rate, or NaN. */
  hr: Float32Array;
}

export const MIN_CHUNK_SEC_LIMITS = [0, 60] as const;

interface Acc {
  seg: number;
  durS: number;
  distM: number;
  moveM: number;
  flatM: number;
  hrSum: number;
  hrTime: number;
}

export function buildChunks(s: SampleSet, minSec: number): Chunks {
  const done: Acc[] = [];
  let acc: Acc | null = null;
  for (let i = 0; i < s.dt.length; i++) {
    if (acc && s.seg[i] !== acc.seg) {
      closeSegment(done, acc, minSec);
      acc = null;
    }
    acc ??= { seg: s.seg[i]!, durS: 0, distM: 0, moveM: 0, flatM: 0, hrSum: 0, hrTime: 0 };
    addSample(acc, s, i);
    // A chunk needs some time in it: an instant (the sample right after a pause) joins the next.
    if (acc.durS > 0 && acc.durS >= minSec) {
      done.push(acc);
      acc = null;
    }
  }
  if (acc) closeSegment(done, acc, minSec);
  return toColumns(done);
}

function addSample(acc: Acc, s: SampleSet, i: number): void {
  const dt = s.dt[i]!;
  const move = s.speed[i]! * dt;
  acc.durS += dt;
  acc.distM += s.dist[i]!;
  acc.moveM += move;
  acc.flatM += move * flatMetresFactor(s.grade[i]!);
  if (Number.isFinite(s.hr[i]!)) {
    acc.hrSum += s.hr[i]! * dt;
    acc.hrTime += dt;
  }
}

function closeSegment(done: Acc[], last: Acc, minSec: number): void {
  const prev = done[done.length - 1];
  if (prev && prev.seg === last.seg && (last.durS < minSec / 2 || last.durS === 0)) {
    prev.durS += last.durS;
    prev.distM += last.distM;
    prev.moveM += last.moveM;
    prev.flatM += last.flatM;
    prev.hrSum += last.hrSum;
    prev.hrTime += last.hrTime;
  } else {
    done.push(last);
  }
}

function toColumns(chunks: Acc[]): Chunks {
  const pick = (f: (c: Acc) => number) => Float32Array.from(chunks, f);
  return {
    seg: Uint16Array.from(chunks, (c) => c.seg),
    durS: pick((c) => c.durS),
    distM: pick((c) => c.distM),
    moveM: pick((c) => c.moveM),
    flatM: pick((c) => c.flatM),
    hr: pick((c) => (c.hrTime > 0 ? c.hrSum / c.hrTime : NaN)),
  };
}

/** A chunk's speed in m/min: grade-adjusted with `gap`, the watch's raw speed otherwise; null with no time. */
export function chunkVelocity(c: Chunks, i: number, gap: boolean): number | null {
  const dur = c.durS[i]!;
  return dur > 0 ? ((gap ? c.flatM[i]! : c.moveM[i]!) / dur) * 60 : null;
}
