import type { IsoDate } from './dates';

/** The source's own id for an activity, e.g. Intervals.icu's "i197306134". */
export type ActivityId = string;

/**
 * One run, as a small normalized summary. This is what the activity list returns, what
 * the `activities` table stores, and what most of the model is built from.
 */
export interface ActivitySummary {
  id: ActivityId;
  /** Local wall-clock start, "2026-10-14T18:08:47", exactly as the source gives it. */
  startLocal: string;
  /** The local calendar day the run belongs to: the first ten characters of `startLocal`. */
  localDate: IsoDate;
  name: string;
  /** The source's activity type, e.g. "Run". Only included types are ever stored. */
  type: string;
  distanceM: number;
  /** Timer time, i.e. excluding pauses. */
  movingS: number;
  elapsedS: number;
  avgHr: number | null;
  elevGainM: number | null;
  /**
   * Changes whenever the source re-analyses or edits the activity. When it differs from
   * the stored one, sync re-downloads the raw data. Opaque: only ever compared for equality.
   */
  changeMarker: string;
}

/**
 * Raw data exactly as fetched, never modified afterwards except by re-fetching. Today
 * always the original FIT file (see docs/intervals-api-findings.md for why).
 */
export interface RawActivity {
  id: ActivityId;
  format: 'fit';
  bytes: ArrayBuffer;
  /** ISO timestamp of the download. */
  fetchedAt: string;
}
