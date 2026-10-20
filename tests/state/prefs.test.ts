import { describe, expect, it } from 'vitest';
import {
  defaultPrefs,
  isDefault,
  loadPrefs,
  parsePrefs,
  PREFS_KEY,
  savePrefs,
} from '../../src/lib/state/prefs';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe('E26 prefs', () => {
  it('falls back to defaults for garbage, field by field', () => {
    expect(parsePrefs(null)).toEqual(defaultPrefs());
    const p = parsePrefs({
      windowBase: 99,
      windowMult: 3,
      barScale: 'cubic',
      barColour: 'verdict',
      panels: { freq: true, vol: 'yes' },
    });
    expect(p.windowBase).toBe(1); // out of range → default
    expect(p.windowMult).toBe(3);
    expect(p.barScale).toBe('linear');
    expect(p.barColour).toBe('verdict');
    expect(p.panels.freq).toBe(true);
    expect(p.panels.vol).toBe(true); // not a boolean → default
  });

  it('rounds to the units the controls produce', () => {
    const p = parsePrefs({
      windowVdot: 352,
      minLapM: 1549,
      vdotCorr: 0.9712,
      wtExp: 1.3,
      targetLongW: 1.66,
      windowBase: 2.4,
    });
    expect(p.windowVdot).toBe(350);
    expect(p.minLapM).toBe(1500);
    expect(p.vdotCorr).toBe(0.97);
    expect(p.wtExp).toBe(1.5);
    expect(p.targetLongW).toBe(1.7);
    expect(p.windowBase).toBe(2);
  });

  it('reads the legacy fields that were replaced', () => {
    expect(parsePrefs({ useGap: true })).toMatchObject({ gapVdot: true, gapPace: true });
    expect(parsePrefs({ colourVerdicts: false }).barColour).toBe('none');
    expect(parsePrefs({ plan: { km: 50, days: 4.6 } }).plan).toEqual({ km: 50, days: 5, runs: 5 });
    expect(parsePrefs({ plan: { km: 50, days: 4, runs: 2 } }).plan).toEqual({ km: 50, days: 4, runs: 4 });
  });

  it('accepts a remembered view, with a null right edge meaning "at the newest day"', () => {
    expect(parsePrefs({ view: { span: 140, right: null } }).view).toEqual({ span: 140, right: null });
    expect(parsePrefs({ view: { span: 2, right: null } }).view).toBeNull();
  });

  it('stores nothing when everything is default, and the whole entry otherwise', () => {
    const s = memoryStorage();
    const p = defaultPrefs();
    expect(isDefault(p)).toBe(true);
    savePrefs(p, s);
    expect(s.getItem(PREFS_KEY)).toBeNull();
    p.barScale = 'log';
    savePrefs(p, s);
    expect(loadPrefs(s).barScale).toBe('log');
    p.barScale = 'linear';
    savePrefs(p, s);
    expect(s.getItem(PREFS_KEY)).toBeNull(); // back to default: removed again
  });

  it('a phone starts with fewer panels, and those are its defaults (nothing stored)', () => {
    const s = memoryStorage();
    const p = loadPrefs(s, true);
    expect(p.panels.table).toBe(false);
    expect(p.panels.runs).toBe(false);
    expect(p.panels.vdot).toBe(true);
    savePrefs(p, s, true);
    expect(s.getItem(PREFS_KEY)).toBeNull();
    expect(isDefault(p)).toBe(false); // by desktop standards it is not the default
  });
});
