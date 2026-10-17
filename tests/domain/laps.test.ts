import { describe, expect, it } from 'vitest';
import { detectSegments } from '../../src/lib/domain/laps';
import type { WatchLap } from '../../src/lib/domain/parsedRun';

const lap = (trigger: string | null, wktStepIndex: number | null = null): WatchLap => ({
  startT: 0,
  trigger,
  wktStepIndex,
  distM: 0,
  timerS: 0,
  avgGapSpeed: null,
});

// The shapes are the real ones from docs/intervals-api-findings.md.
describe('detectSegments', () => {
  it('an easy run with autolap off is one segment', () => {
    expect(detectSegments([lap('sessionEnd')])).toEqual({ rule: 'none', segmentOfLap: [0], count: 1 });
  });

  it('1 km autolaps are ignored', () => {
    const laps = [...Array(9).fill(lap('distance')), lap('sessionEnd')];
    const s = detectSegments(laps);
    expect(s.rule).toBe('none');
    expect(s.count).toBe(1);
  });

  it('every lap-button press starts a new segment', () => {
    const s = detectSegments([lap('manual'), lap('manual'), lap('manual'), lap('sessionEnd')]);
    expect(s).toEqual({ rule: 'button', segmentOfLap: [0, 1, 2, 3], count: 4 });
  });

  it('a Garmin workout ends steps with time/distance triggers, told apart by step index', () => {
    // "20x90''": manual end of warm-up, then alternating steps 1/2 ended by time.
    const laps = [
      lap('manual', 0),
      lap('time', 1),
      lap('time', 2),
      lap('time', 1),
      lap('time', 2),
      lap('sessionEnd', 3),
    ];
    const s = detectSegments(laps);
    expect(s.rule).toBe('button+workout');
    expect(s.segmentOfLap).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('autolaps inside one workout step stay together', () => {
    // A 3 km warm-up step with 1 km autolap on, ended by the button, then steps 1/2.
    const laps = [
      lap('distance', 0),
      lap('distance', 0),
      lap('distance', 0),
      lap('manual', 0),
      lap('distance', 1),
      lap('time', 2),
    ];
    expect(detectSegments(laps).segmentOfLap).toEqual([0, 0, 0, 0, 1, 2]);
  });

  it('a structured workout with no button presses reports the workout rule', () => {
    expect(detectSegments([lap('time', 0), lap('time', 1), lap('sessionEnd', 1)]).rule).toBe('workout');
  });

  it('no laps at all is one segment', () => {
    expect(detectSegments([])).toEqual({ rule: 'none', segmentOfLap: [], count: 1 });
  });
});
