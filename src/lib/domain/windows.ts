import { todo } from '../exercise';
import type { Daily } from './daily';

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

/*
 * TODO(E04) · window series · difficulty ★★☆ · phase 1
 *   buildWindows(base, mult)
 *     Exactly four windows, one per slot: slot k is base × mult^k weeks (base 1, mult 4 →
 *     1 / 4 / 16 / 64 weeks). Each has key SLOT_KEYS[k], slot k, weeks, days (= weeks × 7) and
 *     label "4w".
 *   windowSeries(daily, windows)
 *     For every window, one value per day, all as rates per week so they share an axis:
 *       vol       km per week                    (perWeek of daily.km)
 *       freq      run days per week              (perWeek of "did I run that day", 1 or 0)
 *       runs      runs per week                  (perWeek of daily.nRuns)
 *       runDaysIn, runsIn   the raw counts behind the two rates (rollingSum, not per week)
 * Edge cases that matter, and why:
 * - A two-run day counts once for run days and twice for runs.
 * - A slot keeps its key whatever its length, so its colour doesn't change when you change the
 *   windows in the settings.
 * Background: legacy/CLAUDE.md, "The model" (the bullet "The four windows").
 * Concepts:
 * - Array.prototype.map: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
 * - exponentiation (**): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Exponentiation
 * Check: npm run exercise E04 (tests/domain/windows.test.ts, "E04 windows"). In the app the
 * distance, run-days and runs per week panels draw their lines, and the readout fills in.
 * Spoiler: `rebuildWindows()` and `recompute()` in legacy/running-history.html.
 */
export function buildWindows(base: number, mult: number): Window[] {
  return todo('E04', base, mult);
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
  return todo('E04', daily, windows);
}
