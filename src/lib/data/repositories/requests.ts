import type { RhDb } from '../db';
import type { RequestLog } from '../http';

/** The request budget's log, kept in the `requests` table so limits survive a reload. */
export function dbRequestLog(db: RhDb): RequestLog {
  return {
    async add(at) {
      await db.requests.add({ at });
    },
    async since(since) {
      const rows = await db.requests.where('at').aboveOrEqual(since).toArray();
      return rows.map((r) => r.at).sort((a, b) => a - b);
    },
    async prune(before) {
      await db.requests.where('at').below(before).delete();
    },
  };
}
