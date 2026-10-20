import type { SampleSet } from '../domain/sampleTypes';
import { todayLocal } from '../domain/dates';
import type { ActivityId } from '../domain/types';
import { openDb, type ActivityRow, type RhDb } from '../data/db';
import { RequestBudget, type PauseReason } from '../data/http';
import { PROCESSING_VERSION } from '../data/processingVersion';
import { ProcessClient } from '../data/processClient';
import { reprocess } from '../data/reprocess';
import { allActivities } from '../data/repositories/activities';
import { allSamples, staleSampleIds } from '../data/repositories/samples';
import { getLastSync, type LastSync } from '../data/repositories/meta';
import { dbRequestLog } from '../data/repositories/requests';
import { createIntervalsSource } from '../data/sources/intervalsIcu';
import { runSync, type DateRange, type SyncProgress, type SyncResult } from '../data/sync';
import { isCredentialComplete, loadSyncConfig, saveSyncConfig, type SyncConfig } from './syncConfig';

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'running'; progress: SyncProgress }
  | { kind: 'done'; result: SyncResult }
  | { kind: 'error'; message: string };

export interface PauseBanner {
  until: number;
  reason: PauseReason;
}

/**
 * Everything the app knows that isn't a display setting: the synced data, and the state
 * of sync and reprocessing. One instance, created on startup.
 */
export class AppStore {
  readonly db: RhDb = openDb();
  private readonly budget = new RequestBudget(dbRequestLog(this.db));
  private processor: ProcessClient | null = null;
  private syncAbort: AbortController | null = null;

  config = $state<SyncConfig>(loadSyncConfig());
  /** Stored runs, oldest first. `$state.raw`: replaced as a whole, never deep-proxied. */
  runs = $state.raw<ActivityRow[]>([]);
  // Replaced as a whole on reload, never mutated in place, so no reactive SvelteMap needed.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  samples = $state.raw<Map<ActivityId, SampleSet>>(new Map());
  loaded = $state(false);
  sync = $state<SyncStatus>({ kind: 'idle' });
  pause = $state<PauseBanner | null>(null);
  reprocessing = $state<{ done: number; total: number } | null>(null);
  lastSync = $state<LastSync | null>(null);
  online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);

  /** Processing runs in a worker, created on first use. */
  private get worker(): ProcessClient {
    this.processor ??= new ProcessClient();
    return this.processor;
  }

  async start(): Promise<void> {
    addEventListener('online', () => (this.online = true));
    addEventListener('offline', () => (this.online = false));
    // Ask the browser not to evict our data under storage pressure.
    // https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
    void navigator.storage?.persist?.();
    this.worker.warmUp();
    await this.reload();
    this.loaded = true;
    await this.reprocessStale();
  }

  /** Reads summaries and samples (never raw) back from IndexedDB. */
  async reload(): Promise<void> {
    const [runs, samples, lastSync] = await Promise.all([
      allActivities(this.db),
      allSamples(this.db),
      getLastSync(this.db),
    ]);
    this.runs = runs;
    this.samples = samples;
    this.lastSync = lastSync;
  }

  saveConfig(c: SyncConfig): void {
    this.config = c;
    saveSyncConfig(c);
  }

  get canSync(): boolean {
    return isCredentialComplete(this.config) && this.sync.kind !== 'running';
  }

  async startSync(full?: DateRange): Promise<void> {
    if (!this.canSync) return;
    if (!this.online) {
      this.sync = {
        kind: 'error',
        message: 'You are offline. Sync needs a connection; everything else works.',
      };
      return;
    }
    this.syncAbort = new AbortController();
    this.sync = {
      kind: 'running',
      progress: { phase: 'listing', done: 0, total: 0, failed: 0, requests: 0 },
    };
    try {
      const result = await runSync({
        db: this.db,
        source: createIntervalsSource(this.config, this.budget),
        process: (raw, summary) => this.worker.process(raw, summary),
        // A plain argument to sync, not state anything renders from.
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        includedTypes: new Set(this.config.types),
        earliest: this.config.earliest,
        today: todayLocal(),
        full,
        signal: this.syncAbort.signal,
        onProgress: (p) => this.onSyncProgress(p),
      });
      this.sync = { kind: 'done', result };
    } catch (e) {
      this.sync = { kind: 'error', message: syncErrorMessage(e) };
    } finally {
      this.pause = null;
      this.syncAbort = null;
      await this.reload();
    }
  }

  cancelSync(): void {
    this.syncAbort?.abort(new DOMException('cancelled', 'AbortError'));
  }

  private onSyncProgress(p: SyncProgress): void {
    this.sync = { kind: 'running', progress: p };
    this.pause =
      p.phase === 'paused' && p.pausedUntil
        ? { until: p.pausedUntil, reason: p.pauseReason ?? 'server' }
        : null;
  }

  /** Rebuilds stale samples automatically on startup (and after a version bump). */
  async reprocessStale(all = false): Promise<void> {
    if (this.reprocessing) return;
    const stale = all ? this.runs.length : (await staleSampleIds(this.db, PROCESSING_VERSION)).length;
    if (!stale) return;
    this.reprocessing = { done: 0, total: stale };
    try {
      await reprocess({
        db: this.db,
        version: PROCESSING_VERSION,
        all,
        process: (raw, summary) => this.worker.process(raw, summary),
        onProgress: (done, total) => (this.reprocessing = { done, total }),
      });
    } finally {
      this.reprocessing = null;
      await this.reload();
    }
  }
}

function syncErrorMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === 'AbortError')
    return 'Sync cancelled. What was already fetched is kept.';
  if (e instanceof Error && e.name === 'OfflineError') return 'Sync stopped: no network connection.';
  if (e instanceof Error && e.name === 'AuthError')
    return 'Intervals.icu rejected the athlete id or API key.';
  return `Sync failed: ${e instanceof Error ? e.message : String(e)}`;
}

export const app = new AppStore();
