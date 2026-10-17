import { binCount, ZONE_BIN_OFFSET, ZONES } from '../../domain/paceZones';
import { leadColours, zoneRamps } from './ramps';
import type { Theme } from './theme';
import { FONT } from './theme';
import { niceTicks } from './ticks';

/**
 * One run's pace-zone histogram: Standing, Walking, Recovery, then every zone's sub-bands,
 * slowest left. The eight buckets tile one pace axis, so there is no gap between the slow
 * three and the zones, just the same divider every zone edge gets.
 */
const PAD = { l: 40, r: 10, t: 10, b: 22 } as const;

export interface HistogramInput {
  /** What the bars are drawn at (minutes or km per bin). */
  values: Float64Array;
  zoneBars: number;
  /** Shared across a day's runs so their bars compare directly. */
  maxVal: number;
  axisLabel: string;
  hoverBin: number | null;
}

export function drawZoneHistogram(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: Theme,
  d: HistogramInput,
): void {
  const pw = w - PAD.l - PAD.r;
  const ph = h - PAD.t - PAD.b;
  const { ticks, step } = niceTicks(d.maxVal * 1.12);
  const yMax = ticks[ticks.length - 1]!;
  const yOf = (v: number) => PAD.t + ph * (1 - v / yMax);
  const slots = binCount(d.zoneBars);
  const bw = pw / slots;
  const xOf = (slot: number) => PAD.l + slot * bw;

  ctx.clearRect(0, 0, w, h);
  ctx.font = FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of ticks) {
    const y = Math.round(yOf(t)) + 0.5;
    ctx.strokeStyle = t === 0 ? theme.baseline : theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(w - PAD.r, y);
    ctx.stroke();
    ctx.fillStyle = theme.muted;
    ctx.fillText(t.toFixed(Number.isInteger(step) ? 0 : 1), PAD.l - 8, y);
  }
  ctx.save();
  ctx.translate(13, PAD.t + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(d.axisLabel, 0, 0);
  ctx.restore();

  const colours = binColours(theme, d.zoneBars);
  for (let b = 0; b < slots; b++) {
    const x0 = Math.round(xOf(b));
    const x1 = Math.round(xOf(b + 1));
    const y = yOf(d.values[b]!);
    ctx.fillStyle = colours[b]!;
    ctx.fillRect(x0, y, Math.max(1, x1 - x0 - 1), PAD.t + ph - y);
    if (b === d.hoverBin) {
      ctx.strokeStyle = theme.text;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0 + 0.75, PAD.t, Math.max(1, x1 - x0 - 1.5), ph);
    }
  }
  // A divider at each zone edge (the first is the Recovery/Endurance handover), the zone's
  // name centred under its own bars. The three slow bars are too narrow for a label.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let z = 0; z < ZONES.length; z++) {
    const x = Math.round(xOf(ZONE_BIN_OFFSET + z * d.zoneBars)) + 0.5;
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, PAD.t);
    ctx.lineTo(x, PAD.t + ph);
    ctx.stroke();
    ctx.fillStyle = theme.muted;
    ctx.fillText(ZONES[z]!.label, xOf(ZONE_BIN_OFFSET + (z + 0.5) * d.zoneBars), PAD.t + ph + 6);
  }
}

/** Every bin's colour: the three neutrals, then each zone's weak → strong ramp. */
export function binColours(theme: Theme, zoneBars: number): string[] {
  const lead = leadColours(theme);
  return [lead.standing, lead.walking, lead.recovery, ...zoneRamps(theme, zoneBars).flat()];
}

/** The bin under pixel x, or null outside the bars. */
export function binAt(px: number, w: number, zoneBars: number): number | null {
  const slots = binCount(zoneBars);
  const slot = Math.floor(((px - PAD.l) / (w - PAD.l - PAD.r)) * slots);
  return slot >= 0 && slot < slots ? slot : null;
}
