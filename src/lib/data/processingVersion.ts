/**
 * What "how the samples were made" means. Bump PROCESSING_VERSION whenever the numbers in
 * `samples` would come out differently from the same raw data: a new gradient window, a
 * new field. On the next start every run built with an older version is rebuilt from its
 * raw data, with no network (see reprocess.ts). This is a different thing from the Dexie
 * schema version in db.ts, which is about table shapes.
 *
 * In a module of its own so the page can read it without pulling in the FIT decoder,
 * which only the worker needs.
 *
 * v1: 100 m distance chunks.  v2: cleaned per-second samples (chunks built in memory).
 * v3: the watch's smoothed speed dropped (it lags on short reps); speed is metres ÷ time.
 */
export const PROCESSING_VERSION = 3;
