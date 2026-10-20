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

/**
 * Runs whose samples need (re)building: built with another processing version, or missing
 * altogether while raw data exists.
 */
export async function staleSampleIds(db: RhDb, version: number): Promise<ActivityId[]> {
  const raw = (await db.raw.toCollection().primaryKeys()) as ActivityId[];
  const current = new Set(
    (await db.samples.where('processingVersion').equals(version).primaryKeys()) as ActivityId[],
  );
  return raw.filter((id) => !current.has(id));
}
