import { describe, expect, it } from 'vitest';
import { logDown, logTicks, logUp, niceTicks } from '../../src/lib/ui/charts/ticks';

describe('E29 axis ticks', () => {
  it('niceTicks: about four even steps of 1/2/2.5/5 × 10ⁿ, from 0 to at least the max', () => {
    expect(niceTicks(10)).toEqual({ ticks: [0, 2.5, 5, 7.5, 10], step: 2.5 });
    expect(niceTicks(12.3)).toEqual({ ticks: [0, 5, 10, 15], step: 5 });
    expect(niceTicks(87)).toEqual({ ticks: [0, 25, 50, 75, 100], step: 25 });
    expect(niceTicks(0.9).step).toBeCloseTo(0.25, 12);
    for (const max of [1, 3.3, 45, 46, 199, 1234]) {
      const { ticks, step } = niceTicks(max);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(max - 1e-9);
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect([1, 2, 2.5, 5]).toContain(step / 10 ** Math.floor(Math.log10(step)));
    }
  });

  it('logUp / logDown round out to 1, 2 or 5 × 10ⁿ', () => {
    expect([logUp(3), logUp(5), logUp(12), logUp(0.7), logUp(51)]).toEqual([5, 5, 20, 1, 100]);
    expect([logDown(3), logDown(5), logDown(12), logDown(0.7), logDown(99)]).toEqual([2, 5, 10, 0.5, 50]);
    expect(logUp(20)).toBe(20); // already round: stays
  });

  it('logTicks: every 1/2/5 × 10ⁿ value in the range, ends included', () => {
    expect(logTicks(2, 50)).toEqual([2, 5, 10, 20, 50]);
    expect(logTicks(0.5, 5)).toEqual([0.5, 1, 2, 5]);
    expect(logTicks(1, 1)).toEqual([1]);
  });
});
