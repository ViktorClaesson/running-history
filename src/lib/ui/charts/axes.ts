import { fmtShort, monthName, weekdayMon0 } from '../../domain/dates';
import type { Frame } from './frame';
import { leftDay, PAD, xMid } from './geometry';
import { FONT } from './theme';

/** Horizontal gridlines with labels on the left; the zero line in the baseline grey. */
export function drawYGrid(
  f: Frame,
  ticks: number[],
  yOf: (v: number) => number,
  label: (t: number) => string,
): void {
  const { ctx, theme } = f;
  ctx.font = FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of ticks) {
    const y = Math.round(yOf(t)) + 0.5;
    ctx.strokeStyle = t === 0 ? theme.baseline : theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(f.width - PAD.r, y);
    ctx.stroke();
    ctx.fillStyle = theme.muted;
    ctx.fillText(label(t), PAD.l - 8, y);
  }
}

/** The rotated axis title on the left. */
export function drawYTitle(f: Frame, insetTop: number, plotH: number, text: string): void {
  const { ctx } = f;
  ctx.save();
  ctx.translate(13, insetTop + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.fillStyle = f.theme.muted;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Date labels under the lowest panel: days, weeks or months depending on the zoom. */
export function drawXLabels(f: Frame, insetTop: number, plotH: number, i0: number, i1: number): void {
  const { ctx, theme } = f;
  const span = f.x.view.span;
  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = theme.muted;
  const ty = insetTop + plotH + 7;
  const every =
    span <= 21
      ? { kind: 'day' as const, n: Math.ceil(span / 10) }
      : span <= 120
        ? { kind: 'week' as const, n: 1 }
        : { kind: 'month' as const, n: span <= 500 ? 1 : span <= 1100 ? 3 : 6 };
  let lastX = -1e9;
  if (every.kind !== 'day') {
    const d0 = f.dateAt(Math.max(0, Math.ceil(leftDay(f.x))));
    ctx.fillText(d0.slice(0, 4), PAD.l + 16, ty);
    lastX = PAD.l + 16;
  }
  for (let i = i0; i <= i1; i++) {
    const d = f.dateAt(i);
    const day = Number(d.slice(8, 10));
    const month = Number(d.slice(5, 7)) - 1;
    let text: string | null = null;
    if (every.kind === 'day') text = i % every.n === 0 ? fmtShort(d) : null;
    else if (every.kind === 'week') text = weekdayMon0(d) === 0 ? `${day} ${monthName(d)}` : null;
    else if (day === 1 && month % every.n === 0) text = month === 0 ? d.slice(0, 4) : monthName(d);
    if (text === null) continue;
    const x = xMid(f.x, i);
    if (x < PAD.l - 2 || x > f.width - PAD.r + 2 || x - lastX < 46) continue;
    lastX = x;
    ctx.fillText(text, x, ty);
  }
}

/** The day marker on a line panel: a vertical hairline and a dot (solid = hover, ring = pinned). */
export function drawDayDot(
  f: Frame,
  i: number,
  y: number,
  colour: string,
  hollow: boolean,
  insetTop: number,
  plotH: number,
): void {
  const { ctx, theme } = f;
  const x = Math.round(xMid(f.x, i)) + 0.5;
  ctx.strokeStyle = theme.text;
  ctx.lineWidth = 1;
  ctx.globalAlpha = hollow ? 0.16 : 0.25;
  ctx.beginPath();
  ctx.moveTo(x, insetTop);
  ctx.lineTo(x, insetTop + plotH);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = hollow ? theme.surface : colour;
  ctx.fill();
  ctx.strokeStyle = hollow ? colour : theme.surface;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** The days to mark, pinned first so a live hover draws over it. */
export function markedDays(f: Frame, i0: number, i1: number): [number, boolean][] {
  const on = (i: number | null): i is number => i !== null && i >= i0 && i <= i1;
  const out: [number, boolean][] = [];
  if (on(f.selected) && f.selected !== f.hover) out.push([f.selected, true]);
  if (on(f.hover)) out.push([f.hover, false]);
  return out;
}
