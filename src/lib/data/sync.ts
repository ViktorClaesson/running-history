import { isNotDone } from '../exercise';
import type { SampleSet } from '../domain/sampleTypes';
import { addDays, daysBetween, type IsoDate } from '../domain/dates';
import type { ActivityId, ActivitySummary, RawActivity } from '../domain/types';
import type { ActivityRow, RhDb } from './db';
import { OfflineError, RateLimitPause, sleep, type PauseReason } from './http';
import {
  activityIdsBetween,
  deleteRuns,
  getActivity,
  latestLocalDate,
  saveRun,
  saveSummary,
} from './repositories/activities';
import { getPending, setLastSync, setPending } from './repositories/meta';
import { AuthError } from './sources/intervalsIcu';
import type { ActivitySource } from './sources/types';

/**
 * Sync: bring the local database up to date with the source.
 *
 * - **Watermark** = the latest local date of any stored run. A re-sync lists from
 *   watermark − SYNC_OVERLAP_DAYS to today: an earlier sync may have run between two runs
 *   on the same day, or a recent run may have been edited since.
 * - **Backfill** (empty database) walks forward from `earliest` a year at a time. Runs are
 *   committed in date order, so even an interrupted backfill leaves a valid watermark:
 *   everything older than it is stored (or remembered as pending, see meta.ts). Resuming
 *   is just the next re-sync.
 * - **Idempotent**: rows are keyed by the source's id, so seeing a run twice overwrites
 *   rather than duplicates; and the heavy raw download is skipped when nothing changed.
 */

export const SYNC_OVERLAP_DAYS = 3;
/** Backfill lists one year at a time, so no single response grows without bound. */
export const LIST_STEP_DAYS = 365;
/** Parallel raw downloads. Low on purpose: the API is free, and this is plenty fast. */
export const SYNC_CONCURRENCY = 2;

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/**
 * The date ranges to list, oldest first, each at most `step` days long.
 * Empty database → from `earliest`; otherwise from the watermark minus the overlap (but
 * never before `earliest`). Always up to `today`.
 */
export function planRanges(
  watermark: IsoDate | null,
  earliest: IsoDate,
  today: IsoDate,
  step: number = LIST_STEP_DAYS,
): DateRange[] {
  let from = watermark === null ? earliest : addDays(watermark, -SYNC_OVERLAP_DAYS);
  if (daysBetween(earliest, from) < 0) from = earliest;
  const ranges: DateRange[] = [];
  while (daysBetween(from, today) >= 0) {
    const end = addDays(from, step - 1);
    const to = daysBetween(end, today) < 0 ? today : end;
    ranges.push({ from, to });
    from = addDays(to, 1);
  }
  return ranges;
}

export type SyncDecision = 'fetch' | 'summary' | 'skip';

/**
 * What to do with one listed run:
 * - `fetch` the raw data when it's new, when the source's change marker moved, or when
 *   our raw or samples are missing;
 * - only update the `summary` when just the small fields differ (a renamed run);
 * - otherwise `skip`: this is what keeps a routine re-sync to a handful of requests.
 */
export function decide(
  listed: ActivitySummary,
  stored: ActivityRow | undefined,
  hasRaw: boolean,
  hasSamples: boolean,
): SyncDecision {
  if (!stored || !hasRaw || !hasSamples) return 'fetch';
  if (stored.changeMarker !== listed.changeMarker) return 'fetch';
  return sameSummary(listed, stored) ? 'skip' : 'summary';
}

/** The fields a listed run is compared on, for `decide`'s summary-only update. */
export const SUMMARY_FIELDS = [
  'startLocal',
  'localDate',
  'name',
  'type',
  'distanceM',
  'movingS',
  'elapsedS',
  'avgHr',
  'elevGainM',
  'fileSportIndex',
] as const satisfies readonly (keyof ActivitySummary)[];

function sameSummary(a: ActivitySummary, b: ActivitySummary): boolean {
  return SUMMARY_FIELDS.every((k) => a[k] === b[k]);
}

