import type { ChunkSet } from '../domain/chunkTypes';
import { chunkRun } from '../domain/chunking';
import type { ActivitySummary, RawActivity } from '../domain/types';
import { decodeFit } from './fit';
import { CHUNK_DISTANCE_M, PROCESSING_VERSION } from './processingVersion';

export { CHUNK_DISTANCE_M, PROCESSING_VERSION };

/** Raw → chunks. Pure apart from decoding; runs inside the Web Worker. */
export function processRaw(raw: RawActivity, summary: Pick<ActivitySummary, 'fileSportIndex'>): ChunkSet {
  return chunkRun(raw.id, decodeFit(raw.bytes, summary.fileSportIndex), {
    chunkDistanceM: CHUNK_DISTANCE_M,
    processingVersion: PROCESSING_VERSION,
  });
}
