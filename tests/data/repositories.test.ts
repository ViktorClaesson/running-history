import { describe, expect, it } from 'vitest';
import type { SamplesRow } from '../../src/lib/data/db';
import { latestLocalDate, saveRun, saveSummary } from '../../src/lib/data/repositories/activities';
import { staleSampleIds } from '../../src/lib/data/repositories/samples';
import { freshDb } from '../helpers/fakeDb';
import { fakeProcess, summary } from '../helpers/fakeSource';

const raw = (id: string) => ({ id, format: 'fit' as const, bytes: new ArrayBuffer(8), fetchedAt: 'x' });

async function run(id: string, startLocal: string, version = 1) {
  return {
    summary: summary(id, startLocal),
    raw: raw(id),
    samples: { ...(await fakeProcess(raw(id))), processingVersion: version },
  };
}

describe('E20 repositories', () => {
  it("latestLocalDate is the newest run's local date (the watermark), null when empty", async () => {
    const db = freshDb();
    expect(await latestLocalDate(db)).toBeNull();
    await saveSummary(db, summary('a', '2026-10-12T23:50:00'));
    await saveSummary(db, summary('b', '2026-09-01T07:00:00'));
    expect(await latestLocalDate(db)).toBe('2026-10-12');
  });

  it('saveRun writes the summary, the raw file and the samples, stamped with the sync time', async () => {
    const db = freshDb();
    await saveRun(db, await run('a', '2026-10-12T18:00:00'), new Date('2026-10-13T10:00:00Z'));
    expect(await db.activities.get('a')).toMatchObject({ id: 'a', syncedAt: '2026-10-13T10:00:00.000Z' });
    expect(await db.raw.get('a')).toMatchObject({ id: 'a', format: 'fit' });
    expect((await db.samples.get('a'))?.activityId).toBe('a');
  });

  it('saveRun is one transaction: when one write fails, none of the three lands', async () => {
    const db = freshDb();
    await saveRun(db, await run('ok', '2026-10-11T18:00:00'));
    expect(await db.activities.get('ok')).toBeDefined();
    const bad = await run('a', '2026-10-12T18:00:00');
    // A samples row without its key can't be stored, and that write comes last.
    const broken = { ...bad, samples: { ...bad.samples, activityId: undefined } as unknown as SamplesRow };
    await expect(saveRun(db, broken)).rejects.toThrow();
    expect(await db.activities.get('a')).toBeUndefined();
    expect(await db.raw.get('a')).toBeUndefined();
  });

  it('staleSampleIds: runs with raw data whose samples are missing or from another version', async () => {
    const db = freshDb();
    await saveRun(db, await run('old', '2026-10-10T18:00:00', 1));
    await saveRun(db, await run('current', '2026-10-11T18:00:00', 2));
    await db.raw.put(raw('unprocessed'));
    expect((await staleSampleIds(db, 2)).sort()).toEqual(['old', 'unprocessed']);
    expect(await staleSampleIds(freshDb(), 2)).toEqual([]);
  });
});
