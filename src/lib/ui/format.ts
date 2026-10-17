/** Number and time formatting shared by the readout, the table and the hover texts. */

export const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const km2 = (v: number): string => v.toFixed(2);

/** min/km → "m:ss" */
export function paceStr(minPerKm: number): string {
  if (!(minPerKm > 0) || !Number.isFinite(minPerKm)) return '—';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

/** m/min → "m:ss" per km */
export const paceOfVel = (velMpm: number): string => paceStr(1000 / velMpm);

/** seconds → "m:ss" or "h:mm:ss" */
export function durStr(sec: number): string {
  if (!(sec > 0) || !Number.isFinite(sec)) return '—';
  const s = Math.round(sec) % 60;
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** A km/week figure restated per month and per year (a month is 365/12 days). */
export const perMonthKm = (perWeek: number): number => (perWeek / 7) * (365 / 12);
export const perYearKm = (perWeek: number): number => (perWeek / 7) * 365;

export const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
