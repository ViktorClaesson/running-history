import { todo } from '../exercise';
import { DEFAULT_GAP_EXP } from './gap';
import type { SampleSet } from './sampleTypes';

/**
 * Chunks: a run's samples grouped into pieces of at least `minSec` timer seconds, never
 * across a segment (manual lap / workout step) boundary. Built in memory from the stored
 * samples, so the length is a setting (0 = every sample is its own chunk).
 *
 * Time-based rather than distance-based, so every chunk is the same amount of *effort*
 * whatever the pace, and GPS noise in the distance averages out evenly. A segment's last,
 * short chunk merges into the previous chunk of the same segment when it is under half the
 * length, and otherwise stays as its own shorter chunk.
 */
export interface Chunks {
  seg: Uint16Array;
  /** Timer seconds. */
  durS: Float32Array;
  /** Metres from the distance record: kilometre totals add these up, and raw speed is distM ÷ durS. */
  distM: Float32Array;
  /** Flat-equivalent metres (Σ metres × GAP factor): grade-adjusted speed is flatM ÷ durS. */
  flatM: Float32Array;
  /** Time-weighted mean heart rate, or NaN. */
  hr: Float32Array;
}

export const MIN_CHUNK_SEC_LIMITS = [0, 60] as const;

/*
 * TODO(E19) · chunks · difficulty ★★★ · phase 3
 *   buildChunks(s, minSec, gapExp)
 *     Group a run's samples into chunks of at least minSec timer seconds, in order, never across
 *     a segment. Each chunk sums its samples' durS (dt), distM (dist) and flatM
 *     (dist × flatMetresFactor(grade, gapExp)), and has a time-weighted mean heart rate
 *     (Σ hr × dt ÷ Σ dt over samples whose hr is finite; NaN if none). Return them as columns.
 * Rules:
 * - Close a chunk as soon as it has ≥ minSec seconds and more than 0 (so minSec = 0 makes
 *   every sample with time its own chunk).
 * - A sample with no time (the instant after a pause) joins the chunk being built.
 * - At the end of each segment, the leftover chunk merges into the previous chunk *of the same
 *   segment* when it is under half of minSec (or has no time at all); otherwise it stays as a
 *   shorter chunk of its own. A whole segment shorter than minSec is one chunk.
 * Edge cases that matter, and why:
 * - Never cross a segment: a lap boundary is something you did on purpose (a rep starting).
 * - Time-based, not distance-based: every chunk is the same amount of effort whatever the pace.
 * - Everything sums: total distance and time over the chunks equal those over the samples.
 * Background: the comment above (Chunks); CLAUDE.md in the repo root ("time-based chunks").
 * Concepts:
 * - Float32Array.from(iterable, mapFn): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/from
 * - Number.isFinite: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite
 * Check: npm run exercise E19 (tests/domain/chunks.test.ts). In the app the pace zones,
 * workout types, stress and zone volume switch from one chunk per run to real chunks: interval
 * sessions now show their fast parts. The "Min chunk length" setting takes effect.
 * Spoiler: none, the legacy app binned whole laps.
 */
/** `gapExp` is the GAP strength (see gap.ts): it decides each chunk's flat-equivalent metres. */
export function buildChunks(s: SampleSet, minSec: number, gapExp = DEFAULT_GAP_EXP): Chunks {
  return todo('E19', s, minSec, gapExp);
}

/*
 * TODO(E10) · pace histogram (part 1 of 2: chunk speed) · difficulty ★☆☆ · phase 2
 *   chunkVelocity(c, i, gap)  chunk i's speed in m/min: metres ÷ seconds × 60, from flatM
 *                             (flat-equivalent metres) when `gap`, from distM otherwise.
 *                             null when the chunk has no time (durS not > 0).
 * Why metres ÷ time: the watch's own smoothed speed lags behind every acceleration and
 * under-reads short reps (docs/intervals-api-findings.md).
 * Part 2 is paceHistogram in paceZones.ts. Check: npm run exercise E10
 * (tests/domain/zones.test.ts, "E10 pace histogram").
 * Spoiler: none, the legacy app had laps rather than chunks.
 */
/** A chunk's speed in m/min: grade-adjusted with `gap`, raw (metres ÷ time) otherwise; null with no time. */
export function chunkVelocity(c: Chunks, i: number, gap: boolean): number | null {
  return todo('E10', c, i, gap);
}
