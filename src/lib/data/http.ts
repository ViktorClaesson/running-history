import { todo } from '../exercise';
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

  /*
   * TODO(E21) · request budget · difficulty ★★☆ · phase 4
   *   pauseFor(times, now, limits)
   *     The pause owed, given the sorted times of requests made in the last day, or null.
   *     - Day: if the requests within the last DAY_MS (strictly newer than now − DAY_MS) number
   *       limits.perDay or more, pause until the oldest one that must drop out has: the
   *       (count − perDay)-th of them + DAY_MS. Reason 'day'.
   *     - Otherwise the same for the last WINDOW_MS (15 minutes) and limits.perWindow, reason
   *       'window'.
   *   RequestBudget.acquire(signal)
   *     Wait for this request's turn, then record it:
   *     - pacing: if the last request started less than limits.minIntervalMs ago, sleep the rest
   *       (this.clock.sleep, with the signal);
   *     - prune log entries older than a day, read the last day's times, and throw pauseFor's
   *       pause if there is one (without recording anything);
   *     - otherwise remember now as lastStart and add it to the log.
   * Edge cases that matter, and why:
   * - "Strictly newer": a request exactly 15 minutes old has dropped out of the window.
   * - All time comes from the injected Clock, never Date.now(): that's what lets the tests run a
   *   fake clock with no real waiting.
   * - The log lives in IndexedDB, so the budget survives a reload.
   * Background: the comment at the top of this file; docs/intervals-api-findings.md (the limits).
   * Concepts:
   * - Promises: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Promises
   * - async / await: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function
   * - dependency injection, for testable time: https://en.wikipedia.org/wiki/Dependency_injection
   * Check: npm run exercise E21 (tests/data/http.test.ts, "E21 RequestBudget").
   * Spoiler: none, the legacy app made no requests.
   */
  /**
   * Waits for its turn, then records one request. Throws `RateLimitPause` instead when a
   * budget is used up; `until` is when the oldest request inside that window drops out.
   */
  async acquire(signal?: AbortSignal): Promise<void> {
    todo('E21', signal);
  }
}

/** The pause owed for a sorted list of request times in the last day, or null. */
export function pauseFor(times: number[], now: number, limits: RateLimits): RateLimitPause | null {
  return todo('E21', times, now, limits);
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

/*
 * TODO(E22) · retry with backoff · difficulty ★★★ · phase 4
 *   fetchWithRetry(request, opts)
 *     Run `request` under the budget, up to maxAttempts (default 5) times:
 *     - before each attempt: if !isOnline() throw OfflineError; await budget.acquire(signal);
 *     - a request that rejects (a network failure): if the signal aborted, rethrow; if now
 *       offline, throw OfflineError; otherwise retry after base × 2^(attempt − 1) ms
 *       (base = baseDelayMs, default 1000), or on the last attempt throw OfflineError;
 *     - 429 Too Many Requests: wait the Retry-After header's seconds if it has a positive number,
 *       else the backoff; on the last attempt throw RateLimitPause(now + SERVER_429_PAUSE_MS, 'server');
 *     - 5xx: backoff and retry; on the last attempt throw HttpError(status, …);
 *     - anything else (2xx, and 4xx other than 429): return the response. Asking again
 *       won't change a 404.
 *     Defaults: clock = realClock, isOnline = navigator.onLine (true where there's no navigator).
 * Edge cases that matter, and why:
 * - Sleep with the clock (clock.sleep(ms, signal)), so a cancelled sync stops waiting at once
 *   and the tests run instantly.
 * - Every attempt goes through budget.acquire: retries count against the limits too.
 * Background: the comment at the top of this file; docs/intervals-api-findings.md (Intervals.icu
 * sends "Retry-After: 1").
 * Concepts:
 * - exponential backoff: https://en.wikipedia.org/wiki/Exponential_backoff
 * - 429 and Retry-After: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429
 * - Headers.get: https://developer.mozilla.org/en-US/docs/Web/API/Headers/get
 * - AbortSignal: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 * - try/catch with await: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch
 * Check: npm run exercise E22 (tests/data/http.test.ts, "E22 fetchWithRetry").
 * Spoiler: none, the legacy app made no requests.
 */
/**
 * Runs `request` under the budget, retrying with exponential backoff on 429 (honouring
 * `Retry-After`), on 5xx, and on network errors. 4xx other than 429 is not retried:
 * asking again won't change the answer.
 */
export async function fetchWithRetry(
  request: (signal?: AbortSignal) => Promise<Response>,
  opts: RetryOptions,
): Promise<Response> {
  return todo('E22', request, opts);
}
