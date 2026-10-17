import { isNearMax } from '../../domain/vdot';
import { drawDayDot, drawXLabels, drawYGrid, drawYTitle, markedDays } from './axes';
import { bottomInset, INSET_TOP, type Frame } from './frame';
import { PAD, plotW, visibleRange, xMid } from './geometry';
import { drawWindowStarts } from './marks';
import { niceTicks } from './ticks';

/**
 * The rolling-max VDOT line (a gap, not a zero, before the first run), with dots for the
 * days that came within `nearPct`% of the peak in force that day, drawn at the day's own
 * value, and a dashed line at the cut-off. See legacy/CLAUDE.md, "Near-max days".
 */
export interface VdotInput {
  vdot: readonly (number | null)[];
  dayValue: Float64Array;
  nearDots: boolean;
  nearPct: number;
  windowDays: number;
}

/** Returns whether the dashed cut-off ended up on screen (the panel title mentions it only then). */
export function drawVdot(f: Frame, d: VdotInput): { dashSeen: boolean } {
  const plotH = f.height - INSET_TOP - bottomInset(f);
  const [i0, i1] = visibleRange(f.x, f.n);
  const near = (i: number) => d.nearDots && isNearMax(d.dayValue[i]!, d.vdot[i] ?? null, d.nearPct);
  let yMax = 0;
  let yMin = Infinity;
  for (let i = i0; i <= i1; i++) {
    const v = d.vdot[i];
    if (v == null) continue;
    yMax = Math.max(yMax, v);
    yMin = Math.min(yMin, v);
  }
  // The dots sit below the line, so they must be inside the extent; only the floor can move.
  for (let i = i0; i <= i1; i++) if (near(i)) yMin = Math.min(yMin, d.dayValue[i]!);
  if (!(yMax > 0)) [yMin, yMax] = [0, 1];
  const { ticks, step } = niceTicks(Math.max(yMax * 1.06, 1));
  const top = ticks[ticks.length - 1]!;
  const floor = Math.max(0, Math.floor((yMin * 0.94) / step) * step);
  const yOf = (v: number) => INSET_TOP + plotH * (1 - (v - floor) / (top - floor || 1));
  const { ctx, theme } = f;

  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.l, INSET_TOP - 4, plotW(f.x), plotH + 8);
  ctx.clip();
  fillUnder(f, d.vdot, i0, i1, yOf, INSET_TOP + plotH);
  ctx.restore();
  drawYGrid(
    f,
    ticks.filter((t) => t >= floor),
    yOf,
    (t) => t.toFixed(0),
  );
  drawYTitle(f, INSET_TOP, plotH, 'VDOT');

  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.l, INSET_TOP - 4, plotW(f.x), plotH + 8);
  ctx.clip();
  strokeGappy(f, (i) => d.vdot[i] ?? null, i0, i1, yOf);
  ctx.strokeStyle = theme.vdot;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  const dashSeen = d.nearDots && d.nearPct > 0 ? drawCutoff(f, d, i0, i1, yOf, plotH) : false;
  if (d.nearDots) drawNearDots(f, d, near, i0, i1, yOf);
  for (const [i, hollow] of markedDays(f, i0, i1)) {
    const v = d.vdot[i];
    if (v != null) drawDayDot(f, i, yOf(v), theme.vdot, hollow, INSET_TOP, plotH);
  }
  // Its window is its own, so one mark in its own colour.
  drawWindowStarts(f, INSET_TOP, plotH, i0, i1, [
    {
      days: d.windowDays,
      colour: theme.vdot,
      slot: 0,
      yAt: (st) => (d.vdot[st] == null ? null : yOf(d.vdot[st]!)),
    },
  ]);
  ctx.restore();
  if (f.isBottom) drawXLabels(f, INSET_TOP, plotH, i0, i1);
  return { dashSeen };
}

function strokeGappy(
  f: Frame,
  at: (i: number) => number | null,
  i0: number,
  i1: number,
  yOf: (v: number) => number,
) {
  const { ctx } = f;
  ctx.beginPath();
  let on = false;
  for (let i = i0; i <= i1; i++) {
    const v = at(i);
    if (v === null) {
      on = false;
      continue;
    }
    if (on) ctx.lineTo(xMid(f.x, i), yOf(v));
    else ctx.moveTo(xMid(f.x, i), yOf(v));
    on = true;
  }
}

function fillUnder(
  f: Frame,
  vdot: readonly (number | null)[],
  i0: number,
  i1: number,
  yOf: (v: number) => number,
  floorY: number,
) {
  const { ctx, theme } = f;
  let start = -1;
  const close = (end: number) => {
    ctx.lineTo(xMid(f.x, end), floorY);
    ctx.closePath();
    ctx.fillStyle = theme.vdot;
    ctx.globalAlpha = 0.1;
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  for (let i = i0; i <= i1; i++) {
    const v = vdot[i];
    if (v == null) {
      if (start >= 0) close(i - 1);
      start = -1;
      continue;
    }
    if (start < 0) {
      ctx.beginPath();
      ctx.moveTo(xMid(f.x, i), floorY);
      start = i;
    }
    ctx.lineTo(xMid(f.x, i), yOf(v));
  }
  if (start >= 0) close(i1);
}

/** The cut-off: the peak scaled down by nearPct. Never folded into the extent, so it may clip. */
function drawCutoff(
  f: Frame,
  d: VdotInput,
  i0: number,
  i1: number,
  yOf: (v: number) => number,
  plotH: number,
): boolean {
  const { ctx, theme } = f;
  let seen = false;
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = theme.vdot;
  ctx.globalAlpha = 0.55;
  strokeGappy(
    f,
    (i) => {
      const v = d.vdot[i];
      if (v == null) return null;
      const y = yOf(v * (1 - d.nearPct / 100));
      if (y >= INSET_TOP && y <= INSET_TOP + plotH) seen = true;
      return v * (1 - d.nearPct / 100);
    },
    i0,
    i1,
    yOf,
  );
  ctx.stroke();
  ctx.restore();
  return seen;
}

/** Dot size follows the crowding (2.75 → 1.2 px), not the zoom; the ring goes when there is no room for it. */
function drawNearDots(
  f: Frame,
  d: VdotInput,
  near: (i: number) => boolean,
  i0: number,
  i1: number,
  yOf: (v: number) => number,
) {
  const { ctx, theme } = f;
  let n = 0;
  for (let i = i0; i <= i1; i++) if (near(i)) n++;
  const r = Math.max(1.2, Math.min(2.75, (n > 1 ? plotW(f.x) / n : Infinity) * 0.3));
  ctx.lineWidth = 1;
  ctx.strokeStyle = theme.surface;
  ctx.fillStyle = theme.vdot;
  for (let i = i0; i <= i1; i++) {
    if (!near(i)) continue;
    ctx.beginPath();
    ctx.arc(xMid(f.x, i), yOf(d.dayValue[i]!), r, 0, Math.PI * 2);
    ctx.fill();
    if (r >= 2.2) ctx.stroke();
  }
}
