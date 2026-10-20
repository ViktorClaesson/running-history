import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  fetchWithRetry,
  OfflineError,
  pauseFor,
  RateLimitPause,
  RequestBudget,
  WINDOW_MS,
  type Clock,
  type RequestLog,
} from '../../src/lib/data/http';

function memoryLog(): RequestLog & { times: number[] } {
  const times: number[] = [];
  return {
    times,
    async add(at) {
      times.push(at);
    },
    async since(s) {
      return times.filter((t) => t >= s).sort((a, b) => a - b);
    },
    async prune(before) {
      const keep = times.filter((t) => t >= before);
      times.length = 0;
      times.push(...keep);
    },
  };
}

function fakeClock(start = 1_000_000): Clock & { t: number; slept: number[] } {
  const c = {
    t: start,
    slept: [] as number[],
    now: () => c.t,
    sleep: async (ms: number) => {
      c.slept.push(ms);
      c.t += ms;
    },
  };
  return c;
}

const limits = { perWindow: 3, perDay: 5, minIntervalMs: 250 };

describe('E21 RequestBudget', () => {
  it('paces requests at least minIntervalMs apart', async () => {
    const clock = fakeClock();
    const b = new RequestBudget(memoryLog(), limits, clock);
    await b.acquire();
    await b.acquire();
    expect(clock.slept).toEqual([250]);
  });

  it('pauses when the 15-minute window is used up, until the oldest drops out', async () => {
    const clock = fakeClock();
    const log = memoryLog();
    const b = new RequestBudget(log, limits, clock);
    for (let k = 0; k < 3; k++) await b.acquire();
    const first = log.times[0]!;
    const err = await b.acquire().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitPause);
    expect((err as RateLimitPause).reason).toBe('window');
    expect((err as RateLimitPause).until).toBe(first + WINDOW_MS);
    clock.t = first + WINDOW_MS;
    await expect(b.acquire()).resolves.toBeUndefined();
  });

  it('pauses on the daily budget', () => {
    const now = 10 * DAY_MS;
    const times = [
      now - DAY_MS + 10,
      now - 5 * WINDOW_MS,
      now - 4 * WINDOW_MS,
      now - 3 * WINDOW_MS,
      now - 1000,
    ];
    const p = pauseFor(times, now, limits);
    expect(p?.reason).toBe('day');
    expect(p?.until).toBe(times[0]! + DAY_MS);
  });
});

describe('E22 fetchWithRetry', () => {
  const ok = () => new Response('ok', { status: 200 });

  it('retries 429 honouring Retry-After, then succeeds', async () => {
    const clock = fakeClock();
    const budget = new RequestBudget(memoryLog(), { ...limits, perWindow: 99, perDay: 99 }, clock);
    let n = 0;
    const res = await fetchWithRetry(
      async () => (++n < 3 ? new Response('', { status: 429, headers: { 'Retry-After': '2' } }) : ok()),
      { budget, clock, isOnline: () => true },
    );
    expect(res.status).toBe(200);
    expect(clock.slept.filter((ms) => ms === 2000)).toHaveLength(2);
  });

  it('backs off exponentially on 5xx', async () => {
    const clock = fakeClock();
    const budget = new RequestBudget(
      memoryLog(),
      { ...limits, perWindow: 99, perDay: 99, minIntervalMs: 0 },
      clock,
    );
    let n = 0;
    await fetchWithRetry(async () => (++n < 4 ? new Response('', { status: 503 }) : ok()), {
      budget,
      clock,
      isOnline: () => true,
    });
    expect(clock.slept).toEqual([1000, 2000, 4000]);
  });

  it('turns persistent 429s into a pause, and fails fast when offline', async () => {
    const clock = fakeClock();
    const budget = new RequestBudget(memoryLog(), { ...limits, perWindow: 99, perDay: 99 }, clock);
    const always429 = async () => new Response('', { status: 429 });
    await expect(
      fetchWithRetry(always429, { budget, clock, isOnline: () => true, maxAttempts: 2 }),
    ).rejects.toBeInstanceOf(RateLimitPause);
    await expect(
      fetchWithRetry(async () => ok(), { budget, clock, isOnline: () => false }),
    ).rejects.toBeInstanceOf(OfflineError);
  });
});
