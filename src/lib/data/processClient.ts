import { todo } from '../exercise';
import type { SampleSet } from '../domain/sampleTypes';
import type { ActivitySummary, RawActivity } from '../domain/types';
import type { ProcessResponse } from '../workers/protocol';

/** One run takes ~15 ms; anything near this means the worker is gone, not busy. */
export const REQUEST_TIMEOUT_MS = 30_000;

interface Waiting {
  resolve: (s: SampleSet) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * The page's side of the processing worker: `process()` returns a Promise that settles
 * when the worker answers. Vite bundles the worker from `new URL(..., import.meta.url)`.
 * https://vite.dev/guide/features#web-workers
 *
 * A worker that crashes (or never loaded, e.g. offline in dev) is replaced on the next
 * request, and every request has a timeout, so a caller can never wait forever.
 */
export class ProcessClient {
  private worker: Worker | null = null;
  /** The id for the next request; its answer carries it back. */
  protected nextId = 1;
  private readonly waiting = new Map<number, Waiting>();

  /** Starts the worker now rather than on first use, so its script loads while online. */
  warmUp(): void {
    this.ensureWorker();
  }

  /*
   * TODO(E27) · worker messages (part 2 of 2: the page's side) · difficulty ★★☆ · phase 4
   *   process(raw, summary)
   *     A Promise around postMessage: take the worker (ensureWorker), give the request the next
   *     id (this.nextId++), and return a new Promise whose resolve/reject are stored in
   *     this.waiting under that id, with a timer that calls this.crash(new Error('processing
   *     timed out')) after REQUEST_TIMEOUT_MS; then post { kind: 'process', requestId, raw,
   *     fileSportIndex: summary.fileSportIndex }. settle() (already written) resolves or rejects
   *     it when the answer with that id arrives.
   * Edge cases that matter, and why:
   * - Several requests can be in flight and answers can come back in any order: the id is what
   *   matches them up (the test answers out of order).
   * - The timeout means a worker that died never leaves a caller waiting forever.
   * Concepts:
   * - the Promise constructor: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise
   * - Worker.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage
   * Check: npm run exercise E27. In the app Sync and "Reprocess all" work end to end.
   */
  process(raw: RawActivity, summary: Pick<ActivitySummary, 'fileSportIndex'>): Promise<SampleSet> {
    return todo('E27', raw, summary);
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('../workers/process.worker.ts', import.meta.url), { type: 'module' });
    w.addEventListener('message', (e: MessageEvent<ProcessResponse>) => this.settle(e.data));
    w.addEventListener('error', (e) => this.crash(new Error(e.message || 'processing worker failed')));
    this.worker = w;
    return w;
  }

  private settle(res: ProcessResponse): void {
    const w = this.waiting.get(res.requestId);
    if (!w) return;
    clearTimeout(w.timer);
    this.waiting.delete(res.requestId);
    if (res.kind === 'processed') w.resolve(res.samples);
    else w.reject(new Error(res.message));
  }

  /** Fails everything in flight and drops the worker; the next request starts a fresh one. */
  private crash(e: Error): void {
    this.worker?.terminate();
    this.worker = null;
    for (const w of this.waiting.values()) {
      clearTimeout(w.timer);
      w.reject(e);
    }
    this.waiting.clear();
  }
}
