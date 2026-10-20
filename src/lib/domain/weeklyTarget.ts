import { todo } from '../exercise';
import type { Daily } from './daily';

/**
 * The Weekly target tile: a what-if for splitting a week. Three inputs (km, whole run
 * days, whole runs per week), seeded from real history, and a Monday–Sunday template.
 * Every rule here is spelled out in legacy/CLAUDE.md, "The Weekly target".
 */

/** Below this many days there is no long run. */
export const LONG_MIN_DAYS = 3;
export const PLAN_MAX_DAYS = 7;
/** 7 days, no long run: 3 × 3 + 3 × 2 + Friday's one. */
export const PLAN_MAX_RUNS = 16;
export const PLAN_MAX_KM = 700;
export const MULTI2_MIN_DAYS = 4;
export const MULTI3_MIN_DAYS = 6;
/** Most three-run days in a week (L+1 counts as one). */
export const MAX_TRIPLE = 3;

/** Monday-first weekday indexes. */
const MON = 0;
const TUE = 1;
const WED = 2;
const THU = 3;
const FRI = 4;
const SAT = 5;
const SUN = 6;
export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
/** Run days are picked in this order, so fewer days drop Friday first, then Tue, Sun, Thu, Wed, Mon. */
export const DAY_ORDER = [SAT, MON, WED, THU, SUN, TUE, FRI] as const;

export interface Plan {
  km: number;
  days: number;
  runs: number;
}

export interface TargetSeed extends Plan {
  kmSum: number;
  runDays: number;
  nRuns: number;
  windowDays: number;
  /** Index of the last day counted (inclusive). */
  end: number;
  /** The data's last day is today, so the seed ends yesterday (today may not be complete). */
  lastIsToday: boolean;
}

/*
 * TODO(E14) · weekly target · difficulty ★☆☆ · phase 2
 *   targetSeed(daily, windowDays, lastIsToday)
 *     The plan the Weekly target box starts from: km, run days and runs over the windowDays
 *     days ending on the last day of the data, or the day before when lastIsToday (today may
 *     not be finished), each as a rate per week (× 7 ÷ windowDays). Also return the raw
 *     kmSum, runDays, nRuns, windowDays, end (the last index counted) and lastIsToday.
 *   targetFor(plan, o)
 *     How a week of plan.km splits into runs. With a long run (longActive: asked for, and at
 *     least LONG_MIN_DAYS days) the long run is alone on its day and worth o.weight days:
 *     longKm = weight × km ÷ (days − 1 + weight), and the other runs − 1 runs share the rest
 *     equally. Without, every run is km ÷ runs. perRun is 0 when there are no runs to share.
 * Edge cases that matter, and why:
 * - The window can reach before the first day: start counting at index 0.
 * - Below three days there is no long run, whatever the setting.
 * Background: legacy/CLAUDE.md, the paragraphs starting "The **Weekly target** tile is a
 * what-if calculator" (search for it), with the bullets "With a long run" and "Without".
 * Concepts:
 * - object spread / returning objects: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
 * Check: npm run exercise E14 (tests/domain/weeklyTarget.test.ts, "E14 weekly target"). With
 * E15, the Weekly target box appears in the app.
 * Spoiler: `computeTargets()` and `targetFor()` in legacy/running-history.html.
 */
/**
 * km, run days and runs per week over the `windowDays` days ending on the last day of the
 * data, or the day before when the last day is today.
 */
export function targetSeed(daily: Daily, windowDays: number, lastIsToday: boolean): TargetSeed {
  return todo('E14', daily, windowDays, lastIsToday);
}

export interface LongRunOptions {
  /** Count one run as the long run (only at ≥ LONG_MIN_DAYS days). */
  long: boolean;
  /** …worth this many one-run days. */
  weight: number;
}

/** Whether the week has a long run: asked for, and at least LONG_MIN_DAYS days. */
export const longActive = (days: number, o: LongRunOptions): boolean => o.long && days >= LONG_MIN_DAYS;

