import { todo } from '../../exercise';
import type { IsoDate } from '../../domain/dates';
import type { ActivityId, ActivitySummary, RawActivity } from '../../domain/types';
import type { ActivityRow, RhDb, SamplesRow } from '../db';

/** Every stored run, oldest first. Small rows: this is what startup loads. */
export async function allActivities(db: RhDb): Promise<ActivityRow[]> {
  const rows = await db.activities.toArray();
  return rows.sort((a, b) => (a.startLocal < b.startLocal ? -1 : a.startLocal > b.startLocal ? 1 : 0));
}

export function getActivity(db: RhDb, id: ActivityId): Promise<ActivityRow | undefined> {
  return db.activities.get(id);
}

/*
 * TODO(E20) · repositories (part 1 of 2) · difficulty ★★☆ · phase 4
 *   latestLocalDate(db)  the latest localDate of any stored run: the sync watermark. null when
 *                        the table is empty. Use the localDate index: order by it, take the last.
 *   saveRun(db, run, now)
 *                        write the run's summary (as an ActivityRow: the summary plus syncedAt =
 *                        now.toISOString()), its raw file and its samples, in ONE read-write
 *                        transaction over the three tables.
 * Edge cases that matter, and why:
 * - One transaction: either all three rows land or none does, so a half-synced run can't exist
 *   even if the tab closes mid-write. The test makes the last write fail and checks the first
 *   two were rolled back.
 * - Inside a Dexie transaction, only await Dexie calls (no fetch, no setTimeout): the
 *   transaction commits as soon as it has nothing left to do.
 * Background: README "How the data flows"; the comment at the top of data/sync.ts (the watermark).
 * Concepts:
 * - Dexie transactions: https://dexie.org/docs/Dexie/Dexie.transaction()
 * - Table.orderBy and Collection.last: https://dexie.org/docs/Table/Table.orderBy()
 * - IndexedDB transactions: https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction
 * - async / await: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
 * Check: npm run exercise E20 (tests/data/repositories.test.ts and tests/data/reprocess.test.ts).
 * Part 2 is staleSampleIds in repositories/samples.ts.
 * Spoiler: none, the legacy app had no database.
 */
/** The latest local date of any stored run: the sync watermark. null when empty. */
export async function latestLocalDate(db: RhDb): Promise<IsoDate | null> {
  return todo('E20', db);
}

/** Ids of the stored runs that started on a local date in [from, to]. */
export async function activityIdsBetween(db: RhDb, from: IsoDate, to: IsoDate): Promise<ActivityId[]> {
  return (await db.activities.where('localDate').between(from, to, true, true).primaryKeys()) as ActivityId[];
}

export interface RunToSave {
  summary: ActivitySummary;
  raw: RawActivity;
  samples: SamplesRow;
}

/**
 * Writes a run's summary, raw data and samples in ONE transaction: either all three land
 * or none does, so a half-synced run can't exist, even if the tab closes mid-write.
 * https://dexie.org/docs/Dexie/Dexie.transaction()
 */
export async function saveRun(db: RhDb, run: RunToSave, now: Date = new Date()): Promise<void> {
  todo('E20', db, run, now);
}

/** Updates only the summary (name, distance…) when the raw data didn't need re-fetching. */
export async function saveSummary(db: RhDb, summary: ActivitySummary, now: Date = new Date()): Promise<void> {
  await db.activities.put({ ...summary, syncedAt: now.toISOString() });
}

/** Removes runs entirely (all three tables), in one transaction. */
export async function deleteRuns(db: RhDb, ids: ActivityId[]): Promise<void> {
  if (!ids.length) return;
  await db.transaction('rw', db.activities, db.raw, db.samples, async () => {
    await db.activities.bulkDelete(ids);
    await db.raw.bulkDelete(ids);
    await db.samples.bulkDelete(ids);
  });
}
