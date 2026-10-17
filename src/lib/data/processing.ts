import type { ChunkSet } from '../domain/chunkTypes';
import { chunkRun } from '../domain/chunking';
import type { ActivitySummary, RawActivity } from '../domain/types';
import { decodeFit } from './fit';

/**
 * What "how chunks were made" means. Bump PROCESSING_VERSION whenever the numbers in
 * `chunks` would come out differently from the same raw data: a new chunk size, a GAP
 * change, a new column. On the next start every run built with an older version is
 * rebuilt from its raw data, with no network (see reprocess.ts). This is a different thing
 * from the Dexie schema version in db.ts, which is about table shapes.
 */
export const PROCESSING_VERSION = 1;

/**
 * Chunk length. 100 m is plenty for these charts (a 1 km rep is ten chunks) and keeps a
 * whole history to ~65,000 chunks. Changing it only needs a PROCESSING_VERSION bump.
 */
export const CHUNK_DISTANCE_M = 100;

/** Raw → chunks. Pure apart from decoding; runs inside the Web Worker. */
export function processRaw(raw: RawActivity, summary: Pick<ActivitySummary, 'fileSportIndex'>): ChunkSet {
  return chunkRun(raw.id, decodeFit(raw.bytes, summary.fileSportIndex), {
    chunkDistanceM: CHUNK_DISTANCE_M,
    processingVersion: PROCESSING_VERSION,
  });
}
