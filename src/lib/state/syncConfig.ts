import { parseIsoDate, type IsoDate } from '../domain/dates';

/**
 * Where to sync from and what to keep. Lives in localStorage (read synchronously at
 * startup, like the legacy prefs), including the API key: it stays in this browser and is
 * only ever sent to intervals.icu. Never committed, never logged.
 */
export interface SyncConfig {
  athleteId: string;
  apiKey: string;
  /** Backfill starts here. Anything older is never fetched. */
  earliest: IsoDate;
  /** Activity types that count as running. Everything else is skipped, not stored. */
  types: string[];
}

export const SYNC_CONFIG_KEY = 'runviz.sync.v1';

/** Outdoor running only: `VirtualRun` (treadmill/indoor) is deliberately not in here. */
export const DEFAULT_TYPES = ['Run', 'TrailRun'];

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  athleteId: '',
  apiKey: '',
  earliest: '2015-01-01' as IsoDate,
  types: DEFAULT_TYPES,
};

/** Validates a stored value field by field; anything odd falls back to the default for that field. */
export function parseSyncConfig(raw: unknown): SyncConfig {
  const c: SyncConfig = { ...DEFAULT_SYNC_CONFIG, types: [...DEFAULT_TYPES] };
  if (typeof raw !== 'object' || raw === null) return c;
  const r = raw as Record<string, unknown>;
  if (typeof r.athleteId === 'string') c.athleteId = r.athleteId.trim();
  if (typeof r.apiKey === 'string') c.apiKey = r.apiKey.trim();
  if (typeof r.earliest === 'string') c.earliest = parseIsoDate(r.earliest) ?? c.earliest;
  if (Array.isArray(r.types)) {
    const types = r.types
      .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
      .map((t) => t.trim());
    if (types.length) c.types = types;
  }
  return c;
}

export function loadSyncConfig(storage: Storage = localStorage): SyncConfig {
  try {
    return parseSyncConfig(JSON.parse(storage.getItem(SYNC_CONFIG_KEY) ?? 'null'));
  } catch {
    return parseSyncConfig(null);
  }
}

export function saveSyncConfig(c: SyncConfig, storage: Storage = localStorage): void {
  storage.setItem(SYNC_CONFIG_KEY, JSON.stringify(c));
}

/** An athlete id looks like "i12345", or "0" for "whoever owns the key". */
export const isCredentialComplete = (c: SyncConfig): boolean =>
  /^(i\d+|0)$/.test(c.athleteId) && c.apiKey.length >= 8;
