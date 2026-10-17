import { parseIsoDate } from '../../domain/dates';
import type { ActivitySummary } from '../../domain/types';
import type { RhDb } from '../db';

/**
 * Small key/value facts that must survive reloads. Values come back as `unknown` from
 * IndexedDB, so each getter checks the shape before trusting it.
 */

export interface LastSync {
  /** ISO timestamp the sync finished. */
  at: string;
  /** Requests it made, so "a re-sync only fetches what's new" can be seen. */
  requests: number;
  fetched: number;
  failed: number;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export async function getLastSync(db: RhDb): Promise<LastSync | null> {
  const v = (await db.meta.get('lastSync'))?.value;
  if (!isObject(v) || typeof v.at !== 'string') return null;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  return { at: v.at, requests: n(v.requests), fetched: n(v.fetched), failed: n(v.failed) };
}

export async function setLastSync(db: RhDb, s: LastSync): Promise<void> {
  await db.meta.put({ key: 'lastSync', value: s });
}

/**
 * Runs that failed in an earlier sync, kept so the next sync retries them first. This is
 * what lets one failure not hold the watermark back: the watermark may move past a failed
 * run, but the run itself is remembered here until it succeeds.
 */
export async function getPending(db: RhDb): Promise<ActivitySummary[]> {
  const v = (await db.meta.get('pending'))?.value;
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is ActivitySummary =>
      isObject(x) &&
      typeof x.id === 'string' &&
      typeof x.startLocal === 'string' &&
      typeof x.localDate === 'string' &&
      parseIsoDate(x.localDate) !== null,
  );
}

export async function setPending(db: RhDb, pending: ActivitySummary[]): Promise<void> {
  await db.meta.put({ key: 'pending', value: pending });
}
