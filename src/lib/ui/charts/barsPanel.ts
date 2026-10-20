import { whenDone } from '../../exercise';
import type { BarScale } from '../../state/prefs';
import { drawXLabels } from './axes';
import { bottomInset, type Frame } from './frame';
import { barW, PAD, plotW, visibleRange, xOf } from './geometry';
import { drawWindowStarts, type Mark } from './marks';
import { FONT } from './theme';
import { logDown, logTicks, logTickText, logUp, niceTicks } from './ticks';

/**
 * Panel 1: each day's own distance. Linear by default, log optional. Zero has no place on a
 * log axis and an empty day is nothing to aim at, so the axis floor sits under the data:
 * real runs are never drawn shorter than MIN_RUN_H, and a rest day gets a shorter grey stub
 * you can still hover and click. See legacy/CLAUDE.md, "The bar panel's axis".
 */
export const REST_STUB = 5;
export const MIN_RUN_H = 11;
const TOP = 14;

export interface BarSegment {
  frac: number;
  colour: string;
}

export interface BarsInput {
  km: Float64Array;
  /** The day's bar split per run, earliest at the bottom. */
  segments: (i: number) => BarSegment[];
  scale: BarScale;
  /** Days longer than this are drawn at it, marked as cut. null = no cap. Draw-time only. */
  capKm: number | null;
  marks: Mark[];
}

/** The bar panel's y-axis for the days in view. */
export interface BarAxis {
  /** Distance (km) → canvas y (pixels, growing downwards). */
  yOf: (v: number) => number;
  /** Gridline values, km, bottom to top. */
  ticks: number[];
  /** The value at the top of the plot. */
  top: number;
  /** The axis stops at the cap (its top tick is labelled "45+"). */
  capped: boolean;
  /** Linear tick step (decides the label decimals); 1 on log. */
  step: number;
}

export function drawBars(f: Frame, d: BarsInput): void {
  const plotH = f.height - TOP - bottomInset(f);
  const base = TOP + plotH;
  const [i0, i1] = visibleRange(f.x, f.n);
  const isCut = (i: number) => d.capKm !== null && d.km[i]! > d.capKm;
  let note = '';
  const axis = whenDone(
    () => barYAxis(d, i0, i1, plotH, base),
    (e) => {
      note = `${e.message} (a plain linear axis for now)`;
      return plainBarAxis(d, i0, i1, plotH, base);
    },
  );
  // Every height goes through here: a rest day is a stub, never log(0).
  const topOf = (i: number) =>
    d.km[i]! > 0 ? Math.min(axis.yOf(shownKm(d, i)), base - MIN_RUN_H) : base - REST_STUB;

  drawGrid(f, axis, d.scale, base);
  const { ctx } = f;
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.l, TOP, plotW(f.x), plotH);
  ctx.clip();
  for (let i = i0; i <= i1; i++) drawDay(f, i, topOf(i), base, d.segments(i), isCut(i));
  const outline = (i: number, dashed: boolean) => drawOutline(f, i, topOf(i), base, dashed);
  if (f.selected !== null && f.selected >= i0 && f.selected <= i1 && f.selected !== f.hover)
    outline(f.selected, true);
  if (f.hover !== null && f.hover >= i0 && f.hover <= i1) outline(f.hover, false);
  // Dashed lines only, no dots: a window isn't a series here, a dot would float.
  drawWindowStarts(f, TOP, plotH, i0, i1, d.marks, false);
  ctx.restore();
  if (note) drawNote(f, note);
  if (f.isBottom) drawXLabels(f, TOP, plotH, i0, i1);
}

/** A day's distance as drawn: cut off at the cap, when there is one. */
const shownKm = (d: Pick<BarsInput, 'km' | 'capKm'>, i: number): number =>
  d.capKm !== null ? Math.min(d.km[i]!, d.capKm) : d.km[i]!;

/**
 * The y-axis for days i0…i1, on a plot `plotH` pixels tall whose floor is at y = `base`.
 * Linear: 0 on the floor, niceTicks up to the tallest bar. Log: from a 1/2/5 value under
 * the shortest bar to one over the tallest, at least a decade, with that bottom value
 * MIN_RUN_H above the floor so even the shortest run is a visible bar. Either way the axis
 * stops at the cap when the cap is on and something reaches it. Rest days don't count.
 */
export function barYAxis(
  d: Pick<BarsInput, 'km' | 'scale' | 'capKm'>,
  i0: number,
  i1: number,
  plotH: number,
  base: number,
): BarAxis {
  const shown = (i: number) => shownKm(d, i);
  const isCut = (i: number) => d.capKm !== null && d.km[i]! > d.capKm;
  let vMax = 0;
  let vMin = Infinity;
  let anyCut = false;
  for (let i = i0; i <= i1; i++) {
    if (!(d.km[i]! > 0)) continue;
    vMax = Math.max(vMax, shown(i));
    vMin = Math.min(vMin, shown(i));
    anyCut ||= isCut(i);
  }
  if (!(vMax > 0)) [vMin, vMax] = [1, 10]; // nothing in view: a plausible empty axis
  // The axis stops at the cap whenever it would otherwise reach past it (a cut run, or
  // rounding 42 km up to 50), so it never rounds out to a height no bar can reach.
  const capAt = (top: number) => (d.capKm !== null && (anyCut || top > d.capKm) ? d.capKm : null);
  let axis: BarAxis;
  if (d.scale === 'log') {
    const cap = capAt(logUp(vMax));
    const top = cap ?? logUp(vMax);
    const lo = Math.min(logDown(vMin), logUp(vMax) / 10); // at least a decade of range
    const [L0, L1] = [Math.log(lo), Math.log(top)];
    const usable = plotH - MIN_RUN_H;
    axis = {
      yOf: (v) => base - MIN_RUN_H - (usable * (Math.log(v) - L0)) / (L1 - L0),
      ticks: logTicks(lo, top),
      top,
      capped: cap !== null,
      step: 1,
    };
  } else {
    const nice = niceTicks(vMax);
    const cap = capAt(nice.ticks[nice.ticks.length - 1]!);
    const top = cap ?? nice.ticks[nice.ticks.length - 1]!;
    axis = {
      yOf: (v) => base - (plotH * v) / top,
      ticks: nice.ticks.filter((t) => t > 0),
      top,
      capped: cap !== null,
      step: nice.step,
    };
  }
  if (axis.capped)
    axis.ticks = [
      ...axis.ticks.filter((t) => t < axis.top * 0.9999 && base - axis.yOf(t) < plotH - 12),
      axis.top,
    ];
  return axis;
}

