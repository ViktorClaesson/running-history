import { todo } from '../exercise';
import type { Chunks } from './chunks';
import { velocityFromVo2 } from './vdot';

/**
 * Pace zones, read against a VDOT. Five Daniels zones as %VDOT bands, plus three slow
 * buckets in front of them (Standing, Walking, Recovery), all tiling one speed axis.
 * The new app bins *chunks* (a few seconds of a run, never across a manual lap), not
 * whole laps. See legacy/CLAUDE.md, "VDOT and pace zones" for every number here.
 */

export type ZoneKey = 'endurance' | 'marathon' | 'threshold' | 'interval' | 'repetition';

export interface Zone {
  key: ZoneKey;
  label: string;
  /** CSS custom properties of the zone's colour ramp. */
  weak: string;
  strong: string;
}

// --z-easy is the Endurance colour: the zone was renamed, its colour identity deliberately wasn't.
export const ZONES: readonly Zone[] = [
  { key: 'endurance', label: 'Endurance', weak: '--z-easy-weak', strong: '--z-easy' },
  { key: 'marathon', label: 'Marathon', weak: '--z-marathon-weak', strong: '--z-marathon' },
  { key: 'threshold', label: 'Threshold', weak: '--z-threshold-weak', strong: '--z-threshold' },
  { key: 'interval', label: 'Interval', weak: '--z-interval-weak', strong: '--z-interval' },
  { key: 'repetition', label: 'Repetition', weak: '--z-repetition-weak', strong: '--z-repetition' },
];

/** %VDOT anchors, back-solved from vdoto2.com's VDOT 51.8 example (5:14/4:23/4:08/3:48/3:33 min/km). */
export const ZONE_ANCHOR_PCT = [0.657, 0.818, 0.88, 0.976, 1.062] as const;
/** The threshold anchor: stress scores read speed against it. */
export const THRESHOLD_PCT = ZONE_ANCHOR_PCT[2];

/**
 * Zone boundaries: each between two neighbours' anchors, so the zones tile with no gap.
 * [0] is per day (enduranceFloorPct); [5] is a practical 120% ceiling so repetition has
 * something finite to split into sub-bands, not a physiological limit.
 */
export const ZONE_BOUND_PCT = [
  NaN,
  (ZONE_ANCHOR_PCT[0] + ZONE_ANCHOR_PCT[1]) / 2,
  (ZONE_ANCHOR_PCT[1] + ZONE_ANCHOR_PCT[2]) / 2,
  (ZONE_ANCHOR_PCT[2] + ZONE_ANCHOR_PCT[3]) / 2,
  (ZONE_ANCHOR_PCT[3] + ZONE_ANCHOR_PCT[4]) / 2,
  1.2,
] as const;

/** Slower than 20:00/km is not moving: fixed pace, since "am I moving" doesn't scale with fitness. */
export const STANDING_MAX_VEL = 1000 / 20;
/** Slower than 10:00/km is walking, also fixed in absolute pace. */
export const WALKING_MAX_VEL = 1000 / 10;
/** Endurance starts at 59% VDOT, Daniels' own E-zone floor; below it (but above walking) is Recovery. */
export const ENDURANCE_FLOOR_PCT = 0.59;

