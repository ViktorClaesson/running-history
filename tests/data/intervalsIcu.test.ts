import { describe, expect, it } from 'vitest';
import { looksLikeFit, parseActivityList } from '../../src/lib/data/sources/intervalsIcu';

describe('Intervals.icu list parsing', () => {
  it('normalizes real-shaped entries and skips the Strava stubs', () => {
    const body = [
      {
        id: 'i197306134',
        start_date_local: '2026-10-14T18:08:47',
        type: 'Run',
        name: "TTRC 20x1' @ 4:40",
        distance: 8954.64,
        moving_time: 3246,
        elapsed_time: 3745,
        average_heartrate: 132,
        total_elevation_gain: 53.89,
        analyzed: '2026-10-15T11:58:31.352+00:00',
      },
      {
        id: '20579934423',
        start_date_local: '2026-10-14T12:11:44',
        source: 'STRAVA',
        _note: 'not available',
      },
      'garbage',
    ];
    const { activities, skipped } = parseActivityList(body);
    expect(skipped).toBe(2);
    expect(activities).toEqual([
      {
        id: 'i197306134',
        startLocal: '2026-10-14T18:08:47',
        localDate: '2026-10-14',
        name: "TTRC 20x1' @ 4:40",
        type: 'Run',
        distanceM: 8954.64,
        movingS: 3246,
        elapsedS: 3745,
        avgHr: 132,
        elevGainM: 53.89,
        changeMarker: '2026-10-15T11:58:31.352+00:00',
        fileSportIndex: 0,
      },
    ]);
  });

  it('takes the day from the local start, even late in the evening', () => {
    const { activities } = parseActivityList([
      { id: 'x', start_date_local: '2023-07-20T23:36:46', type: 'Run' },
    ]);
    expect(activities[0]!.localDate).toBe('2023-07-20');
    expect(activities[0]!.avgHr).toBeNull();
  });

  it('rejects a non-array body', () => {
    expect(() => parseActivityList({ error: 'x' })).toThrow();
  });

  it('recognizes a FIT header', () => {
    const fit = new Uint8Array([14, 32, 0, 0, 0, 0, 0, 0, 46, 70, 73, 84]).buffer;
    expect(looksLikeFit(fit)).toBe(true);
    expect(looksLikeFit(new ArrayBuffer(4))).toBe(false);
  });
});
