import type { SampleSet } from '../domain/sampleTypes';
import type { ActivitySummary, RawActivity } from '../domain/types';
import type { RhDb } from './db';
import { getActivity } from './repositories/activities';
import { putSamples, staleSampleIds } from './repositories/samples';
import { getRaw } from './repositories/rawActivities';

/**
 * Rebuilds samples from raw data for every run whose samples are missing or were built with
 * another PROCESSING_VERSION. Never touches the network.
 *
 * Resumable and idempotent by construction: each run is rebuilt and saved on its own, and
 * the work list is "rows not on the current version", so an interrupted run simply
 * continues with whatever is still left next time.
 */
export interface ReprocessOptions {
  db: RhDb;
  version: number;
  process: (raw: RawActivity, summary: ActivitySummary) => Promise<SampleSet>;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
  /** Rebuild every run, not just the stale ones (the "Reprocess all" button). */
  all?: boolean;
}

export interface ReprocessResult {
  rebuilt: number;
  failed: { id: string; error: string }[];
}

export async function reprocess(opts: ReprocessOptions): Promise<ReprocessResult> {
  const ids = opts.all
    ? ((await opts.db.raw.toCollection().primaryKeys()) as string[])
    : await staleSampleIds(opts.db, opts.version);
  const result: ReprocessResult = { rebuilt: 0, failed: [] };
  opts.onProgress?.(0, ids.length);
  for (const [k, id] of ids.entries()) {
    opts.signal?.throwIfAborted();
    try {
      await rebuildOne(opts, id);
      result.rebuilt++;
    } catch (e) {
      result.failed.push({ id, error: e instanceof Error ? e.message : String(e) });
    }
    opts.onProgress?.(k + 1, ids.length);
  }
  return result;
}

async function rebuildOne(opts: ReprocessOptions, id: string): Promise<void> {
  const [raw, summary] = await Promise.all([getRaw(opts.db, id), getActivity(opts.db, id)]);
  if (!raw || !summary) throw new Error(`run ${id}: raw data or summary missing`);
  await putSamples(opts.db, await opts.process(raw, summary));
}
