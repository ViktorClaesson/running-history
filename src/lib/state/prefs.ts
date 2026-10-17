import { SLOT_KEYS, type SlotKey } from '../domain/windows';
import type { Plan } from '../domain/weeklyTarget';

/**
 * Every display setting, remembered in localStorage under the legacy key and format, so
 * the page opens the way it was left (legacy/CLAUDE.md, "Remembered settings"). Three
 * rules carry over:
 * - validated field by field on load, against the same limits as the controls, so a stale
 *   or hand-edited entry can only produce a state the UI can reach;
 * - anything invalid falls back to the default *for that field alone*;
 * - written only when something is off-default; removed when everything is back to default.
 */

export type BarScale = 'log' | 'linear';
export type BarColour = 'verdict' | 'workout' | 'none';
export type ZoneAxis = 'time' | 'dist';
export type ZoneAreaMode = 'km' | 'min' | 'pctKm' | 'pctMin';
export type PanelKey =
  'vol' | 'freq' | 'runs' | 'sraw' | 'srel' | 'vdot' | 'zone' | 'zarea' | 'table' | 'target';
export const PANEL_KEYS: readonly PanelKey[] = [
  'vol',
  'freq',
  'runs',
  'sraw',
  'srel',
  'vdot',
  'zone',
  'zarea',
  'table',
  'target',
];

/** The remembered zoom: days in view, and the right edge in days since 1970 (null = at the newest day). */
export interface SavedView {
  span: number;
  right: number | null;
}

export interface Prefs {
  windowBase: number;
  windowMult: number;
  /** VDOT window in days (whole weeks): the legacy unit, kept for compatibility. */
  windowVdot: number;
  minLapM: number;
  vdotCorr: number;
  gapVdot: boolean;
  gapPace: boolean;
  vdotNearDots: boolean;
  vdotNearPct: number;
  barScale: BarScale;
  barCap: boolean;
  barCapKm: number;
  barColour: BarColour;
  wtExp: number;
  wtShare: number;
  zoneBars: number;
  zoneAxis: ZoneAxis;
  panels: Record<PanelKey, boolean>;
  zoneAreaWin: SlotKey;
  zoneAreaMode: ZoneAreaMode;
  lines: Record<SlotKey, boolean>;
  highlightMax: boolean;
  plan: Plan | null;
  targetLong: boolean;
  targetLongW: number;
  targetWin: SlotKey;
  view: SavedView | null;
}

export const PREFS_KEY = 'runviz.prefs.v1';

export const PREF_DEFAULTS: Readonly<Prefs> = Object.freeze({
  windowBase: 1,
  windowMult: 4,
  windowVdot: 350, // 50 weeks
  minLapM: 1500,
  vdotCorr: 0.98,
  gapVdot: false,
  gapPace: true,
  vdotNearDots: true,
  vdotNearPct: 5,
  barScale: 'linear',
  barCap: true,
  barCapKm: 45,
  barColour: 'workout',
  wtExp: 2,
  wtShare: 35,
  zoneBars: 3,
  zoneAxis: 'dist',
  panels: {
    vol: true,
    freq: false,
    runs: true,
    sraw: true,
    srel: false,
    vdot: true,
    zone: true,
    zarea: true,
    table: true,
    target: true,
  },
  zoneAreaWin: 's1',
  zoneAreaMode: 'pctKm',
  lines: { s0: true, s1: true, s2: true, s3: true },
  highlightMax: true,
  plan: null,
  targetLong: true,
  targetLongW: 2,
  targetWin: 's2',
  view: null,
});

/**
 * A phone starts with fewer panels: the bars, distance per week, VDOT, the zone volume and
 * the histogram. Every one can be brought back in the settings.
 */
export const PHONE_PANELS: Readonly<Record<PanelKey, boolean>> = Object.freeze({
  vol: true,
  freq: false,
  runs: false,
  sraw: false,
  srel: false,
  vdot: true,
  zone: true,
  zarea: true,
  table: false,
  target: false,
});

/** A fresh, mutable copy of the defaults (the phone's, when `phone`). */
export function defaultPrefs(phone = false): Prefs {
  const panels = phone ? PHONE_PANELS : PREF_DEFAULTS.panels;
  return { ...PREF_DEFAULTS, panels: { ...panels }, lines: { ...PREF_DEFAULTS.lines } };
}

const inRange = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T =>
  typeof v === 'string' && (options as readonly string[]).includes(v);
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

export function parsePrefs(raw: unknown, phone = false): Prefs {
  const p = defaultPrefs(phone);
  if (typeof raw !== 'object' || raw === null) return p;
  const r = raw as Record<string, unknown>;
  parseNumbers(r, p);
  parseChoices(r, p);
  parseBooleans(r, p);
  parseToggles(r, p);
  p.view = parseView(r.view);
  p.plan = parsePlan(r.plan);
  return p;
}

