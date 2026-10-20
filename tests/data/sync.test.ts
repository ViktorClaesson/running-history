import { describe, expect, it } from 'vitest';
import { allActivities, latestLocalDate } from '../../src/lib/data/repositories/activities';
import { getLastSync, getPending } from '../../src/lib/data/repositories/meta';
import { decide, fetchInOrder, planRanges, runSync, type SyncOptions } from '../../src/lib/data/sync';
import { RateLimitPause } from '../../src/lib/data/http';
import { freshDb } from '../helpers/fakeDb';
import { d, fakeProcess, FakeSource, summary } from '../helpers/fakeSource';

const base = (db: ReturnType<typeof freshDb>, source: FakeSource): SyncOptions => ({
  db,
  source,
  process: fakeProcess,
  includedTypes: new Set(['Run']),
  earliest: d('2023-01-01'),
  today: d('2026-10-17'),
});

describe('E24 planRanges', () => {
  it('backfills from the earliest date a year at a time', () => {
    const r = planRanges(null, d('2023-01-01'), d('2024-06-01'));
    expect(r).toEqual([
      { from: '2023-01-01', to: '2023-12-31' },
      { from: '2024-01-01', to: '2024-06-01' },
    ]);
  });
  it('re-syncs from the watermark minus three days', () => {
    expect(planRanges(d('2026-10-14'), d('2023-01-01'), d('2026-10-17'))).toEqual([
      { from: '2026-10-11', to: '2026-10-17' },
    ]);
  });
  it('never starts before the earliest date, and handles a watermark of today', () => {
    expect(planRanges(d('2023-01-02'), d('2023-01-01'), d('2023-01-02'))).toEqual([
      { from: '2023-01-01', to: '2023-01-02' },
    ]);
  });
});

describe('E24 decide', () => {
  const s = summary('a', '2026-10-14T18:00:00');
  const row = { ...s, syncedAt: 'x' };
  it('fetches new, changed, or incomplete runs', () => {
    expect(decide(s, undefined, false, false)).toBe('fetch');
    expect(decide({ ...s, changeMarker: 'm2' }, row, true, true)).toBe('fetch');
    expect(decide(s, row, false, true)).toBe('fetch');
    expect(decide(s, row, true, false)).toBe('fetch');
  });
  it('updates only the summary for a rename, and skips the unchanged', () => {
    expect(decide({ ...s, name: 'renamed' }, row, true, true)).toBe('summary');
    expect(decide(s, row, true, true)).toBe('skip');
  });
});

