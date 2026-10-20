import Dexie, { type EntityTable } from 'dexie';
import type { SampleSet } from '../domain/sampleTypes';
import type { ActivitySummary, RawActivity } from '../domain/types';

/**
 * The local database. IndexedDB is the browser's built-in database: asynchronous, stores
 * structured objects (typed arrays and ArrayBuffers included) and survives reloads and
 * going offline. Dexie is a thin wrapper that gives it Promises and a schema.
 * https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
 * https://dexie.org/docs/Tutorial/Getting-started
 *
 * Two separate ideas are versioned (don't mix them up):
 * - the *schema version* below (`db.version(n)`): which tables and indexes exist;
 * - `PROCESSING_VERSION` (processingVersion.ts): what the numbers inside `samples` mean.
 */

export interface ActivityRow extends ActivitySummary {
  /** When this row was last written by a sync, ISO timestamp. */
  syncedAt: string;
}

export type SamplesRow = SampleSet;

export interface MetaRow {
  key: string;
  value: unknown;
}

/** One API request, for the rate-limit budget (see http.ts). */
export interface RequestRow {
  seq?: number;
  /** Epoch milliseconds. */
  at: number;
}

export type RhDb = Dexie & {
  activities: EntityTable<ActivityRow, 'id'>;
  raw: EntityTable<RawActivity, 'id'>;
  samples: EntityTable<SamplesRow, 'activityId'>;
  meta: EntityTable<MetaRow, 'key'>;
  requests: EntityTable<RequestRow, 'seq'>;
};

export const DB_NAME = 'running-history';

/**
 * Opens (creating or upgrading as needed) the database. `options` exists for the tests,
 * which pass fake-indexeddb's implementation instead of the browser's.
 */
export function openDb(name = DB_NAME, options?: ConstructorParameters<typeof Dexie>[1]): RhDb {
  const db = new Dexie(name, options) as RhDb;
  // Only indexed fields are listed: the first is the primary key, the rest are indexes.
  // https://dexie.org/docs/Version/Version.stores()
  db.version(1).stores({
    activities: 'id, localDate',
    raw: 'id',
    chunks: 'activityId, processingVersion',
    meta: 'key',
    requests: '++seq, at',
  });
  // v2: per-run cleaned samples replace the 100 m distance chunks (chunks are now built in
  // memory, by time). `null` deletes the old table; the samples are rebuilt from raw on the
  // next start by the automatic reprocessing. https://dexie.org/docs/Tutorial/Design#database-versioning
  db.version(2).stores({
    chunks: null,
    samples: 'activityId, processingVersion',
  });
  return db;
}