/*
 * TODO(E09) · pace-zone edges · difficulty ★★★ · phase 2
 * Pace zones are %VDOT bands; this turns them into speed edges and bins speeds.
 *   enduranceFloorPct(vdot)  where Endurance starts: ENDURANCE_FLOOR_PCT (59%), but never below
 *                            walking pace expressed in %VDOT (vo2FromVelocity(WALKING_MAX_VEL) ÷
 *                            vdot), and never above ZONE_BOUND_PCT[1] − 0.05.
 *   zoneEdgeVel(vdot, zone, k, zoneBars)
 *                            the speed (m/min) at edge k of zoneBars + 1 across `zone`: the zone's
 *                            two %VDOT edges (zoneEdgesPct) → speeds with velocityFromVo2(vdot × pct)
 *                            → k/zoneBars of the way from the low speed to the high one.
 *   binEdges(vdot, zoneBars) the lower speed edge of every bin from bin 1 up (length binCount − 1):
 *                            [0] STANDING_MAX_VEL (where Walking starts), [1] WALKING_MAX_VEL
 *                            (Recovery), [2] Endurance's floor speed (at least WALKING_MAX_VEL),
 *                            then for each zone z and sub-band k the edge zoneEdgeVel(vdot, z, k, zoneBars)
 *                            at index (ZONE_BIN_OFFSET + z × zoneBars + k) − 1.
 *   binWithEdges(vel, edges) the bin a speed falls in: the number of edges it is ≥ to. Faster
 *                            than the top edge lands in the top bin.
 * Edge cases that matter, and why:
 * - Sub-bands are equal steps of *speed*, not of pace: seconds per km mean more at the slow end.
 * - One source of edges: the histogram's bars and their hover labels both read zoneEdgeVel,
 *   so a bar and its label can't disagree.
 * - Standing and Walking are fixed paces (20:00/km, 10:00/km): "am I moving" doesn't scale with
 *   fitness. The tests check the bins tile the speed axis with no gaps.
 * Background: legacy/CLAUDE.md, "VDOT and pace zones" (from "Pace zones" to the floor history).
 * Concepts:
 * - binary vs linear search (a linear scan is fine for ~20 edges): https://en.wikipedia.org/wiki/Binary_search_algorithm
 * - Math.min / Math.max as a clamp: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/max
 * Check: npm run exercise E09 (tests/domain/zones.test.ts "E09 pace-zone binning", and
 * tests/domain/vdot.test.ts "E09 endurance floor").
 * Spoiler: `enduranceFloorPct()`, `zoneEdgeVel()` and `zoneBandFor()` in legacy/running-history.html.
 */
/**
 * Endurance's floor for this VDOT: 59%, but never below what walking pace is in %VDOT
 * (Recovery can't cover paces faster than walking) nor near the marathon boundary.
 */
export function enduranceFloorPct(vdot: number): number {
  return todo('E09', vdot);
}

/** Histogram bins: three slow buckets, then zone × zoneBars sub-bands. */
export const STANDING_BIN = 0;
export const WALKING_BIN = 1;
export const RECOVERY_BIN = 2;
export const ZONE_BIN_OFFSET = 3;
/** Whole-zone buckets for the stacked area: the three slow ones plus five zones. */
export const N_BUCKETS = ZONE_BIN_OFFSET + ZONES.length;
export const BUCKET_LABELS = ['Standing', 'Walking', 'Recovery', ...ZONES.map((z) => z.label)] as const;

export const binCount = (zoneBars: number) => ZONE_BIN_OFFSET + ZONES.length * zoneBars;

/** A zone's two %VDOT edges at this VDOT. */
export function zoneEdgesPct(zone: number, vdot: number): [number, number] {
  return [zone === 0 ? enduranceFloorPct(vdot) : ZONE_BOUND_PCT[zone]!, ZONE_BOUND_PCT[zone + 1]!];
}

/**
 * The speed at the k-th of zoneBars + 1 edges across a zone. Sub-bands are **equal steps of
 * speed** (not of pace, whose seconds mean more at the slow end). The one source of these
 * edges: binning and the hover text both read them, so a bar and its label can't disagree.
 */
export function zoneEdgeVel(vdot: number, zone: number, k: number, zoneBars: number): number {
  return todo('E09', vdot, zone, k, zoneBars);
}

/**
 * The lower speed edge (m/min) of every histogram bin from bin 1 up, at this VDOT. Binning
 * millions of chunks reads these instead of solving the VDOT formula per chunk: compute
 * once per day, then `binWithEdges`.
 */
export function binEdges(vdot: number, zoneBars: number): Float64Array {
  return todo('E09', vdot, zoneBars);
}

/** The bin a speed (m/min) falls into, given that day's `binEdges`. Faster than the top edge clamps into the top bin. */
export function binWithEdges(vel: number, edges: Float64Array): number {
  return todo('E09', vel, edges);
}