describe('E25 runSync', () => {
  const history = [
    summary('r1', '2023-02-01T18:51:02'),
    summary('r2', '2024-07-20T23:36:46'), // late-evening: stays on the 20th
    summary('bike', '2025-01-01T10:00:00', { type: 'Ride' }),
    summary('r3', '2026-10-12T18:00:00'),
    summary('r4', '2026-10-14T18:08:47'),
  ];

  it('backfills everything included, in date order, and records the sync', async () => {
    const db = freshDb();
    const src = new FakeSource(history);
    const res = await runSync(base(db, src));
    expect(src.raws).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect(res.fetched).toBe(4);
    expect((await allActivities(db)).map((a) => a.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    expect((await allActivities(db))[1]!.localDate).toBe('2024-07-20');
    expect(await latestLocalDate(db)).toBe('2026-10-14');
    expect(src.lists.length).toBe(4); // 2023, 2024, 2025, 2026 (to today)
    expect(res.requests).toBe(4 + 4);
    expect((await getLastSync(db))?.requests).toBe(8);
  });

  it('a second sync lists from watermark − 3 and fetches nothing it already has', async () => {
    const db = freshDb();
    const src = new FakeSource(history);
    await runSync(base(db, src));
    src.lists = [];
    src.raws = [];
    const res = await runSync(base(db, src));
    expect(src.lists).toEqual([{ oldest: '2026-10-11', newest: '2026-10-17' }]);
    expect(src.raws).toEqual([]);
    expect(res.requests).toBe(1);
    expect(res.skipped).toBe(2); // r3 and r4 are inside the overlap
    expect((await allActivities(db)).length).toBe(4); // no duplicates
  });

  it('re-downloads a run whose change marker moved, and picks up a new one on the same day', async () => {
    const db = freshDb();
    const src = new FakeSource(history);
    await runSync(base(db, src));
    src.raws = [];
    src.activities = [
      ...history.filter((a) => a.id !== 'r4'),
      { ...history[4]!, changeMarker: 'm2' },
      summary('r5', '2026-10-14T21:00:00'),
    ];
    await runSync(base(db, src));
    expect(src.raws).toEqual(['r4', 'r5']);
  });

  it('isolates a failing run, keeps going, and retries it next time', async () => {
    const db = freshDb();
    const src = new FakeSource(history);
    src.failRaw.add('r2');
    const res = await runSync(base(db, src));
    expect(res.failed.map((f) => f.summary.id)).toEqual(['r2']);
    expect((await allActivities(db)).map((a) => a.id)).toEqual(['r1', 'r3', 'r4']);
    expect((await getPending(db)).map((p) => p.id)).toEqual(['r2']);
    // r2 is far older than the watermark, so only the pending list brings it back.
    src.failRaw.clear();
    src.raws = [];
    await runSync(base(db, src));
    expect(src.raws).toEqual(['r2']);
    expect(await getPending(db)).toEqual([]);
    expect((await allActivities(db)).length).toBe(4);
  });

  it('resumes an interrupted backfill from a valid watermark', async () => {
    const db = freshDb();
    const src = new FakeSource(history);
    const ac = new AbortController();
    src.beforeRaw = (id) => {
      if (id === 'r3') ac.abort();
    };
    await expect(runSync({ ...base(db, src), signal: ac.signal, concurrency: 1 })).rejects.toThrow();
    // Everything before the interruption is stored; nothing after it.
    const stored = (await allActivities(db)).map((a) => a.id);
    expect(stored).toEqual(['r1', 'r2']);
    src.beforeRaw = undefined;
    src.raws = [];
    await runSync(base(db, src));
    expect(src.raws).toEqual(['r3', 'r4']);
  });

  it('waits out a rate-limit pause and carries on', async () => {
    const db = freshDb();
    const src = new FakeSource(history.slice(0, 2));
    let thrown = false;
    const realFetch = src.fetchRaw.bind(src);
    src.fetchRaw = async (id) => {
      if (!thrown) {
        thrown = true;
        throw new RateLimitPause(1234, 'window');
      }
      return realFetch(id);
    };
    const phases: string[] = [];
    const waits: number[] = [];
    await runSync({
      ...base(db, src),
      waitUntil: async (until) => void waits.push(until),
      onProgress: (p) => phases.push(p.phase),
    });
    expect(waits).toEqual([1234]);
    expect(phases).toContain('paused');
    expect((await allActivities(db)).length).toBe(2);
  });

  it('a full re-sync deletes runs the source no longer has', async () => {
    const db = freshDb();
    const src = new FakeSource(history);
    await runSync(base(db, src));
    src.activities = history.filter((a) => a.id !== 'r3');
    const res = await runSync({ ...base(db, src), full: { from: d('2026-01-01'), to: d('2026-10-17') } });
    expect(res.deleted).toBe(1);
    expect((await allActivities(db)).map((a) => a.id)).toEqual(['r1', 'r2', 'r4']);
  });
});

describe('E25 fetchInOrder', () => {
  it('commits in input order even when later items finish first', async () => {
    const committed: number[] = [];
    const delays = [30, 5, 15, 0];
    await fetchInOrder([0, 1, 2, 3], 3, {
      fetch: (k) => new Promise<number>((res) => setTimeout(() => res(k), delays[k])),
      commit: async (k) => void committed.push(k),
      fail: () => {},
      step: () => {},
    });
    expect(committed).toEqual([0, 1, 2, 3]);
  });
});
