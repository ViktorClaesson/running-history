import type { ChunkSet } from '../../src/lib/domain/chunkTypes';
import { daysBetween, isoDate, localDateOf, type IsoDate } from '../../src/lib/domain/dates';
import type { ActivitySummary, RawActivity } from '../../src/lib/domain/types';
import type { ActivitySource } from '../../src/lib/data/sources/types';

export function summary(
  id: string,
  startLocal: string,
  extra: Partial<ActivitySummary> = {},
): ActivitySummary {
  return {
    id,
    startLocal,
    localDate: localDateOf(startLocal),
    name: `run ${id}`,
    type: 'Run',
    distanceM: 10000,
    movingS: 3000,
    elapsedS: 3100,
    avgHr: 140,
    elevGainM: 20,
    changeMarker: 'm1',
    fileSportIndex: 0,
    ...extra,
  };
}

/** An in-memory source that records every call, and can be told to fail. */
export class FakeSource implements ActivitySource {
  lists: { oldest: IsoDate; newest: IsoDate }[] = [];
  raws: string[] = [];
  failRaw = new Set<string>();
  /** Called before every fetchRaw, e.g. to abort mid-sync. */
  beforeRaw?: (id: string) => void;

  constructor(public activities: ActivitySummary[]) {}

  async listActivities(oldest: IsoDate, newest: IsoDate) {
    this.lists.push({ oldest, newest });
    const within = (a: ActivitySummary) =>
      daysBetween(oldest, a.localDate) >= 0 && daysBetween(a.localDate, newest) >= 0;
    return { activities: this.activities.filter(within), skipped: 0 };
  }

  async fetchRaw(id: string, signal?: AbortSignal): Promise<RawActivity> {
    this.beforeRaw?.(id);
    signal?.throwIfAborted(); // a real fetch rejects once its signal aborts
    this.raws.push(id);
    if (this.failRaw.has(id)) throw new Error(`boom ${id}`);
    return { id, format: 'fit', bytes: new ArrayBuffer(16), fetchedAt: '2026-10-17T10:00:00Z' };
  }
}

/** A stand-in for the worker: one chunk per run. */
export async function fakeProcess(raw: RawActivity): Promise<ChunkSet> {
  return {
    activityId: raw.id,
    processingVersion: 1,
    chunkDistanceM: 100,
    lapRule: 'none',
    gapMethod: 'none',
    segmentCount: 1,
    seg: new Uint16Array([0]),
    startM: new Float32Array([0]),
    distM: new Float32Array([100]),
    durS: new Float32Array([30]),
    flatDurS: new Float32Array([30]),
    hr: new Float32Array([140]),
    gainM: new Float32Array([0]),
    lossM: new Float32Array([0]),
  };
}

export const d = isoDate;
