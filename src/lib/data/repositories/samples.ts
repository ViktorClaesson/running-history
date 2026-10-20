import { todo } from '../../exercise';
import type { SampleSet } from '../../domain/sampleTypes';
import type { ActivityId } from '../../domain/types';
import type { RhDb } from '../db';

/** Every run's samples, by activity id. Columnar typed arrays: this is what startup loads. */
export async function allSamples(db: RhDb): Promise<Map<ActivityId, SampleSet>> {
  const rows = await db.samples.toArray();
  return new Map(rows.map((r) => [r.activityId, r]));
}

export async function putSamples(db: RhDb, set: SampleSet): Promise<void> {
  await db.samples.put(set);
}

/*
 * TODO(E20) · repositories (part 2 of 2) · difficulty ★★☆ · phase 4
 *   staleSampleIds(db, version)
 *     The ids of runs that have raw data but whose samples are missing or were built with
 *     another processing version: every primary key of `raw`, minus the ids whose samples have
 *     processingVersion === version (use the processingVersion index and primaryKeys(), so no
 *     sample data is loaded).
 * Why: bumping PROCESSING_VERSION makes every run stale, and startup rebuilds them from raw with
 * no network (data/reprocess.ts).
 * Concepts:
 * - WhereClause.equals: https://dexie.org/docs/WhereClause/WhereClause.equals()
 * - Collection.primaryKeys: https://dexie.org/docs/Collection/Collection.primaryKeys()
 * - Set: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
 * Check: npm run exercise E20. In the app startup reprocessing works again (after a version bump).
 */
/**
 * Runs whose samples need (re)building: built with another processing version, or missing
 * altogether while raw data exists.
 */
export async function staleSampleIds(db: RhDb, version: number): Promise<ActivityId[]> {
  return todo('E20', db, version);
}
