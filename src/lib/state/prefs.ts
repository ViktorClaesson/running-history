import { rethrowIfNotDone, todo } from '../exercise';
import type { SlotKey } from '../domain/windows';
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
  /** Chunks are at least this many timer seconds (0 = every sample on its own). */
  chunkSec: number;
  /** GAP strength: Minetti's cost curve to this power (1 = pure Minetti). */
  gapExp: number;
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
  // About 30 m at running pace: averages out GPS jitter, short enough to keep a 30 s rep's shape.
  chunkSec: 10,
  // Fits Garmin's per-lap GAP best (docs/intervals-api-findings.md); Runalyze uses 0.83.
  gapExp: 0.5,
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

/** A finite number in [lo, hi]. */
export const inRange = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
/** One of the allowed strings. */
export const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T =>
  typeof v === 'string' && (options as readonly string[]).includes(v);
/** The nearest multiple of `step`. */
export const roundTo = (v: number, step: number): number => Math.round(v / step) * step;

/*
 * TODO(E26) · settings validation · difficulty ★★☆ · phase 4
 *   parsePrefs(raw, phone)
 *     Start from defaultPrefs(phone) and take each field from `raw` only if it is valid; an
 *     invalid field falls back to its default *alone*. raw that isn't an object → all defaults.
 *     Numbers (inRange, then rounded to what the control produces):
 *       windowBase 1–8 whole · windowMult 2–8 whole · windowVdot 7–1820, whole weeks (roundTo 7)
 *       minLapM 100–5000 step 100 · vdotCorr 0.9–1 step 0.01 · zoneBars 1–20 whole
 *       chunkSec 0–60 whole · gapExp 0.3–1 step 0.05 · vdotNearPct 0–100 whole
 *       barCapKm 1–500 whole · wtExp 0–4 step 0.5 · wtShare 1–100 whole · targetLongW 1–3 step 0.1
 *     Choices (oneOf): zoneAxis time|dist · barScale log|linear · barColour verdict|workout|none
 *       zoneAreaWin, targetWin a SLOT_KEY · zoneAreaMode km|min|pctKm|pctMin
 *     Booleans: highlightMax, gapVdot, gapPace, vdotNearDots, barCap, targetLong
 *     Toggles: panels[k] for each PANEL_KEYS, lines[k] for each SLOT_KEYS, when boolean
 *     view: {span 5–1e6, right: null or a finite number}, else null
 *     plan: {km 0–700, days 0–7 (rounded), runs 0–19 (rounded, at least days; missing → days)}, else null
 *     Legacy fields still read: useGap (boolean) sets both gapVdot and gapPace;
 *       colourVerdicts === false means barColour 'none' (a valid barColour still wins).
 *   isDefault(p, phone)
 *     True when nothing differs from the defaults (the phone's panels when phone): compare every
 *     key of PREF_DEFAULTS; panels and lines field by field; plan and view must be null.
 * Edge cases that matter, and why:
 * - A stale or hand-edited entry can only produce a state the controls could reach.
 * - savePrefs removes the stored entry when isDefault: "Reset" leaves nothing behind.
 * Background: legacy/CLAUDE.md, "Remembered settings".
 * Concepts:
 * - localStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
 * - type guards (`v is number`): https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
 * Check: npm run exercise E26 (tests/state/prefs.test.ts). In the app settings are remembered
 * across reloads again (until now they started from the defaults every time).
 * Spoiler: `loadPrefs()` in legacy/running-history.html.
 */
export function parsePrefs(raw: unknown, phone = false): Prefs {
  return todo('E26', raw, phone);
}

/** True when nothing differs from the defaults (then nothing should be stored at all). */
export function isDefault(p: Prefs, phone = false): boolean {
  return todo('E26', p, phone);
}

export function loadPrefs(storage: Storage = localStorage, phone = false): Prefs {
  try {
    return parsePrefs(JSON.parse(storage.getItem(PREFS_KEY) ?? 'null'), phone);
  } catch (e) {
    rethrowIfNotDone(e);
    return defaultPrefs(phone);
  }
}

/** Writes the whole entry, or removes it when everything is back to default. */
export function savePrefs(p: Prefs, storage: Storage = localStorage, phone = false): void {
  try {
    if (isDefault(p, phone)) storage.removeItem(PREFS_KEY);
    else storage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch (e) {
    rethrowIfNotDone(e);
    // Private browsing can refuse storage: the settings just aren't remembered.
  }
}
