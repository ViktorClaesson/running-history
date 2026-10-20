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

/** Validates "YYYY-MM-DD" (including that the day exists) and brands it, or returns null. */
export function parseIsoDate(text: string): IsoDate | null {
  const m = ISO_DATE_RE.exec(text);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const back = new Date(Date.UTC(y, mo - 1, d));
  const ok = back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d;
  return ok ? (text as IsoDate) : null;
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
  return isoDate(startLocal.slice(0, 10));
}

/** Whole days since 1970-01-01. */
export function dayNumber(date: IsoDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** The inverse of `dayNumber`. */
export function fromDayNumber(n: number): IsoDate {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10) as IsoDate;
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
  return `${fmtShort(date)} (${WEEKDAYS[weekdayMon0(date)]})`;
}
