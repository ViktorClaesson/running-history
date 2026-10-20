import type { SampleSet } from '../domain/sampleTypes';
import type { ActivitySummary, RawActivity } from '../domain/types';
import type { ProcessRequest, ProcessResponse } from '../workers/protocol';

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

  process(raw: RawActivity, summary: Pick<ActivitySummary, 'fileSportIndex'>): Promise<SampleSet> {
    const worker = this.ensureWorker();
    const requestId = this.nextId++;
    const req: ProcessRequest = { kind: 'process', requestId, raw, fileSportIndex: summary.fileSportIndex };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.crash(new Error('processing timed out')), REQUEST_TIMEOUT_MS);
      this.waiting.set(requestId, { resolve, reject, timer });
      worker.postMessage(req);
    });
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
