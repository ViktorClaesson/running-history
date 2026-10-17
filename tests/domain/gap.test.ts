import { describe, expect, it } from 'vitest';
import {
  altitudeAt,
  flatTimeFactor,
  minettiCost,
  sampleGrades,
  scaleToWatchLaps,
} from '../../src/lib/domain/gap';
import type { WatchLap } from '../../src/lib/domain/parsedRun';

describe('Minetti cost of running', () => {
  it('has the published shape: 3.6 J/kg/m on the flat, cheapest around −20%', () => {
    expect(minettiCost(0)).toBeCloseTo(3.6, 10);
    // Minetti 2002: running is cheapest at a gradient of about −0.20.
    let best = 0;
    for (let g = -0.45; g <= 0.45; g += 0.001) if (minettiCost(g) < minettiCost(best)) best = g;
    expect(best).toBeGreaterThan(-0.22);
    expect(best).toBeLessThan(-0.16);
    // and from there it only gets dearer, all the way up
    for (let g = -0.15; g < 0.45; g += 0.01) expect(minettiCost(g + 0.01)).toBeGreaterThan(minettiCost(g));
  });
  it('makes a climb shorter in flat-equivalent time, a descent longer', () => {
    expect(flatTimeFactor(0)).toBe(1);
    expect(flatTimeFactor(0.05)).toBeLessThan(1);
    expect(flatTimeFactor(-0.05)).toBeGreaterThan(1);
  });
});

describe('grades', () => {
  it('interpolates altitude over distance, and handles standing still', () => {
    const dist = Float64Array.from([0, 10, 10, 20]);
    const alt = Float64Array.from([0, 1, 1, 3]);
    expect(altitudeAt(dist, alt, 5)).toBeCloseTo(0.5);
    expect(altitudeAt(dist, alt, 15)).toBeCloseTo(2);
    expect(altitudeAt(dist, alt, 99)).toBe(3);
  });
  it('reads a steady 5% climb as 5%', () => {
    const dist = Float64Array.from({ length: 101 }, (_, i) => i * 3);
    const alt = Float64Array.from(dist, (d) => d * 0.05);
    const g = sampleGrades(dist, alt);
    expect(g[50]).toBeCloseTo(0.05, 10);
    expect(g[0]).toBeCloseTo(0.05, 10); // the window is clipped at the ends, not zero-padded
  });
});

describe('scaleToWatchLaps', () => {
  it("makes each lap's flat/raw ratio equal the watch's own", () => {
    const dt = Float64Array.from([0, 10, 10, 10, 10]);
    const flat = Float64Array.from([0, 9, 11, 10, 10]);
    const lapOf = Int32Array.from([0, 0, 0, 1, 1]);
    const laps: WatchLap[] = [
      { startT: 0, trigger: 'manual', wktStepIndex: null, distM: 60, timerS: 20, avgGapSpeed: 3.3 }, // ratio 1.1
      { startT: 20, trigger: 'sessionEnd', wktStepIndex: null, distM: 60, timerS: 20, avgGapSpeed: null },
    ];
    expect(scaleToWatchLaps(dt, flat, lapOf, laps)).toBe(true);
    expect((dt[1]! + dt[2]!) / (flat[1]! + flat[2]!)).toBeCloseTo(1.1, 12);
    expect(flat[1]! / flat[2]!).toBeCloseTo(9 / 11, 12); // the shape inside the lap is kept
    expect(flat[3]).toBe(10); // no watch figure: left alone
  });
});
