import { localDateOf, type IsoDate } from '../../domain/dates';
import type { ActivityId, ActivitySummary, RawActivity } from '../../domain/types';
import { fetchWithRetry, HttpError, type RequestBudget } from '../http';
import type { ActivityList, ActivitySource } from './types';

/**
 * Intervals.icu, read with a personal API key. What the endpoints actually return is in
 * docs/intervals-api-findings.md. The key never leaves this file except in the
 * Authorization header of requests to intervals.icu.
 *
 * Calling another origin from a web page needs that server's permission (CORS);
 * Intervals.icu grants it, so the browser can talk to it directly with no proxy.
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
 */

export interface IntervalsCredentials {
  /** "i12345", or "0" for "whoever owns the key". */
  athleteId: string;
  apiKey: string;
}

export const INTERVALS_BASE = 'https://intervals.icu';

export class AuthError extends Error {
  constructor() {
    super('Intervals.icu rejected the API key or athlete id');
    this.name = 'AuthError';
  }
}

export function createIntervalsSource(
  creds: IntervalsCredentials,
  budget: RequestBudget,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): ActivitySource {
  // HTTP Basic auth: the username is literally "API_KEY", the password is the key.
  const auth = 'Basic ' + btoa(`API_KEY:${creds.apiKey}`);

  async function get(path: string, signal?: AbortSignal): Promise<Response> {
    const res = await fetchWithRetry(
      (s) => fetchImpl(INTERVALS_BASE + path, { headers: { Authorization: auth }, signal: s }),
      { budget, signal },
    );
    if (res.status === 401 || res.status === 403) throw new AuthError();
    if (!res.ok) throw new HttpError(res.status, `Intervals.icu answered ${res.status} for ${path}`);
    return res;
  }

  return {
    async listActivities(oldest, newest, signal) {
      const path = `/api/v1/athlete/${encodeURIComponent(creds.athleteId)}/activities?oldest=${oldest}&newest=${newest}`;
      const body: unknown = await (await get(path, signal)).json();
      return parseActivityList(body);
    },
    async fetchRaw(id, signal) {
      const res = await get(`/api/v1/activity/${encodeURIComponent(id)}/file`, signal);
      const bytes = await res.arrayBuffer();
      if (!looksLikeFit(bytes)) throw new Error(`activity ${id}: the original file is not a FIT file`);
      return { id, format: 'fit', bytes, fetchedAt: new Date().toISOString() } satisfies RawActivity;
    },
  };
}

/** A FIT file has ".FIT" at bytes 8–11 of its header. */
export function looksLikeFit(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 12) return false;
  const tag = new TextDecoder().decode(new Uint8Array(bytes, 8, 4));
  return tag === '.FIT';
}

// ---- validating the list response ------------------------------------------------------
// The response is `unknown` until checked: one entry at a time, field by field, so one odd
// entry is skipped rather than poisoning the whole list, and everything after this point
// can trust the types.

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (o: Json, k: string): string | null => (typeof o[k] === 'string' ? o[k] : null);
const num = (o: Json, k: string): number | null =>
  typeof o[k] === 'number' && Number.isFinite(o[k]) ? o[k] : null;

export function parseActivityList(body: unknown): ActivityList {
  if (!Array.isArray(body)) throw new Error('Intervals.icu: activity list is not an array');
  const activities: ActivitySummary[] = [];
  let skipped = 0;
  for (const entry of body) {
    const a = isObject(entry) ? parseActivity(entry) : null;
    if (a) activities.push(a);
    else skipped++;
  }
  return { activities, skipped };
}

/**
 * One list entry, or null when it can't be used. Strava-sourced entries are the common
 * case: Intervals.icu lists them but only as `{id, start_date_local, source, _note}`.
 */
export function parseActivity(o: Json): ActivitySummary | null {
  const id: ActivityId | null = str(o, 'id');
  const startLocal = str(o, 'start_date_local');
  const type = str(o, 'type');
  if (!id || !startLocal || !type || !/^\d{4}-\d{2}-\d{2}T/.test(startLocal)) return null;
  const localDate: IsoDate = localDateOf(startLocal);
  return {
    id,
    startLocal,
    localDate,
    name: str(o, 'name') ?? '',
    type,
    distanceM: num(o, 'distance') ?? 0,
    movingS: num(o, 'moving_time') ?? 0,
    elapsedS: num(o, 'elapsed_time') ?? num(o, 'moving_time') ?? 0,
    avgHr: num(o, 'average_heartrate'),
    elevGainM: num(o, 'total_elevation_gain'),
    // `analyzed` moves whenever Intervals.icu re-reads or edits the activity.
    changeMarker: str(o, 'analyzed') ?? str(o, 'icu_sync_date') ?? '',
  };
}
