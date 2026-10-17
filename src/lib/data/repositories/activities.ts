import type { IsoDate } from '../../domain/dates';
import type { ActivityId, ActivitySummary, RawActivity } from '../../domain/types';
import type { ActivityRow, ChunksRow, RhDb } from '../db';

/** Every stored run, oldest first. Small rows: this is what startup loads. */
export async function allActivities(db: RhDb): Promise<ActivityRow[]> {
  const rows = await db.activities.toArray();
  return rows.sort((a, b) => (a.startLocal < b.startLocal ? -1 : a.startLocal > b.startLocal ? 1 : 0));
}

export function getActivity(db: RhDb, id: ActivityId): Promise<ActivityRow | undefined> {
  return db.activities.get(id);
}

/** The latest local date of any stored run: the sync watermark. null when empty. */
export async function latestLocalDate(db: RhDb): Promise<IsoDate | null> {
  const last = await db.activities.orderBy('localDate').last();
  return last ? last.localDate : null;
}

/** Ids of the stored runs that started on a local date in [from, to]. */
export async function activityIdsBetween(db: RhDb, from: IsoDate, to: IsoDate): Promise<ActivityId[]> {
  return (await db.activities.where('localDate').between(from, to, true, true).primaryKeys()) as ActivityId[];
}

export interface RunToSave {
  summary: ActivitySummary;
  raw: RawActivity;
  chunks: ChunksRow;
}

/**
 * Writes a run's summary, raw data and chunks in ONE transaction: either all three land
 * or none does, so a half-synced run can't exist, even if the tab closes mid-write.
 * https://dexie.org/docs/Dexie/Dexie.transaction()
 */
export async function saveRun(db: RhDb, run: RunToSave, now: Date = new Date()): Promise<void> {
  const row: ActivityRow = { ...run.summary, syncedAt: now.toISOString() };
  await db.transaction('rw', db.activities, db.raw, db.chunks, async () => {
    await db.activities.put(row);
    await db.raw.put(run.raw);
    await db.chunks.put(run.chunks);
  });
}

/** Updates only the summary (name, distance…) when the raw data didn't need re-fetching. */
export async function saveSummary(db: RhDb, summary: ActivitySummary, now: Date = new Date()): Promise<void> {
  await db.activities.put({ ...summary, syncedAt: now.toISOString() });
}

/** Removes runs entirely (all three tables), in one transaction. */
export async function deleteRuns(db: RhDb, ids: ActivityId[]): Promise<void> {
  if (!ids.length) return;
  await db.transaction('rw', db.activities, db.raw, db.chunks, async () => {
    await db.activities.bulkDelete(ids);
    await db.raw.bulkDelete(ids);
    await db.chunks.bulkDelete(ids);
  });
}
