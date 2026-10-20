import type { SampleSet } from '../../src/lib/domain/sampleTypes';
import { isoDate, type IsoDate } from '../../src/lib/domain/dates';
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
    localDate: startLocal.slice(0, 10) as IsoDate, // not localDateOf: helpers mustn't need an exercise
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
    // ISO dates sort as text, so no date maths (and no exercise) is needed here.
    const within = (a: ActivitySummary) => oldest <= a.localDate && a.localDate <= newest;
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

/** A stand-in for the worker: one sample per run. */
export async function fakeProcess(raw: RawActivity): Promise<SampleSet> {
  return {
    activityId: raw.id,
    processingVersion: 1,
    lapRule: 'none',
    segmentCount: 1,
    seg: new Uint16Array([0]),
    dt: new Float32Array([30]),
    dist: new Float32Array([100]),
    grade: new Float32Array([0]),
    hr: new Float32Array([140]),
  };
}

export const d = isoDate;
