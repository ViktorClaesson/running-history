import type { ActivityId, RawActivity } from '../../domain/types';
import type { RhDb } from '../db';

/**
 * Raw rows are large (a FIT file each, ~240 KB), so nothing here loads them in bulk:
 * startup never touches this table, and reprocessing reads them one at a time.
 */
export function getRaw(db: RhDb, id: ActivityId): Promise<RawActivity | undefined> {
  return db.raw.get(id);
}

/** Ids of every run that has raw data, without loading the data itself. */
export async function rawIds(db: RhDb): Promise<Set<ActivityId>> {
  return new Set((await db.raw.toCollection().primaryKeys()) as ActivityId[]);
}
