import { N_BUCKETS } from '../../domain/paceZones';
import { drawDayDot, drawXLabels, drawYGrid, drawYTitle, markedDays } from './axes';
import { bottomInset, INSET_TOP, type Frame } from './frame';
import { PAD, plotW, visibleRange, xMid } from './geometry';
import { drawWindowStarts } from './marks';
import { niceTicks } from './ticks';

/**
 * One window's running stacked by pace zone, slowest at the bottom, so the hard running is
 * the band on top. In a share mode the bands are percentages of the day's total (a day with
 * nothing binned goes to zero rather than inventing a split). The top of the stack is also
 * drawn as a faint line, since the top band is usually a sliver.
 */
export interface ZoneAreaInput {
  bands: Float64Array[];
  total: Float64Array;
  pct: boolean;
  colours: string[];
  axisLabel: string;
  windowDays: number;
  windowColour: string;
}

export function drawZoneArea(f: Frame, d: ZoneAreaInput): void {
  const plotH = f.height - INSET_TOP - bottomInset(f);
  const [i0, i1] = visibleRange(f.x, f.n);
  const valAt = (b: number, i: number) =>
    d.pct ? (d.total[i]! > 0 ? (d.bands[b]![i]! / d.total[i]!) * 100 : 0) : d.bands[b]![i]!;
  let ticks: number[];
  let step: number;
  if (d.pct) [ticks, step] = [[0, 25, 50, 75, 100], 25];
  else {
    let peak = 0;
    for (let i = i0; i <= i1; i++) peak = Math.max(peak, d.total[i]!);
    ({ ticks, step } = niceTicks(Math.max(peak * 1.12, 1)));
  }
  const yMax = ticks[ticks.length - 1]!;
  const yOf = (v: number) => INSET_TOP + plotH * (1 - v / yMax);
  drawYGrid(f, ticks, yOf, (t) => t.toFixed(step < 1 ? 1 : 0));
  drawYTitle(f, INSET_TOP, plotH, d.axisLabel);

  const { ctx, theme } = f;
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.l, INSET_TOP, plotW(f.x), plotH);
  ctx.clip();
  const below = new Float64Array(i1 - i0 + 1);
  for (let b = 0; b < N_BUCKETS; b++) {
    ctx.beginPath();
    for (let i = i0; i <= i1; i++) ctx.lineTo(xMid(f.x, i), yOf(below[i - i0]! + valAt(b, i)));
    for (let i = i1; i >= i0; i--) ctx.lineTo(xMid(f.x, i), yOf(below[i - i0]!));
    ctx.closePath();
    ctx.fillStyle = d.colours[b]!;
    ctx.fill();
    for (let i = i0; i <= i1; i++) below[i - i0] += valAt(b, i);
  }
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    if (i === i0) ctx.moveTo(xMid(f.x, i), yOf(below[0]!));
    else ctx.lineTo(xMid(f.x, i), yOf(below[i - i0]!));
  }
  ctx.strokeStyle = theme.text;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (const [i, hollow] of markedDays(f, i0, i1)) {
    drawDayDot(f, i, yOf(below[i - i0]!), d.windowColour, hollow, INSET_TOP, plotH);
  }
  drawWindowStarts(f, INSET_TOP, plotH, i0, i1, [
    {
      days: d.windowDays,
      colour: d.windowColour,
      slot: 0,
      yAt: (st) => (st >= i0 && st <= i1 ? yOf(below[st - i0]!) : null),
    },
  ]);
  ctx.restore();
  if (f.isBottom) drawXLabels(f, INSET_TOP, plotH, i0, i1);
}
