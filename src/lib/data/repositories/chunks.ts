import type { ChunkSet } from '../../domain/chunkTypes';
import type { ActivityId } from '../../domain/types';
import type { RhDb } from '../db';

/** Every run's chunks, by activity id. Columnar typed arrays, so cheap to load at startup. */
export async function allChunks(db: RhDb): Promise<Map<ActivityId, ChunkSet>> {
  const rows = await db.chunks.toArray();
  return new Map(rows.map((r) => [r.activityId, r]));
}

export async function putChunks(db: RhDb, set: ChunkSet): Promise<void> {
  await db.chunks.put(set);
}

/**
 * Runs whose chunks need (re)building: built with another processing version, or missing
 * altogether while raw data exists.
 */
export async function staleChunkIds(db: RhDb, version: number): Promise<ActivityId[]> {
  const raw = (await db.raw.toCollection().primaryKeys()) as ActivityId[];
  const current = new Set(
    (await db.chunks.where('processingVersion').equals(version).primaryKeys()) as ActivityId[],
  );
  return raw.filter((id) => !current.has(id));
}
