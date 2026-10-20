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

/**
 * km, run days and runs per week over the `windowDays` days ending on the last day of the
 * data, or the day before when the last day is today.
 */
export function targetSeed(daily: Daily, windowDays: number, lastIsToday: boolean): TargetSeed {
  const end = lastIsToday ? daily.n - 2 : daily.n - 1;
  let kmSum = 0;
  let runDays = 0;
  let nRuns = 0;
  for (let i = Math.max(0, end - windowDays + 1); i <= end; i++) {
    kmSum += daily.km[i]!;
    if (daily.km[i]! > 0) runDays++;
    nRuns += daily.nRuns[i]!;
  }
  const rate = (x: number) => (x * 7) / windowDays;
  return {
    km: rate(kmSum),
    days: rate(runDays),
    runs: rate(nRuns),
    kmSum,
    runDays,
    nRuns,
    windowDays,
    end,
    lastIsToday,
  };
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
  const long = longActive(plan.days, o);
  const restRuns = long ? plan.runs - 1 : plan.runs;
  const longKm = long ? (o.weight * plan.km) / (plan.days - 1 + o.weight) : 0;
  const perRun = restRuns > 0 ? (plan.km - longKm) / restRuns : 0;
  return { long, longKm, perRun, restRuns };
}

/** The run days, and one entry per extra run in the order they are handed out. */
export function weekSlots(days: number, o: LongRunOptions): { used: number[]; slots: number[] } {
  const used = DAY_ORDER.slice(0, days);
  const long = longActive(days, o);
  const multi = used.filter((d) => d !== FRI); // Friday is never doubled
  const slots: number[] = [];
  // Second runs, a round at a time; the long run is alone on its day.
  if (days >= MULTI2_MIN_DAYS) slots.push(...multi.filter((d) => !(long && d === SAT)));
  // Third runs: Saturday first (L+1), at most MAX_TRIPLE of them.
  if (days >= MULTI3_MIN_DAYS) slots.push(...multi.slice(0, MAX_TRIPLE));
  return { used, slots };
}

/** The most runs a week of `days` days can hold. */
export const maxRunsFor = (days: number, o: LongRunOptions): number => days + weekSlots(days, o).slots.length;

/**
 * Keeps an edited plan inside what a week can hold. Editing runs moves days to fit (fewer
 * runs than days lowers days; more than the cap raises days to the fewest that can hold
 * them); editing anything else just clamps runs.
 */
export function fitPlan(p: Plan, which: 'km' | 'days' | 'runs', o: LongRunOptions): Plan {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  let days = clamp(Math.round(p.days), 0, PLAN_MAX_DAYS);
  let runs = clamp(Math.round(p.runs), 0, PLAN_MAX_RUNS);
  if (which === 'runs') {
    if (runs < days) days = runs;
    while (days < PLAN_MAX_DAYS && runs > maxRunsFor(days, o)) days++;
  }
  runs = clamp(runs, days, maxRunsFor(days, o));
  return { km: clamp(p.km, 0, PLAN_MAX_KM), days, runs };
}

export interface PlanDay {
  name: (typeof WEEKDAY_NAMES)[number];
  runs: number;
  long: boolean;
  km: number;
}

/** The template week, Monday first. */
export function weekPlan(plan: Plan, o: LongRunOptions): PlanDay[] {
  const t = targetFor(plan, o);
  const { used, slots } = weekSlots(plan.days, o);
  const runs = new Array<number>(7).fill(0);
  for (const d of used) runs[d] = 1;
  for (const d of slots.slice(0, plan.runs - plan.days)) runs[d]!++;
  return WEEKDAY_NAMES.map((name, d) => {
    const long = t.long && d === SAT && runs[d]! > 0;
    const km = long ? t.longKm + (runs[d]! - 1) * t.perRun : runs[d]! * t.perRun;
    return { name, runs: runs[d]!, long, km };
  });
}