/** Which histogram bin a speed (m/min) falls into at this VDOT. */
export function binForVelocity(vel: number, vdot: number, zoneBars: number): number {
  return binWithEdges(vel, binEdges(vdot, zoneBars));
}

/** A histogram bin down to its whole-zone bucket (sub-bands collapsed). */
export function bucketOfBin(bin: number, zoneBars: number): number {
  return bin < ZONE_BIN_OFFSET ? bin : ZONE_BIN_OFFSET + Math.floor((bin - ZONE_BIN_OFFSET) / zoneBars);
}

export interface Histogram {
  /** Minutes in each bin (real timer minutes). */
  mins: Float64Array;
  /** Kilometres in each bin, never grade-adjusted: kilometres run are kilometres run. */
  km: Float64Array;
}

/*
 * TODO(E10) · pace histogram (part 2 of 2) · difficulty ★☆☆ · phase 2
 * Part 1 is chunkVelocity in chunks.ts.
 *   paceHistogram(c, vdot, zoneBars, gapPace)
 *     One run's chunks binned by speed against that day's VDOT: for every chunk with a speed
 *     (chunkVelocity, grade-adjusted with gapPace), add its minutes (durS ÷ 60) and its km
 *     (distM ÷ 1000) to its bin. Arrays of length binCount(zoneBars).
 * Edge cases that matter, and why:
 * - Compute binEdges once per call, then binWithEdges per chunk: a long history has millions
 *   of chunks, solving the VDOT formula for each would be slow.
 * - The km are never grade-adjusted (kilometres run are kilometres run); only the binning
 *   speed is.
 * Background: legacy/CLAUDE.md, "VDOT and pace zones" ("The pace-zone histogram").
 * Concepts:
 * - Float64Array: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float64Array
 * Check: npm run exercise E10. In the app the pace-zone card shows its histograms (one chunk
 * per run until E19).
 * Spoiler: `paceHistogramFor()` and `binLap()` in legacy/running-history.html.
 */
/** One run's chunks binned against `vdot`, by grade-adjusted speed with `gapPace`. */
export function paceHistogram(c: Chunks, vdot: number, zoneBars: number, gapPace: boolean): Histogram {
  return todo('E10', c, vdot, zoneBars, gapPace);
}

/** Speeds bounding a histogram bin, m/min; `hi` is null for the open-ended top bin. */
export function binVelocityRange(
  bin: number,
  vdot: number,
  zoneBars: number,
): { lo: number; hi: number | null } {
  if (bin === STANDING_BIN) return { lo: 0, hi: STANDING_MAX_VEL };
  if (bin === WALKING_BIN) return { lo: STANDING_MAX_VEL, hi: WALKING_MAX_VEL };
  if (bin === RECOVERY_BIN)
    return { lo: WALKING_MAX_VEL, hi: velocityFromVo2(vdot * enduranceFloorPct(vdot)) };
  const zb = bin - ZONE_BIN_OFFSET;
  const zone = Math.floor(zb / zoneBars);
  const sub = zb % zoneBars;
  const top = zone === ZONES.length - 1 && sub === zoneBars - 1;
  return {
    lo: zoneEdgeVel(vdot, zone, sub, zoneBars),
    hi: top ? null : zoneEdgeVel(vdot, zone, sub + 1, zoneBars),
  };
}

/** Speeds bounding a whole-zone bucket, m/min; `hi` null for repetition (open-ended). */
export function bucketVelocityRange(bucket: number, vdot: number): { lo: number; hi: number | null } {
  if (bucket < ZONE_BIN_OFFSET) return binVelocityRange(bucket, vdot, 1);
  const zone = bucket - ZONE_BIN_OFFSET;
  const [lo, hi] = zoneEdgesPct(zone, vdot);
  return {
    lo: velocityFromVo2(vdot * lo),
    hi: zone === ZONES.length - 1 ? null : velocityFromVo2(vdot * hi),
  };
}
