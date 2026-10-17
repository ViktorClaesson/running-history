import { fmtDate, todayLocal } from '../domain/dates';
import type { LastSync } from '../data/repositories/meta';

/** "last synced 14 Oct 2026 (Wed) 18:03", in local time. */
export function lastSyncedText(s: LastSync | null): string {
  if (!s) return 'never synced';
  const at = new Date(s.at);
  return `last synced ${fmtDate(todayLocal(at))} ${at.toTimeString().slice(0, 5)}`;
}
