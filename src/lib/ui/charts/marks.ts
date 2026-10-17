import { markedDays } from './axes';
import type { Frame } from './frame';
import { barW, PAD, xOf } from './geometry';

/**
 * Window-start marks. Every line is an average over a window *ending* on the marked day;
 * this marks the first day inside each window (a dot on that window's own line, plus a
 * faint dashed line down the plot), so each line's reach is visible against what it covers.
 * A window reaching back past the left edge gets a chevron at that edge instead, one slot
 * per window. Hover's marks are filled, the pin's hollow and fainter. See legacy/CLAUDE.md,
 * "Window-start marks".
 */
export interface Mark {
  days: number;
  colour: string;
  /** Chevron slot: the window's own index, so a hidden window leaves a gap. */
  slot: number;
  /** y of this window's line on a day, or null when there is no line to sit on. */
  yAt: ((day: number) => number | null) | null;
}

/** Fallback row for a dot with no line under it (and the chevron row), below the top inset. */
const MARK_Y = 4;

export function drawWindowStarts(
  f: Frame,
  insetTop: number,
  plotH: number,
  i0: number,
  i1: number,
  marks: Mark[],
  dots = true,
): void {
  const days = markedDays(f, i0, i1);
  if (!days.length) return;
  const { ctx, theme } = f;
  for (const m of marks) {
    let chevron: boolean | null = null; // null = none, true = the pin's, false = hover's
    for (const [day, hollow] of days) {
      const st = day - m.days + 1;
      if (st < i0) {
        if (chevron === null || !hollow) chevron = hollow;
        continue;
      }
      const x = Math.round(xOf(f.x, st) + barW(f.x) / 2) + 0.5;
      ctx.strokeStyle = m.colour;
      ctx.lineWidth = 1;
      ctx.globalAlpha = hollow ? 0.22 : 0.4;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, insetTop);
      ctx.lineTo(x, insetTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      if (!dots) continue;
      const onLine = m.yAt ? m.yAt(st) : null;
      const y = onLine ?? insetTop + MARK_Y;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = hollow ? theme.surface : m.colour;
      ctx.fill();
      ctx.strokeStyle = m.colour;
      ctx.lineWidth = hollow ? 1.5 : 1;
      ctx.stroke();
    }
    if (chevron === null) continue;
    drawChevron(f, PAD.l + 6 + m.slot * 10, insetTop + MARK_Y, m.colour, chevron);
  }
}

function drawChevron(f: Frame, x: number, y: number, colour: string, hollow: boolean): void {
  const { ctx } = f;
  ctx.strokeStyle = colour;
  ctx.globalAlpha = hollow ? 0.55 : 1;
  ctx.lineWidth = hollow ? 1.5 : 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 2.5, y - 4);
  ctx.lineTo(x - 2.5, y);
  ctx.lineTo(x + 2.5, y + 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
