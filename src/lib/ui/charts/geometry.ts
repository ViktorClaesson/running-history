import { todo } from '../../exercise';
/**
 * The shared x mapping. Every panel has the same left/right padding and the same view, so
 * a day sits at the same screen x on each of them. A view is `span` days wide around a
 * fractional day index `center`.
 */
export const PAD = { l: 54, r: 14 } as const;
/** The fewest days a view can show. */
export const MIN_SPAN = 5;

export interface ViewState {
  span: number;
  center: number;
}

export interface XMap {
  /** Canvas width in CSS pixels. */
  width: number;
  view: ViewState;
}

export const plotW = (m: XMap): number => m.width - PAD.l - PAD.r;
export const barW = (m: XMap): number => plotW(m) / m.view.span;
export const leftDay = (m: XMap): number => m.view.center - m.view.span / 2;
/** Left edge of day i, in pixels. */
export const xOf = (m: XMap, i: number): number => PAD.l + (i - leftDay(m)) * barW(m);
/** The middle of day i. */
export const xMid = (m: XMap, i: number): number => xOf(m, i) + barW(m) / 2;
/** The day under pixel x (may be outside 0 … n − 1). */
export const dayAt = (m: XMap, px: number): number => Math.floor((px - PAD.l) / barW(m) + leftDay(m));

/** Days at least partly in view, plus one on each side so lines run off the edges. */
export function visibleRange(m: XMap, n: number): [number, number] {
  return [Math.max(0, Math.floor(leftDay(m)) - 1), Math.min(n - 1, Math.ceil(leftDay(m) + m.view.span) + 1)];
}

/*
 * TODO(E28) · zoom · difficulty ★★☆ · phase 5
 *   clampView(v, n)        keep a view inside a history of n days: span at least MIN_SPAN (or n,
 *                          if the history is shorter) and at most n; then the centre so that
 *                          neither edge is past 0 or n. A span covering everything centres on n ÷ 2.
 *   zoomAbout(v, frac, factor, n)
 *                          zoom by `factor` (> 1 zooms out) about the point `frac` of the way
 *                          across the plot (0 = left edge, 1 = right edge): the fractional day
 *                          under it keeps its screen position. That day is
 *                          center − span/2 + frac × span; the new span is span × factor, kept
 *                          within MIN_SPAN…n; place the new centre so the anchor sits at the
 *                          same frac, then clampView.
 * Edge cases that matter, and why:
 * - Never re-centre on the cursor: that makes the chart jump, and is the classic zoom bug.
 * - Zooming out against an edge clamps rather than drifting past the end.
 * Background: legacy/CLAUDE.md, "Gotchas that have bitten before" ("Zoom is cursor-anchored").
 * Concepts:
 * - the maths of anchored zoom, drawn out: https://en.wikipedia.org/wiki/Affine_transformation
 * - WheelEvent.deltaY: https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaY
 * Check: npm run exercise E28 (tests/ui/geometry.test.ts). In the app ⌘/Ctrl + scroll zooms
 * about the cursor, and the view can no longer be dragged past either end.
 * Spoiler: `onWheel()` and `currentView()` in legacy/running-history.html.
 */
/** Keeps a view inside the history: at least MIN_SPAN days, never past either end. */
export function clampView(v: ViewState, n: number): ViewState {
  return todo('E28', v, n);
}

/**
 * Zoom about a point: the fractional day under `frac` (0 = left edge of the plot, 1 = right)
 * keeps its screen position while both sides scale around it. Never re-centres.
 */
export function zoomAbout(v: ViewState, frac: number, factor: number, n: number): ViewState {
  return todo('E28', v, frac, factor, n);
}
