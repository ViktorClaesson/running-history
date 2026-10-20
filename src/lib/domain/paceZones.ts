import { chunkVelocity, type Chunks } from './chunks';
import { velocityFromVo2, vo2FromVelocity } from './vdot';

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

/**
 * Endurance's floor for this VDOT: 59%, but never below what walking pace is in %VDOT
 * (Recovery can't cover paces faster than walking) nor near the marathon boundary.
 */
export function enduranceFloorPct(vdot: number): number {
  const walkingPct = vo2FromVelocity(WALKING_MAX_VEL) / vdot;
  return Math.min(ZONE_BOUND_PCT[1] - 0.05, Math.max(ENDURANCE_FLOOR_PCT, walkingPct));
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
  const [lo, hi] = zoneEdgesPct(zone, vdot);
  const vLo = velocityFromVo2(vdot * lo);
  const vHi = velocityFromVo2(vdot * hi);
  return vLo + (k / zoneBars) * (vHi - vLo);
}

/**
 * The lower speed edge (m/min) of every histogram bin from bin 1 up, at this VDOT. Binning
 * millions of chunks reads these instead of solving the VDOT formula per chunk: compute
 * once per day, then `binWithEdges`.
 */
export function binEdges(vdot: number, zoneBars: number): Float64Array {
  const edges = new Float64Array(binCount(zoneBars) - 1);
  edges[STANDING_BIN] = STANDING_MAX_VEL; // bin 1 (walking) starts here
  edges[WALKING_BIN] = WALKING_MAX_VEL; // bin 2 (recovery)
  edges[RECOVERY_BIN] = Math.max(WALKING_MAX_VEL, zoneEdgeVel(vdot, 0, 0, zoneBars)); // bin 3 (endurance 0)
  for (let z = 0; z < ZONES.length; z++) {
    for (let k = 0; k < zoneBars; k++) {
      const bin = ZONE_BIN_OFFSET + z * zoneBars + k;
      if (bin === ZONE_BIN_OFFSET) continue;
      edges[bin - 1] = zoneEdgeVel(vdot, z, k, zoneBars);
    }
  }
  return edges;
}

/** The bin a speed (m/min) falls into, given that day's `binEdges`. Faster than the top edge clamps into the top bin. */
export function binWithEdges(vel: number, edges: Float64Array): number {
  let bin = 0;
  while (bin < edges.length && vel >= edges[bin]!) bin++;
  return bin;
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

/** One run's chunks binned against `vdot`, by grade-adjusted speed with `gapPace`. */
export function paceHistogram(c: Chunks, vdot: number, zoneBars: number, gapPace: boolean): Histogram {
  const h: Histogram = {
    mins: new Float64Array(binCount(zoneBars)),
    km: new Float64Array(binCount(zoneBars)),
  };
  const edges = binEdges(vdot, zoneBars);
  for (let i = 0; i < c.durS.length; i++) {
    const vel = chunkVelocity(c, i, gapPace);
    if (vel === null) continue;
    const bin = binWithEdges(vel, edges);
    h.mins[bin] += c.durS[i]! / 60;
    h.km[bin] += c.distM[i]! / 1000;
  }
  return h;
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
