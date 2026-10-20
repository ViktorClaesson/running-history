import { describe, expect, it } from 'vitest';
import {
  altitudeAt,
  flatMetresFactor,
  GRADE_WINDOW_M,
  minettiCost,
  sampleGrades,
} from '../../src/lib/domain/gap';

describe('Minetti cost of running', () => {
  it('has the published shape: 3.6 J/kg/m on the flat, cheapest around −20%', () => {
    expect(minettiCost(0)).toBeCloseTo(3.6, 10);
    let best = 0;
    for (let g = -0.45; g <= 0.45; g += 0.001) if (minettiCost(g) < minettiCost(best)) best = g;
    expect(best).toBeGreaterThan(-0.22);
    expect(best).toBeLessThan(-0.16);
    for (let g = -0.15; g < 0.45; g += 0.01) expect(minettiCost(g + 0.01)).toBeGreaterThan(minettiCost(g));
  });

  it('counts a downhill as easier and equal up-and-down as harder than flat', () => {
    expect(flatMetresFactor(0)).toBe(1);
    expect(flatMetresFactor(0.05)).toBeGreaterThan(1);
    expect(flatMetresFactor(-0.05)).toBeLessThan(1);
    // Energy adds up, so over equal distances up and down the flat-equivalent metres exceed the real ones.
    for (const g of [0.02, 0.05, 0.1, 0.2])
      expect((flatMetresFactor(g) + flatMetresFactor(-g)) / 2).toBeGreaterThan(1);
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

  it('reads a steady 5% climb as 5%, over a 25 m window', () => {
    expect(GRADE_WINDOW_M).toBe(25);
    const dist = Float64Array.from({ length: 101 }, (_, i) => i * 3);
    const alt = Float64Array.from(dist, (d) => d * 0.05);
    const g = sampleGrades(dist, alt);
    expect(g[50]).toBeCloseTo(0.05, 10);
    expect(g[0]).toBeCloseTo(0.05, 10); // clipped at the ends, not zero-padded
  });

  it('smooths the 0.2 m altimeter steps that make neighbouring samples jump', () => {
    // Flat ground read by a 0.2 m-resolution altimeter that flickers between two values.
    const dist = Float64Array.from({ length: 200 }, (_, i) => i * 3);
    const alt = Float64Array.from(dist, (_, i) => (i % 2 ? 100.2 : 100));
    const g = sampleGrades(dist, alt);
    expect(Math.max(...Array.from(g).map(Math.abs))).toBeLessThan(0.015); // 0.2 m over 25 m; vs 6.7% between neighbours
  });
});
