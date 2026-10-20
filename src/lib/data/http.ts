/**
 * Polite HTTP: a request budget, pacing, and retry with backoff.
 *
 * Intervals.icu's API is free, so we stay well inside its limits rather than near them:
 * personal API keys get 5,000 requests per day and 2,500 per rolling 15 minutes. Every
 * request is recorded (in IndexedDB, so the count survives reloads), and once either
 * budget is used up the next request throws `RateLimitPause` with the time it frees up.
 * Sync shows that as a banner and carries on by itself afterwards.
 *
 * Everything here is written against `Promise`s and `async`/`await`:
 * https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Promises
 */

export const MINUTE_MS = 60_000;
export const WINDOW_MS = 15 * MINUTE_MS;
export const DAY_MS = 24 * 60 * MINUTE_MS;

export interface RateLimits {
  perWindow: number;
  perDay: number;
  /** Minimum gap between the *starts* of two requests. 250 ms = at most 4 per second. */
  minIntervalMs: number;
}

/** Intervals.icu's published limits for personal API keys. */
export const INTERVALS_LIMITS: RateLimits = { perWindow: 2500, perDay: 5000, minIntervalMs: 250 };

export type PauseReason = 'window' | 'day' | 'server';

/** Thrown when a request must wait: the budget is used up, or the server said 429 too often. */
export class RateLimitPause extends Error {
  constructor(
    readonly until: number,
    readonly reason: PauseReason,
  ) {
    super(`rate limit (${reason}) until ${new Date(until).toISOString()}`);
    this.name = 'RateLimitPause';
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** The browser reports no network, or the request never reached the server. */
export class OfflineError extends Error {
  constructor() {
    super('offline: no network connection');
    this.name = 'OfflineError';
  }
}

/** Where request timestamps are kept. Backed by the `requests` table in the app. */
export interface RequestLog {
  add(at: number): Promise<void>;
  /** All timestamps at or after `since`, oldest first. */
  since(since: number): Promise<number[]>;
  /** Forget everything older than `before`. */
  prune(before: number): Promise<void>;
}

export interface Clock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

/** Resolves after `ms`, or rejects straight away if `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export const realClock: Clock = { now: () => Date.now(), sleep };

export interface BudgetUsage {
  lastWindow: number;
  lastDay: number;
}

/** Counts requests against the limits and paces them. One per app. */
export class RequestBudget {
  /** When the last request started (clock ms), for the pacing. */
  protected lastStart = 0;

  constructor(
    private readonly log: RequestLog,
    protected readonly limits: RateLimits = INTERVALS_LIMITS,
    private readonly clock: Clock = realClock,
  ) {}

  async usage(): Promise<BudgetUsage> {
    const now = this.clock.now();
    const day = await this.log.since(now - DAY_MS);
    return { lastDay: day.length, lastWindow: day.filter((t) => t > now - WINDOW_MS).length };
  }

  /**
   * Waits for its turn, then records one request. Throws `RateLimitPause` instead when a
   * budget is used up; `until` is when the oldest request inside that window drops out.
   */
  async acquire(signal?: AbortSignal): Promise<void> {
    const wait = this.lastStart + this.limits.minIntervalMs - this.clock.now();
    if (wait > 0) await this.clock.sleep(wait, signal);
    const now = this.clock.now();
    await this.log.prune(now - DAY_MS);
    const day = await this.log.since(now - DAY_MS);
    const pause = pauseFor(day, now, this.limits);
    if (pause) throw pause;
    this.lastStart = now;
    await this.log.add(now);
  }
}

/** The pause owed for a sorted list of request times in the last day, or null. */
export function pauseFor(times: number[], now: number, limits: RateLimits): RateLimitPause | null {
  // Strictly inside the window: a request exactly 15 minutes old has dropped out.
  const dayTimes = times.filter((t) => t > now - DAY_MS);
  if (dayTimes.length >= limits.perDay) {
    const freesAt = dayTimes[dayTimes.length - limits.perDay]! + DAY_MS;
    return new RateLimitPause(freesAt, 'day');
  }
  const windowTimes = dayTimes.filter((t) => t > now - WINDOW_MS);
  if (windowTimes.length >= limits.perWindow) {
    const freesAt = windowTimes[windowTimes.length - limits.perWindow]! + WINDOW_MS;
    return new RateLimitPause(freesAt, 'window');
  }
  return null;
}

export interface RetryOptions {
  budget: RequestBudget;
  clock?: Clock;
  signal?: AbortSignal;
  /** Attempts per request before giving up. */
  maxAttempts?: number;
  /** Backoff base: the first retry waits this long, then 2×, 4×, … */
  baseDelayMs?: number;
  /** Whether the browser thinks it is online. Injected so tests can say "offline". */
  isOnline?: () => boolean;
}

/** When a request keeps getting 429 until its last attempt, sync pauses for this long. */
export const SERVER_429_PAUSE_MS = WINDOW_MS;

/**
 * Runs `request` under the budget, retrying with exponential backoff on 429 (honouring
 * `Retry-After`), on 5xx, and on network errors. 4xx other than 429 is not retried:
 * asking again won't change the answer.
 */
export async function fetchWithRetry(
  request: (signal?: AbortSignal) => Promise<Response>,
  opts: RetryOptions,
): Promise<Response> {
  const clock = opts.clock ?? realClock;
  const maxAttempts = opts.maxAttempts ?? 5;
  const base = opts.baseDelayMs ?? 1000;
  const isOnline = opts.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  for (let attempt = 1; ; attempt++) {
    if (!isOnline()) throw new OfflineError();
    await opts.budget.acquire(opts.signal);
    const res = await sendOnce(request, opts.signal, isOnline);
    const last = attempt >= maxAttempts;
    if (res === 'network') {
      if (last) throw new OfflineError();
      await clock.sleep(base * 2 ** (attempt - 1), opts.signal);
      continue;
    }
    if (res.status === 429) {
      if (last) throw new RateLimitPause(clock.now() + SERVER_429_PAUSE_MS, 'server');
      await clock.sleep(retryAfterMs(res) ?? base * 2 ** (attempt - 1), opts.signal);
      continue;
    }
    if (res.status >= 500) {
      if (last) throw new HttpError(res.status, `server error ${res.status}`);
      await clock.sleep(base * 2 ** (attempt - 1), opts.signal);
      continue;
    }
    return res;
  }
}

/** One attempt. A network failure (fetch rejecting) comes back as 'network', not a throw. */
async function sendOnce(
  request: (signal?: AbortSignal) => Promise<Response>,
  signal: AbortSignal | undefined,
  isOnline: () => boolean,
): Promise<Response | 'network'> {
  try {
    return await request(signal);
  } catch (e) {
    if (signal?.aborted) throw e;
    if (!isOnline()) throw new OfflineError();
    return 'network';
  }
}

/** `Retry-After` as milliseconds (seconds form only; Intervals.icu sends "1"). */
function retryAfterMs(res: Response): number | null {
  const s = Number(res.headers.get('retry-after'));
  return Number.isFinite(s) && s > 0 ? s * 1000 : null;
}