export interface SyncProgress {
  phase: 'listing' | 'fetching' | 'paused' | 'done';
  /** Raw downloads finished (ok or failed) / to do. */
  done: number;
  total: number;
  failed: number;
  /** Requests made so far by this sync (list + raw), retries not counted. */
  requests: number;
  pausedUntil?: number;
  pauseReason?: PauseReason;
}

export interface SyncResult {
  requests: number;
  listed: number;
  fetched: number;
  updated: number;
  skipped: number;
  deleted: number;
  failed: { summary: ActivitySummary; error: string }[];
}

export interface SyncOptions {
  db: RhDb;
  source: ActivitySource;
  /** Raw → samples. The app runs this in a Web Worker; tests pass a plain function. */
  process: (raw: RawActivity, summary: ActivitySummary) => Promise<SampleSet>;
  includedTypes: ReadonlySet<string>;
  earliest: IsoDate;
  today: IsoDate;
  /** Full re-sync of a range: re-fetch everything in it, and delete stored runs it no longer lists. */
  full?: DateRange;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (p: SyncProgress) => void;
  /** How to wait out a rate-limit pause. Defaults to sleeping until it ends. */
  waitUntil?: (until: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * Errors that end the whole sync rather than just one run: nothing else would work either.
 * An unfinished exercise is one of them, so it shows as the sync's error, not as a failed run.
 */
const isFatal = (e: unknown): boolean =>
  isNotDone(e) ||
  e instanceof AuthError ||
  e instanceof OfflineError ||
  (e instanceof DOMException && e.name === 'AbortError');

export async function runSync(opts: SyncOptions): Promise<SyncResult> {
  const progress: SyncProgress = { phase: 'listing', done: 0, total: 0, failed: 0, requests: 0 };
  const report = () => opts.onProgress?.({ ...progress });
  const result: SyncResult = {
    requests: 0,
    listed: 0,
    fetched: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    failed: [],
  };
  const waitUntil = opts.waitUntil ?? ((until, signal) => sleep(Math.max(0, until - Date.now()), signal));

  // Waits out rate-limit pauses (showing them) and retries; anything else is thrown.
  async function politely<T>(call: () => Promise<T>): Promise<T> {
    for (;;) {
      opts.signal?.throwIfAborted();
      try {
        progress.requests++;
        result.requests = progress.requests;
        return await call();
      } catch (e) {
        if (!(e instanceof RateLimitPause)) throw e;
        const phase = progress.phase;
        Object.assign(progress, { phase: 'paused', pausedUntil: e.until, pauseReason: e.reason });
        report();
        await waitUntil(e.until, opts.signal);
        Object.assign(progress, { phase, pausedUntil: undefined, pauseReason: undefined });
        report();
      }
    }
  }

  report();
  const listed = await listEverything(opts, politely);
  result.listed = listed.length;
  if (opts.full) result.deleted = await deleteUnlisted(opts.db, opts.full, listed);

  const work = await planWork(opts.db, listed, await getPending(opts.db));
  result.skipped = work.skipped;
  for (const s of work.summaryOnly) await saveSummary(opts.db, s);
  result.updated = work.summaryOnly.length;

  Object.assign(progress, { phase: 'fetching', total: work.toFetch.length });
  report();
  await fetchInOrder(work.toFetch, opts.concurrency ?? SYNC_CONCURRENCY, {
    async fetch(summary) {
      const raw = await politely(() => opts.source.fetchRaw(summary.id, opts.signal));
      return { summary, raw, samples: await opts.process(raw, summary) };
    },
    // No abort check here: a run already downloaded is still worth keeping on cancel.
    async commit(run) {
      await saveRun(opts.db, run);
      result.fetched++;
    },
    fail(summary, error) {
      if (isFatal(error)) throw error;
      result.failed.push({ summary, error: error instanceof Error ? error.message : String(error) });
      progress.failed++;
    },
    step() {
      progress.done++;
      report();
    },
  });

  await setPending(
    opts.db,
    result.failed.map((f) => f.summary),
  );
  await setLastSync(opts.db, {
    at: new Date().toISOString(),
    requests: result.requests,
    fetched: result.fetched,
    failed: result.failed.length,
  });
  progress.phase = 'done';
  report();
  return result;
}

/** Lists every planned range, keeping only included types, oldest run first. */
async function listEverything(
  opts: SyncOptions,
  politely: <T>(call: () => Promise<T>) => Promise<T>,
): Promise<ActivitySummary[]> {
  const ranges = opts.full
    ? planRanges(null, opts.full.from, opts.full.to)
    : planRanges(await latestLocalDate(opts.db), opts.earliest, opts.today);
  const all: ActivitySummary[] = [];
  for (const r of ranges) {
    const page = await politely(() => opts.source.listActivities(r.from, r.to, opts.signal));
    all.push(...page.activities.filter((a) => opts.includedTypes.has(a.type)));
  }
  return sortByStart(dedupe(all));
}

/** Stored runs inside a fully re-synced range that the source no longer lists (deleted there). */
async function deleteUnlisted(db: RhDb, range: DateRange, listed: ActivitySummary[]): Promise<number> {
  const keep = new Set(listed.map((a) => a.id));
  const gone = (await activityIdsBetween(db, range.from, range.to)).filter((id) => !keep.has(id));
  await deleteRuns(db, gone);
  return gone.length;
}

interface Work {
  toFetch: ActivitySummary[];
  summaryOnly: ActivitySummary[];
  skipped: number;
}

/** Sorts listed runs (plus earlier failures) into fetch / summary-only / skip. */
async function planWork(db: RhDb, listed: ActivitySummary[], pending: ActivitySummary[]): Promise<Work> {
  const work: Work = { toFetch: [], summaryOnly: [], skipped: 0 };
  const listedIds = new Set(listed.map((a) => a.id));
  // An earlier failure the listing didn't cover again still gets its retry.
  const retry = pending.filter((p) => !listedIds.has(p.id));
  for (const a of listed) {
    const decision = decide(
      a,
      await getActivity(db, a.id),
      await hasRow(db.raw, a.id),
      await hasRow(db.samples, a.id),
    );
    if (decision === 'fetch') work.toFetch.push(a);
    else if (decision === 'summary') work.summaryOnly.push(a);
    else work.skipped++;
  }
  work.toFetch = sortByStart([...retry, ...work.toFetch]);
  return work;
}

async function hasRow(table: { get(id: ActivityId): Promise<unknown> }, id: ActivityId): Promise<boolean> {
  return (await table.get(id)) !== undefined;
}

const sortByStart = (xs: ActivitySummary[]): ActivitySummary[] =>
  [...xs].sort((a, b) => (a.startLocal < b.startLocal ? -1 : a.startLocal > b.startLocal ? 1 : 0));

const dedupe = (xs: ActivitySummary[]): ActivitySummary[] => [...new Map(xs.map((a) => [a.id, a])).values()];

interface InOrderHandlers<T, R> {
  fetch(item: T): Promise<R>;
  commit(result: R): Promise<void>;
  fail(item: T, error: unknown): void;
  step(): void;
}

/**
 * Fetches with up to `concurrency` downloads in flight, but commits strictly in input
 * order: item k is only written once items 0…k−1 are written (or have failed). That keeps
 * "everything older than the newest stored run is present" true at every moment.
 */
export async function fetchInOrder<T, R>(
  items: T[],
  concurrency: number,
  h: InOrderHandlers<T, R>,
): Promise<void> {
  type Outcome = { ok: true; value: R } | { ok: false; error: unknown };
  const outcomes: Promise<Outcome>[] = new Array(items.length);
  const resolvers: ((o: Outcome) => void)[] = new Array(items.length);
  items.forEach((_, k) => (outcomes[k] = new Promise<Outcome>((res) => (resolvers[k] = res))));

  let next = 0;
  let stop = false;
  const worker = async () => {
    while (!stop && next < items.length) {
      const k = next++;
      try {
        resolvers[k]!({ ok: true, value: await h.fetch(items[k]!) });
      } catch (error) {
        resolvers[k]!({ ok: false, error });
      }
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);

  try {
    for (let k = 0; k < items.length; k++) {
      const o = await outcomes[k]!;
      if (o.ok) await h.commit(o.value);
      else h.fail(items[k]!, o.error);
      h.step();
    }
  } finally {
    stop = true;
    // Unblock nothing-awaited promises so the workers can wind down.
    await Promise.allSettled(workers);
  }
}
