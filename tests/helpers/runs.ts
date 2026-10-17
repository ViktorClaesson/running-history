import type { ParsedRun, Pause, WatchLap } from '../../src/lib/domain/parsedRun';

/**
 * Builds a ParsedRun at 1 Hz from a list of stretches: each stretch runs `seconds` at
 * `speed` m/s, climbing `climb` metres in total, optionally starting a new watch lap.
 */
export interface Stretch {
  seconds: number;
  speed: number;
  climb?: number;
  lap?: Partial<WatchLap>;
  hr?: number;
}

export function makeRun(stretches: Stretch[], pauses: Pause[] = []): ParsedRun {
  const t = [0];
  const dist = [0];
  const alt = [100];
  const hr = [NaN];
  const laps: WatchLap[] = [];
  let clock = 0;
  for (const s of stretches) {
    if (s.lap || laps.length === 0) {
      laps.push({
        startT: clock,
        trigger: null,
        wktStepIndex: null,
        distM: 0,
        timerS: 0,
        avgGapSpeed: null,
        ...s.lap,
      });
    }
    for (let k = 0; k < s.seconds; k++) {
      clock += 1;
      // Skip over a pause: no samples inside it, the clock jumps by its length.
      for (const p of pauses) if (clock > p.from && clock <= p.from + 1) clock += p.to - p.from;
      t.push(clock);
      dist.push(dist[dist.length - 1]! + s.speed);
      alt.push(alt[alt.length - 1]! + (s.climb ?? 0) / s.seconds);
      hr.push(s.hr ?? 140);
    }
  }
  return {
    t: Float64Array.from(t),
    dist: Float64Array.from(dist),
    alt: Float64Array.from(alt),
    hr: Float64Array.from(hr),
    pauses,
    laps,
    totals: { distM: dist[dist.length - 1]!, timerS: stretches.reduce((a, s) => a + s.seconds, 0) },
  };
}
