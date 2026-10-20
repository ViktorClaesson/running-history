import { whenDone } from '../../exercise';

/** Axis ticks. */

/** About four even steps from 0 to at least `max`, on 1/2/2.5/5 × 10ⁿ. */
export function niceTicks(max: number): { ticks: number[]; step: number } {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const n = Math.ceil(max / step - 1e-9);
  return { ticks: Array.from({ length: n + 1 }, (_, k) => k * step), step };
}

/**
 * The ticks the linear panels use: niceTicks, or until exercise E29 is done four plain
 * equal steps, so every panel can draw from the start.
 */
export function axisTicks(max: number): { ticks: number[]; step: number } {
  return whenDone(
    () => niceTicks(max),
    () => ({ ticks: [0, 1, 2, 3, 4].map((k) => (k * max) / 4), step: max / 4 }),
  );
}

/**
 * A log axis wants gridlines on numbers you'd say out loud, so both ends round out to
 * 1/2/5 × 10ⁿ and every such value between becomes a tick (uneven spacing is the point).
 */
const LOG_MANT = [1, 2, 5];
const logDec = (v: number) => 10 ** Math.floor(Math.log10(v) + 1e-12);

export function logUp(v: number): number {
  const d = logDec(v);
  return (LOG_MANT.find((x) => x >= v / d - 1e-9) ?? 10) * d;
}

export function logDown(v: number): number {
  const d = logDec(v);
  return ([...LOG_MANT].reverse().find((x) => x <= v / d + 1e-9) ?? 1) * d;
}

export function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let d = logDec(lo); d <= hi * 1.0001; d *= 10) {
    for (const m of LOG_MANT) {
      const v = m * d;
      if (v >= lo * 0.9999 && v <= hi * 1.0001) out.push(v);
    }
  }
  return out;
}

/** Enough decimals to tell ticks apart below 1. */
export const logTickText = (v: number): string =>
  v >= 1 ? String(+v.toFixed(2)) : v.toFixed(Math.max(0, -Math.floor(Math.log10(v) + 1e-12)));