function parseNumbers(r: Record<string, unknown>, p: Prefs): void {
  if (inRange(r.windowBase, 1, 8)) p.windowBase = Math.round(r.windowBase);
  if (inRange(r.windowMult, 2, 8)) p.windowMult = Math.round(r.windowMult);
  // Whole weeks, 1–260 of them; legacy stored days.
  if (inRange(r.windowVdot, 7, 1820)) p.windowVdot = Math.min(1820, Math.max(7, roundTo(r.windowVdot, 7)));
  if (inRange(r.minLapM, 100, 5000)) p.minLapM = roundTo(r.minLapM, 100);
  if (inRange(r.vdotCorr, 0.9, 1)) p.vdotCorr = Math.round(r.vdotCorr * 100) / 100;
  if (inRange(r.zoneBars, 1, 20)) p.zoneBars = Math.round(r.zoneBars);
  if (inRange(r.vdotNearPct, 0, 100)) p.vdotNearPct = Math.round(r.vdotNearPct);
  if (inRange(r.barCapKm, 1, 500)) p.barCapKm = Math.round(r.barCapKm);
  if (inRange(r.wtExp, 0, 4)) p.wtExp = roundTo(r.wtExp, 0.5);
  if (inRange(r.wtShare, 1, 100)) p.wtShare = Math.round(r.wtShare);
  if (inRange(r.targetLongW, 1, 3)) p.targetLongW = Math.round(r.targetLongW * 10) / 10;
}

function parseChoices(r: Record<string, unknown>, p: Prefs): void {
  if (oneOf(r.zoneAxis, ['time', 'dist'] as const)) p.zoneAxis = r.zoneAxis;
  if (oneOf(r.barScale, ['log', 'linear'] as const)) p.barScale = r.barScale;
  // `colourVerdicts: false` was the old on/off for colouring at all: 'none' now.
  if (r.colourVerdicts === false) p.barColour = 'none';
  if (oneOf(r.barColour, ['verdict', 'workout', 'none'] as const)) p.barColour = r.barColour;
  if (oneOf(r.zoneAreaWin, SLOT_KEYS)) p.zoneAreaWin = r.zoneAreaWin;
  if (oneOf(r.targetWin, SLOT_KEYS)) p.targetWin = r.targetWin;
  if (oneOf(r.zoneAreaMode, ['km', 'min', 'pctKm', 'pctMin'] as const)) p.zoneAreaMode = r.zoneAreaMode;
}

function parseBooleans(r: Record<string, unknown>, p: Prefs): void {
  // `useGap` was one toggle for both before VDOT and the histogram got one each.
  if (typeof r.useGap === 'boolean') p.gapVdot = p.gapPace = r.useGap;
  for (const k of ['highlightMax', 'gapVdot', 'gapPace', 'vdotNearDots', 'barCap', 'targetLong'] as const) {
    const v = r[k];
    if (typeof v === 'boolean') p[k] = v;
  }
}

function parseToggles(r: Record<string, unknown>, p: Prefs): void {
  const panels = r.panels;
  if (typeof panels === 'object' && panels !== null) {
    for (const k of PANEL_KEYS) {
      const v = (panels as Record<string, unknown>)[k];
      if (typeof v === 'boolean') p.panels[k] = v;
    }
  }
  const lines = r.lines;
  if (typeof lines === 'object' && lines !== null) {
    for (const k of SLOT_KEYS) {
      const v = (lines as Record<string, unknown>)[k];
      if (typeof v === 'boolean') p.lines[k] = v;
    }
  }
}

function parseView(v: unknown): SavedView | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!inRange(o.span, 5, 1e6)) return null;
  if (o.right !== null && !(typeof o.right === 'number' && Number.isFinite(o.right))) return null;
  return { span: o.span, right: o.right };
}

/** Days and runs are whole numbers; an entry from before runs/wk existed gets one run a day. */
function parsePlan(v: unknown): Plan | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!inRange(o.km, 0, 700) || !inRange(o.days, 0, 7)) return null;
  const days = Math.round(o.days);
  const runs = inRange(o.runs, 0, 19) ? Math.max(Math.round(o.runs), days) : days;
  return { km: o.km, days, runs };
}

/** True when nothing differs from the defaults (then nothing should be stored at all). */
export function isDefault(p: Prefs, phone = false): boolean {
  const panels = phone ? PHONE_PANELS : PREF_DEFAULTS.panels;
  return (Object.keys(PREF_DEFAULTS) as (keyof Prefs)[]).every((k) => {
    if (k === 'panels') return PANEL_KEYS.every((pk) => p.panels[pk] === panels[pk]);
    if (k === 'lines') return SLOT_KEYS.every((lk) => p.lines[lk] === PREF_DEFAULTS.lines[lk]);
    if (k === 'plan' || k === 'view') return p[k] === null;
    return p[k] === PREF_DEFAULTS[k];
  });
}

export function loadPrefs(storage: Storage = localStorage, phone = false): Prefs {
  try {
    return parsePrefs(JSON.parse(storage.getItem(PREFS_KEY) ?? 'null'), phone);
  } catch {
    return defaultPrefs(phone);
  }
}

/** Writes the whole entry, or removes it when everything is back to default. */
export function savePrefs(p: Prefs, storage: Storage = localStorage, phone = false): void {
  try {
    if (isDefault(p, phone)) storage.removeItem(PREFS_KEY);
    else storage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Private browsing can refuse storage: the settings just aren't remembered.
  }
}