export interface TargetSplit {
  long: boolean;
  longKm: number;
  perRun: number;
  restRuns: number;
}

/**
 * With a long run it is alone on its day and worth `w` days, so it is w × km ÷ (days − 1 + w)
 * and the other runs − 1 runs share the rest equally. Without, every run is km ÷ runs.
 */
export function targetFor(plan: Plan, o: LongRunOptions): TargetSplit {
  return todo('E14', plan, o);
}

/*
 * TODO(E15) · template week · difficulty ★★★ · phase 2
 * Lay a plan out Monday to Sunday. The rules:
 *   weekSlots(days, o)   used = the first `days` of DAY_ORDER (Sat, Mon, Wed, Thu, Sun, Tue, Fri).
 *                        slots = where extra runs go, in the order handed out:
 *                        - from MULTI2_MIN_DAYS days: a second run on every used day except
 *                          Friday (never doubled) and, with a long run, Saturday (L is alone);
 *                        - from MULTI3_MIN_DAYS days: a third run on the first MAX_TRIPLE used
 *                          days that aren't Friday, Saturday first (L+1 counts as one).
 *   maxRunsFor(days, o)  days + the number of slots.
 *   fitPlan(p, which, o) keep an edited plan inside what a week can hold: days and runs whole,
 *                        within 0…PLAN_MAX_DAYS and 0…PLAN_MAX_RUNS; km within 0…PLAN_MAX_KM.
 *                        Editing runs moves days to fit (fewer runs than days lowers days; more
 *                        than maxRunsFor raises days to the fewest that can hold them); editing
 *                        anything else just clamps runs into days…maxRunsFor(days).
 *   weekPlan(plan, o)    seven PlanDays: one run on each used day, the first runs − days slots
 *                        add one each; km from targetFor (E14): the long run's day (Saturday,
 *                        when long) gets longKm plus perRun for each extra run, every other
 *                        day runs × perRun.
 * Edge cases that matter, and why:
 * - Every combination of days, runs, weight and long must add up to the week's km exactly;
 *   the test sweeps them all.
 * - maxRunsFor gives the legacy table: 1, 2, 3, 7, 9, 14, 15 with a long run, and
 *   1, 2, 3, 8, 10, 15, 16 without.
 * Background: legacy/CLAUDE.md, the paragraphs after "The **Weekly target** tile is a what-if
 * calculator" ("L is alone on its day", "Friday is never doubled", "At most 3 three-run days").
 * Concepts:
 * - Array.prototype.slice / filter: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice
 * Check: npm run exercise E15 (tests/domain/weeklyTarget.test.ts, "E15 template week"). In the
 * app the Weekly target box appears next to the tiles; edit its numbers and watch the week.
 * Spoiler: `weekSlots()`, `fitPlan()` and `weekPlan()` in legacy/running-history.html.
 */
/** The run days, and one entry per extra run in the order they are handed out. */
export function weekSlots(days: number, o: LongRunOptions): { used: number[]; slots: number[] } {
  return todo('E15', days, o);
}

/** The most runs a week of `days` days can hold. */
export const maxRunsFor = (days: number, o: LongRunOptions): number => todo('E15', days, o);

/**
 * Keeps an edited plan inside what a week can hold. Editing runs moves days to fit (fewer
 * runs than days lowers days; more than the cap raises days to the fewest that can hold
 * them); editing anything else just clamps runs.
 */
export function fitPlan(p: Plan, which: 'km' | 'days' | 'runs', o: LongRunOptions): Plan {
  return todo('E15', p, which, o);
}

export interface PlanDay {
  name: (typeof WEEKDAY_NAMES)[number];
  runs: number;
  long: boolean;
  km: number;
}

/** The template week, Monday first. */
export function weekPlan(plan: Plan, o: LongRunOptions): PlanDay[] {
  return todo('E15', plan, o);
}