/** Until exercise E30 (or E29, the ticks it uses) is done: 0 to the tallest bar, no gridlines. */
function plainBarAxis(
  d: Pick<BarsInput, 'km' | 'capKm'>,
  i0: number,
  i1: number,
  plotH: number,
  base: number,
): BarAxis {
  let top = 0;
  for (let i = i0; i <= i1; i++) top = Math.max(top, shownKm(d, i));
  if (!(top > 0)) top = 10;
  return { yOf: (v) => base - (plotH * v) / top, ticks: [], top, capped: false, step: 1 };
}

function drawNote(f: Frame, text: string): void {
  const { ctx, theme } = f;
  ctx.font = FONT;
  ctx.fillStyle = theme.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, PAD.l + 24, TOP); // clear of the window chevrons at the left edge
}

function drawGrid(f: Frame, axis: BarAxis, scale: BarScale, base: number): void {
  const { ctx, theme } = f;
  ctx.font = FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of axis.ticks) {
    const y = Math.round(axis.yOf(t)) + 0.5;
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(f.width - PAD.r, y);
    ctx.stroke();
    ctx.fillStyle = theme.muted;
    const cut = axis.capped && t === axis.top;
    const txt =
      scale === 'log'
        ? logTickText(t)
        : cut
          ? String(+t.toFixed(1))
          : t.toFixed(Number.isInteger(axis.step) ? 0 : 1);
    ctx.fillText(cut ? `${txt}+` : txt, PAD.l - 8, y);
  }
  // The floor the stubs stand on: not a zero line on log (there isn't one), unlabelled either way.
  const y = Math.round(base) + 0.5;
  ctx.strokeStyle = theme.baseline;
  ctx.beginPath();
  ctx.moveTo(PAD.l, y);
  ctx.lineTo(f.width - PAD.r, y);
  ctx.stroke();
  ctx.save();
  ctx.translate(13, TOP + (base - TOP) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(scale === 'log' ? 'km (log)' : 'km', 0, 0);
  ctx.restore();
}

/**
 * One day's bar, butting up against its neighbours at any zoom: each runs from its own day
 * boundary to the next, both pixel-snapped, so neighbours share an edge exactly. A day with
 * several runs keeps the day's height and is split by each run's share of the distance,
 * with a surface-coloured seam at each join.
 */
function drawDay(f: Frame, i: number, y: number, base: number, segs: BarSegment[], cut: boolean): void {
  const { ctx, theme } = f;
  const x0 = Math.round(xOf(f.x, i));
  const bw = Math.max(1, Math.round(xOf(f.x, i + 1)) - x0);
  const hh = base - y;
  if (hh <= 0) return;
  let yb = base;
  segs.forEach((sg, k) => {
    const top = k === segs.length - 1 ? y : Math.round(yb - hh * sg.frac);
    ctx.fillStyle = sg.colour;
    ctx.fillRect(x0, top, bw, yb - top);
    if (k > 0) {
      ctx.fillStyle = theme.surface;
      ctx.fillRect(x0, yb - 1, bw, 1);
    }
    yb = top;
  });
  // A run cut off at the cap gets a break across its top, like an axis break.
  if (cut && hh > 14) {
    ctx.fillStyle = theme.surface;
    ctx.fillRect(x0, y + 4, bw, 1.5);
    ctx.fillRect(x0, y + 7.5, bw, 1.5);
  }
}

/** Hover is a solid outline, the pin a dashed one, so both can be on screen and read apart. */
function drawOutline(f: Frame, i: number, y: number, base: number, dashed: boolean): void {
  const { ctx, theme } = f;
  const x0 = Math.round(xOf(f.x, i));
  const bw = Math.max(1, Math.round(xOf(f.x, i + 1)) - x0);
  ctx.strokeStyle = theme.text;
  ctx.lineWidth = 1;
  ctx.globalAlpha = dashed ? 0.16 : 0.25;
  ctx.beginPath();
  ctx.moveTo(x0 + bw / 2 + 0.5, TOP);
  ctx.lineTo(x0 + bw / 2 + 0.5, base);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  if (dashed) ctx.setLineDash([3, 2]);
  ctx.strokeRect(x0 - 0.25, y - 1, bw + 0.5, base - y + 1);
  ctx.setLineDash([]);
}

/** The bar width, for callers deciding whether a bar is too thin to bother outlining. */
export const dayWidth = barW;
