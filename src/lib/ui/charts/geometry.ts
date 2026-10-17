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

/** Keeps a view inside the history: at least MIN_SPAN days, never past either end. */
export function clampView(v: ViewState, n: number): ViewState {
  const span = Math.max(Math.min(MIN_SPAN, n), Math.min(n, v.span));
  const half = span / 2;
  const center = span >= n ? n / 2 : Math.max(half, Math.min(n - half, v.center));
  return { span, center };
}

/**
 * Zoom about a point: the fractional day under `frac` (0 = left edge of the plot, 1 = right)
 * keeps its screen position while both sides scale around it. Never re-centres.
 */
export function zoomAbout(v: ViewState, frac: number, factor: number, n: number): ViewState {
  const anchor = v.center - v.span / 2 + frac * v.span;
  const span = Math.max(MIN_SPAN, Math.min(n, v.span * factor));
  return clampView({ span, center: anchor + (0.5 - frac) * span }, n);
}
