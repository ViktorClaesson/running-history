import { highestSlot } from '../../domain/verdict';
import { drawDayDot, drawXLabels, drawYGrid, drawYTitle, markedDays } from './axes';
import { bottomInset, INSET_TOP, type Frame } from './frame';
import { PAD, plotW, visibleRange, xMid } from './geometry';
import { drawWindowStarts, type Mark } from './marks';
import { niceTicks } from './ticks';

/**
 * Panels 2–4 and both stress panels: one measure over all four windows, a line each.
 * With `highlight` on, every line is laid down faded and then redrawn at full strength
 * along just the stretches where it is the highest of the *drawn* lines, which is the
 * same statement the verdict colour makes. See legacy/CLAUDE.md, "highlightMax".
 */
const FADED_ALPHA = 0.32;
/** Thick enough that the colour reads as its own hue, not as dark ink. */
const LINE_WIDTH = 2.2;

export interface WindowPanelInput {
  series: readonly Float64Array[];
  /** Which of the four lines are drawn. */
  visible: readonly boolean[];
  highlight: boolean;
  /** Run days per week: there is no eighth day, so the axis is fixed at 0–7. */
  fixed7: boolean;
  axisLabel: string;
  windowDays: readonly number[];
}

export function drawWindowPanel(f: Frame, d: WindowPanelInput): void {
  const plotH = f.height - INSET_TOP - bottomInset(f);
  const [i0, i1] = visibleRange(f.x, f.n);
  const drawn = [0, 1, 2, 3].filter((k) => d.visible[k]);
  // With every line hidden there's nothing to scale to, so the axis reads all four (and no line is drawn).
  const active = drawn.length ? drawn : [0, 1, 2, 3];
  const lead = (i: number) => highestSlot(d.series, i, active);

  let ticks: number[];
  let step: number;
  if (d.fixed7) [ticks, step] = [[0, 1, 2, 3, 4, 5, 6, 7], 1];
  else {
    let peak = 0;
    for (const k of active) for (let i = i0; i <= i1; i++) peak = Math.max(peak, d.series[k]![i]!);
    ({ ticks, step } = niceTicks(Math.max(peak * 1.12, 1)));
  }
  const yMax = ticks[ticks.length - 1]!;
  const yOf = (v: number) => INSET_TOP + plotH * (1 - v / yMax);
  drawYGrid(f, ticks, yOf, (t) => t.toFixed(step < 1 ? 1 : 0));
  drawYTitle(f, INSET_TOP, plotH, d.axisLabel);

  const { ctx, theme } = f;
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.l, INSET_TOP - 4, plotW(f.x), plotH + 8);
  ctx.clip();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Longest window first, so the spikiest (shortest) ends up on top.
  for (let k = 3; k >= 0; k--) {
    if (d.visible[k])
      strokeLine(f, d.series[k]!, theme.windows[k]!, d.highlight ? FADED_ALPHA : 1, i0, i1, yOf);
  }
  if (d.highlight)
    for (const k of drawn) strokeLead(f, d.series[k]!, theme.windows[k]!, k, lead, i0, i1, yOf);
  // One marker, on whichever line leads that day: the same line the highlight picks.
  if (drawn.length) {
    for (const [i, hollow] of markedDays(f, i0, i1)) {
      const k = lead(i);
      drawDayDot(f, i, yOf(d.series[k]![i]!), theme.windows[k]!, hollow, INSET_TOP, plotH);
    }
  }
  const marks: Mark[] = drawn.map((k) => ({
    days: d.windowDays[k]!,
    colour: theme.windows[k]!,
    slot: k,
    yAt: (st: number) => yOf(d.series[k]![st]!),
  }));
  drawWindowStarts(f, INSET_TOP, plotH, i0, i1, marks);
  ctx.restore();
  if (f.isBottom) drawXLabels(f, INSET_TOP, plotH, i0, i1);
}

function strokeLine(
  f: Frame,
  s: Float64Array,
  colour: string,
  alpha: number,
  i0: number,
  i1: number,
  yOf: (v: number) => number,
): void {
  const { ctx } = f;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    if (i === i0) ctx.moveTo(xMid(f.x, i), yOf(s[i]!));
    else ctx.lineTo(xMid(f.x, i), yOf(s[i]!));
  }
  ctx.strokeStyle = colour;
  ctx.lineWidth = LINE_WIDTH;
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * The stretches where window k leads, at full strength. Each reaches half a day past its
 * ends, to the midpoint of the handover, so the highlight passes from one line to the next
 * without a faded gap.
 */
function strokeLead(
  f: Frame,
  s: Float64Array,
  colour: string,
  k: number,
  lead: (i: number) => number,
  i0: number,
  i1: number,
  yOf: (v: number) => number,
): void {
  const { ctx } = f;
  const px = (i: number) => xMid(f.x, i);
  const midX = (a: number, b: number) => (px(a) + px(b)) / 2;
  const midY = (a: number, b: number) => (yOf(s[a]!) + yOf(s[b]!)) / 2;
  ctx.strokeStyle = colour;
  ctx.lineWidth = LINE_WIDTH;
  ctx.beginPath();
  let open = false;
  for (let i = i0; i <= i1; i++) {
    if (lead(i) !== k) {
      open = false;
      continue;
    }
    if (open) ctx.lineTo(px(i), yOf(s[i]!));
    else {
      if (i > i0) {
        ctx.moveTo(midX(i - 1, i), midY(i - 1, i));
        ctx.lineTo(px(i), yOf(s[i]!));
      } else ctx.moveTo(px(i), yOf(s[i]!));
      open = true;
    }
    if (i < i1 && lead(i + 1) !== k) ctx.lineTo(midX(i, i + 1), midY(i, i + 1));
  }
  ctx.stroke();
}
