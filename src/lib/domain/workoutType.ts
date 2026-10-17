import type { ChunkSet } from './chunkTypes';
import {
  binForVelocity,
  chunkVelocity,
  RECOVERY_BIN,
  STANDING_BIN,
  WALKING_BIN,
  ZONE_BIN_OFFSET,
  ZONES,
} from './paceZones';

/**
 * What kind of session a run was. Every chunk scores speed (km/h)^exp × distance (km)
 * towards its zone; then, from the hardest zone down, each zone is pooled with every faster
 * one, and the first pool to reach `share`% of the total names the run. Pooling is what
 * stops a hard session split across two zones losing to the easy running around it.
 * Standing and Walking score nothing; Recovery is what's left when no pool reaches the
 * share. See legacy/CLAUDE.md, "Workout type".
 */
export const WORKOUT_TYPES = [
  { key: 'recovery', label: 'Recovery' },
  ...ZONES.map((z) => ({ key: z.key, label: z.label })),
] as const;
/** Index into WORKOUT_TYPES: 0 = recovery, 1–5 = the zones endurance … repetition. */
export type WorkoutTypeIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface WorkoutType {
  type: WorkoutTypeIndex;
  /** The winning pool's share of the score, percent. */
  pct: number;
  /** The pool included faster zones too ("threshold+"). */
  plus: boolean;
  /** The run had no running chunks at all (only standing/walking). */
  noRunning: boolean;
}

/** Score per type [recovery, endurance … repetition] for one run, at that day's VDOT. */
export function zoneScores(set: ChunkSet, vdot: number, exp: number, gapPace: boolean): number[] {
  const sc = new Array<number>(WORKOUT_TYPES.length).fill(0);
  for (let i = 0; i < set.distM.length; i++) {
    const vel = chunkVelocity(set, i, gapPace);
    if (vel === null) continue;
    const bin = binForVelocity(vel, vdot, 1);
    if (bin === STANDING_BIN || bin === WALKING_BIN) continue;
    const t = bin === RECOVERY_BIN ? 0 : 1 + (bin - ZONE_BIN_OFFSET);
    const km = set.distM[i]! / 1000;
    sc[t]! += (vel * 0.06) ** exp * km; // m/min × 0.06 = km/h
  }
  return sc;
}

export function workoutFromScores(sc: readonly number[], share: number): WorkoutType {
  const total = sc.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return { type: 0, pct: 0, plus: false, noRunning: true };
  let pool = 0;
  for (let t = sc.length - 1; t >= 1; t--) {
    pool += sc[t]!;
    const pct = (pool / total) * 100;
    if (pct >= share) return { type: t as WorkoutTypeIndex, pct, plus: t < sc.length - 1, noRunning: false };
  }
  return { type: 0, pct: (sc[0]! / total) * 100, plus: false, noRunning: false };
}
