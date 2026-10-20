import { describe, expect, it } from 'vitest';
import { clampView, MIN_SPAN, zoomAbout } from '../../src/lib/ui/charts/geometry';

/** The fractional day at `frac` across the plot (0 = left edge, 1 = right edge). */
const dayAtFrac = (v: { span: number; center: number }, frac: number) =>
  v.center - v.span / 2 + frac * v.span;

describe('E28 zoom', () => {
  it('keeps a view inside the history, at least MIN_SPAN days wide', () => {
    expect(clampView({ span: 100, center: 500 }, 1000)).toEqual({ span: 100, center: 500 });
    expect(clampView({ span: 100, center: 10 }, 1000)).toEqual({ span: 100, center: 50 }); // past the start
    expect(clampView({ span: 100, center: 990 }, 1000)).toEqual({ span: 100, center: 950 }); // past the end
    expect(clampView({ span: 2, center: 500 }, 1000)).toEqual({ span: MIN_SPAN, center: 500 });
    expect(clampView({ span: 5000, center: 0 }, 1000)).toEqual({ span: 1000, center: 500 }); // all of it
    expect(clampView({ span: 10, center: 7 }, 3)).toEqual({ span: 3, center: 1.5 }); // a 3-day history
  });

  it('zooms about the cursor: the day under it stays put', () => {
    const v = { span: 200, center: 500 };
    for (const frac of [0, 0.25, 0.5, 0.9]) {
      for (const factor of [0.5, 0.8, 1.25]) {
        const z = zoomAbout(v, frac, factor, 1000);
        expect(z.span).toBeCloseTo(200 * factor, 9);
        expect(dayAtFrac(z, frac)).toBeCloseTo(dayAtFrac(v, frac), 9);
      }
    }
  });

  it('never zooms past the limits, and clamps rather than re-centring', () => {
    expect(zoomAbout({ span: 6, center: 500 }, 0.5, 0.1, 1000).span).toBe(MIN_SPAN);
    expect(zoomAbout({ span: 800, center: 600 }, 0.5, 2, 1000)).toEqual({ span: 1000, center: 500 });
    // Zooming out near the newest day: the right edge stays on the last day, nothing drifts past it.
    const z = zoomAbout({ span: 100, center: 950 }, 1, 1.5, 1000);
    expect(z.center + z.span / 2).toBeCloseTo(1000, 9);
  });
});
