import { describe, expect, it } from 'vitest';
import { barYAxis, MIN_RUN_H } from '../../src/lib/ui/charts/barsPanel';

const PLOT_H = 260;
const BASE = 274; // the plot's floor, in canvas pixels
const axis = (km: number[], scale: 'linear' | 'log', capKm: number | null = null) =>
  barYAxis({ km: Float64Array.from(km), scale, capKm }, 0, km.length - 1, PLOT_H, BASE);

describe('E30 bar axis', () => {
  it('linear: zero on the floor, nice ticks up to the tallest day in view', () => {
    const a = axis([0, 4.2, 12.3, 0], 'linear');
    expect(a.top).toBe(15);
    expect(a.ticks).toEqual([5, 10, 15]); // no tick at 0: the floor is drawn on its own
    expect(a.yOf(0)).toBe(BASE);
    expect(a.yOf(15)).toBeCloseTo(BASE - PLOT_H, 9);
    expect(a.capped).toBe(false);
  });

  it('stops at the cap when a day is cut, or when rounding up would pass it', () => {
    const cut = axis([10, 62, 8], 'linear', 45);
    expect(cut.top).toBe(45);
    expect(cut.capped).toBe(true);
    expect(cut.ticks[cut.ticks.length - 1]).toBe(45);
    expect(cut.yOf(45)).toBeCloseTo(BASE - PLOT_H, 9);
    expect(axis([42], 'linear', 45).top).toBe(45); // 42 would round up to 50
    expect(axis([30], 'linear', 45)).toMatchObject({ top: 30, capped: false }); // under the cap: no cap
  });

  it('log: 1/2/5 values around the data, at least a decade, the bottom MIN_RUN_H above the floor', () => {
    const a = axis([3, 0, 12, 7], 'log'); // rest days are ignored, never log(0)
    expect(a.top).toBe(20);
    expect(a.ticks).toEqual([2, 5, 10, 20]);
    expect(a.yOf(2)).toBeCloseTo(BASE - MIN_RUN_H, 9);
    expect(a.yOf(20)).toBeCloseTo(BASE - PLOT_H, 9);
    expect(axis([8, 9], 'log').ticks).toEqual([1, 2, 5, 10]); // 5 … 10 is under a decade: from 1
  });

  it('nothing in view: a plausible empty axis rather than NaN', () => {
    const a = axis([0, 0], 'linear');
    expect(a.ticks.length).toBeGreaterThan(0);
    expect(Number.isFinite(a.yOf(5))).toBe(true);
    expect(Number.isFinite(axis([0, 0], 'log').yOf(5))).toBe(true);
  });
});
