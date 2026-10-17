import type { IsoDate } from '../../domain/dates';
import type { XMap } from './geometry';
import type { Theme } from './theme';

/** Everything any panel needs to draw itself, besides its own data. */
export interface Frame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  x: XMap;
  /** Days in the history. */
  n: number;
  hover: number | null;
  selected: number | null;
  theme: Theme;
  /** This panel is the lowest one shown, so it carries the date labels. */
  isBottom: boolean;
  dateAt: (i: number) => IsoDate;
}

/** Top and bottom insets of a panel. The lowest visible panel's bottom inset fits the dates. */
export const INSET_TOP = 10;
export const INSET_BOTTOM = 12;
export const XLAB_BOTTOM = 26;
export const bottomInset = (f: Frame): number => (f.isBottom ? XLAB_BOTTOM : INSET_BOTTOM);

/**
 * Sizes a canvas's backing store to its CSS size × the device pixel ratio, so it stays
 * sharp on high-density screens, and clears it. Drawing then uses CSS pixels.
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): { w: number; h: number } {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { w, h };
}
