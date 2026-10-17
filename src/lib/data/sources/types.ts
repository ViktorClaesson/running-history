import type { IsoDate } from '../../domain/dates';
import type { ActivityId, ActivitySummary, RawActivity } from '../../domain/types';

/**
 * Where activities come from. The rest of the app only ever talks to this interface, so
 * another source (Strava, Garmin, a file import) is one new implementation, not a rewrite.
 * Deliberately tiny: two calls, normalized results.
 */
export interface ActivitySource {
  /**
   * Every activity that *started* on a local date in [oldest, newest], of any type, as
   * normalized summaries. `skipped` counts entries the source listed but can't serve.
   */
  listActivities(oldest: IsoDate, newest: IsoDate, signal?: AbortSignal): Promise<ActivityList>;
  /** The full raw data for one activity. */
  fetchRaw(id: ActivityId, signal?: AbortSignal): Promise<RawActivity>;
}

export interface ActivityList {
  activities: ActivitySummary[];
  skipped: number;
}
