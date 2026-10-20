import { describe, expect, it } from 'vitest';
import { saveRun } from '../../src/lib/data/repositories/activities';
import { allSamples, staleSampleIds } from '../../src/lib/data/repositories/samples';
import { reprocess } from '../../src/lib/data/reprocess';
import type { SampleSet } from '../../src/lib/domain/sampleTypes';
import { handleRequest } from '../../src/lib/workers/protocol';
import { freshDb } from '../helpers/fakeDb';
import { fakeProcess, summary } from '../helpers/fakeSource';

async function seed(db: ReturnType<typeof freshDb>, ids: string[], version: number) {
  for (const [k, id] of ids.entries()) {
    const raw = { id, format: 'fit' as const, bytes: new ArrayBuffer(8), fetchedAt: 'x' };
    const samples = { ...(await fakeProcess(raw)), processingVersion: version };
    await saveRun(db, {
      summary: summary(id, `2026-10-${String(10 + k).padStart(2, '0')}T18:00:00`),
      raw,
      samples,
    });
  }
}

const rebuild =
  (version: number) =>
  async (raw: { id: string }): Promise<SampleSet> => ({
    ...(await fakeProcess({ id: raw.id, format: 'fit', bytes: new ArrayBuffer(0), fetchedAt: 'x' })),
    processingVersion: version,
  });

describe('reprocess', () => {
  it('rebuilds only the runs on an old version, from raw', async () => {
    const db = freshDb();
    await seed(db, ['a', 'b'], 1);
    await seed(db, ['c'], 2);
    expect((await staleSampleIds(db, 2)).sort()).toEqual(['a', 'b']);
    const res = await reprocess({ db, version: 2, process: rebuild(2) });
    expect(res.rebuilt).toBe(2);
    expect(await staleSampleIds(db, 2)).toEqual([]);
    expect([...(await allSamples(db)).values()].every((c) => c.processingVersion === 2)).toBe(true);
  });

  it('is resumable: an interrupted run leaves exactly the unfinished ones stale', async () => {
    const db = freshDb();
    await seed(db, ['a', 'b', 'c'], 1);
    const ac = new AbortController();
    let n = 0;
    const stopAfterOne = async (raw: { id: string }) => {
      if (++n === 2) ac.abort();
      return rebuild(2)(raw);
    };
    await expect(reprocess({ db, version: 2, process: stopAfterOne, signal: ac.signal })).rejects.toThrow();
    expect((await staleSampleIds(db, 2)).length).toBe(1);
    await reprocess({ db, version: 2, process: rebuild(2) });
    expect(await staleSampleIds(db, 2)).toEqual([]);
  });

  it('reports a run that fails without stopping the rest', async () => {
    const db = freshDb();
    await seed(db, ['a', 'b'], 1);
    const res = await reprocess({
      db,
      version: 2,
      process: async (raw) => {
        if (raw.id === 'a') throw new Error('bad file');
        return rebuild(2)(raw);
      },
    });
    expect(res.failed).toEqual([{ id: 'a', error: 'bad file' }]);
    expect(res.rebuilt).toBe(1);
  });
});

describe('worker protocol', () => {
  it('answers an undecodable file with an error message rather than throwing', () => {
    const { response } = handleRequest({
      kind: 'process',
      requestId: 7,
      raw: { id: 'x', format: 'fit', bytes: new ArrayBuffer(4), fetchedAt: 'x' },
      fileSportIndex: 0,
    });
    expect(response.kind).toBe('error');
    expect(response.requestId).toBe(7);
  });
});
