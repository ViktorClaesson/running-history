import { whenDone } from '../exercise';
import { fmtDate, todayLocal, type IsoDate } from '../domain/dates';
import type { LastSync } from '../data/repositories/meta';

/** fmtDate, or the plain ISO date until exercise E01 is done (the page header needs it from the start). */
export const dayText = (d: IsoDate): string =>
  whenDone(
    () => fmtDate(d),
    () => d,
  );

/** "last synced 14 Oct 2026 (Wed) 18:03", in local time. */
export function lastSyncedText(s: LastSync | null): string {
  if (!s) return 'never synced';
  const at = new Date(s.at);
  return `last synced ${dayText(todayLocal(at))} ${at.toTimeString().slice(0, 5)}`;
}
