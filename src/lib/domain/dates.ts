import { todo } from '../exercise';
/**
 * Calendar dates, without time zones.
 *
 * Everything in this app is grouped by the *local calendar day* a run started on. The
 * source already gives us that as text (`start_date_local`, e.g. "2023-07-20T23:36:46"),
 * so we never go through `Date` + a UTC offset to find the day: that is exactly the bug
 * that put every run after 22:00 on the next day in the legacy app (legacy/CLAUDE.md,
 * "Data pipeline").
 *
 * Internally a day is either an `IsoDate` string ("2026-10-14") or a *day number*: whole
 * days since 1970-01-01. Day numbers make "how many days between" plain subtraction.
 * Both conversions use `Date.UTC`, which is pure calendar arithmetic (no DST, no zone).
 */

/** A calendar date as "YYYY-MM-DD". Branded so a random string can't be passed by mistake. */
export type IsoDate = string & { readonly __brand: 'IsoDate' };

export const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MS_PER_DAY = 86_400_000;

/*
 * TODO(E01) · dates · difficulty ★☆☆ · phase 1
 * Every run is filed under the local calendar day it started on, and the whole app counts
 * days as integers. Write the five functions of this exercise:
 *   parseIsoDate(text)  "2026-10-14" → that string branded as IsoDate, or null if it isn't
 *                       exactly YYYY-MM-DD or names a day that doesn't exist (2026-02-29,
 *                       2026-13-01). Use ISO_DATE_RE, then check the day survives Date.UTC.
 *   localDateOf(start)  "2023-07-20T23:36:46" → "2023-07-20". The text already IS local time.
 *   dayNumber(date)     whole days since 1970-01-01 (1970-01-01 → 0). Use Date.UTC and MS_PER_DAY.
 *   fromDayNumber(n)    the inverse of dayNumber.
 *   fmtDate(date)       "14 Oct 2026 (Wed)": fmtShort plus the weekday (weekdayMon0, WEEKDAYS).
 * Edge cases that matter, and why:
 * - Never go through `new Date(text)` and a UTC offset to find the day: that is exactly the
 *   bug that put every run after 22:00 on the next day in the legacy app.
 * - Date.UTC is pure calendar arithmetic: no time zone, no DST, so a DST weekend can't gain or
 *   lose a day. Local-time Date methods (getDate, setDate) can.
 * - Round the day number: a millisecond count divided by 86 400 000 should be whole, but be safe.
 * Background: legacy/CLAUDE.md, "Data pipeline" (the first bullet) and "What the chart shows"
 * (dates read "14 Oct 2026 (Wed)" everywhere).
 * Concepts:
 * - Date.UTC: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC
 * - RegExp.prototype.exec: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
 * - toISOString: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
 * - branded types in TypeScript: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions
 * Check: npm run exercise E01 (tests/domain/dates.test.ts). In the app the header shows dates
 * again, and with E02–E03 the bars appear.
 * Spoiler: the legacy app kept dates as Date objects (`dayKey`, `fmtDate` in
 * legacy/running-history.html); this version deliberately doesn't.
 */
/** Validates "YYYY-MM-DD" (including that the day exists) and brands it, or returns null. */
export function parseIsoDate(text: string): IsoDate | null {
  return todo('E01', text);
}

/** Like `parseIsoDate`, but throws: for values that are ours and must already be valid. */
export function isoDate(text: string): IsoDate {
  const d = parseIsoDate(text);
  if (d === null) throw new Error(`not a calendar date: "${text}"`);
  return d;
}

/**
 * The local calendar day of a local wall-clock timestamp ("2023-07-20T23:36:46" → "2023-07-20").
 * Just the first ten characters: the text already *is* local time, so there is nothing to convert.
 */
export function localDateOf(startLocal: string): IsoDate {
  return todo('E01', startLocal);
}

/** Whole days since 1970-01-01. */
export function dayNumber(date: IsoDate): number {
  return todo('E01', date);
}

/** The inverse of `dayNumber`. */
export function fromDayNumber(n: number): IsoDate {
  return todo('E01', n);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(dayNumber(date) + days);
}

/** Days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return dayNumber(b) - dayNumber(a);
}

/** Today in the browser's local time zone, as a calendar date. */
export function todayLocal(now: Date = new Date()): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}` as IsoDate;
}

/** 0 = Monday … 6 = Sunday (ISO order, the order the weekly template uses). */
export function weekdayMon0(date: IsoDate): number {
  // 1970-01-01 was a Thursday, i.e. 3 in Monday-first numbering.
  return (((dayNumber(date) + 3) % 7) + 7) % 7;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function monthName(date: IsoDate): string {
  return MONTHS[Number(date.slice(5, 7)) - 1]!;
}

/** "14 Oct 2026". Built by hand: no locale gives this order with the weekday in brackets. */
export function fmtShort(date: IsoDate): string {
  return `${Number(date.slice(8, 10))} ${monthName(date)} ${date.slice(0, 4)}`;
}

/** "14 Oct 2026 (Wed)", the format used everywhere a day is named (legacy `fmtDate`). */
export function fmtDate(date: IsoDate): string {
  return todo('E01', date);
}
