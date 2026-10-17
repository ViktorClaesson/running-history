import type { Daily } from './daily';
import { perWeek, rollingSum } from './rolling';

/**
 * The four rolling windows. Always exactly four (the colour scheme and the readout tables
 * are built for four), but *which* four is set by two numbers: the shortest window in weeks
 * (`windowBase`) and the multiple from one to the next (`windowMult`). The defaults 1 and
 * 4 give 1 / 4 / 16 / 64 weeks. See legacy/CLAUDE.md, "The four windows".
 */
export const N_WINDOWS = 4;

/** A slot's key is its index, not its length, so it keeps its colour when the lengths change. */
export type SlotKey = 's0' | 's1' | 's2' | 's3';
export const SLOT_KEYS: readonly SlotKey[] = ['s0', 's1', 's2', 's3'];

export interface Window {
  key: SlotKey;
  slot: number;
  weeks: number;
  days: number;
  /** "4w" */
  label: string;
}

export function buildWindows(base: number, mult: number): Window[] {
  return SLOT_KEYS.map((key, slot) => {
    const weeks = base * mult ** slot;
    return { key, slot, weeks, days: weeks * 7, label: `${weeks}w` };
  });
}

/** One value per window per day, all rates per week so different windows share an axis. */
export interface WindowSeries {
  /** km per week */
  vol: Float64Array[];
  /** run days per week (a two-run day counts once) */
  freq: Float64Array[];
  /** runs per week (a two-run day counts twice) */
  runs: Float64Array[];
  /** raw counts behind the two rates, for the readout ("26 runs in 20 days") */
  runDaysIn: Float64Array[];
  runsIn: Float64Array[];
}

export function windowSeries(daily: Daily, windows: readonly Window[]): WindowSeries {
  const ranOn = daily.km.map((km) => (km > 0 ? 1 : 0));
  return {
    vol: windows.map((w) => perWeek(daily.km, w.days)),
    freq: windows.map((w) => perWeek(ranOn, w.days)),
    runs: windows.map((w) => perWeek(daily.nRuns, w.days)),
    runDaysIn: windows.map((w) => rollingSum(ranOn, w.days)),
    runsIn: windows.map((w) => rollingSum(daily.nRuns, w.days)),
  };
}
