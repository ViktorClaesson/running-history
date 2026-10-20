import { Decoder, Stream } from '@garmin/fitsdk';
import type { ParsedRun, Pause, WatchLap } from '../domain/parsedRun';

/**
 * FIT file → ParsedRun, with Garmin's official decoder.
 * https://developer.garmin.com/fit/protocol/  (the format)
 * https://github.com/garmin/fit-javascript-sdk  (the decoder)
 *
 * Only what processing needs is kept: per-sample time, distance, altitude, heart rate and
 * the watch's smoothed speed, the timer's stop/start events (pauses), and the laps with
 * their trigger and workout step.
 *
 * `sessionIndex` picks one session out of a multisport file (swim → bike → run in one
 * recording): only that session's samples, laps and events are kept. 0 for a normal run.
 */
export function decodeFit(bytes: ArrayBuffer, sessionIndex = 0): ParsedRun {
  const decoder = new Decoder(Stream.fromArrayBuffer(bytes));
  const { messages, errors } = decoder.read({ convertDateTimesToDates: true });
  if (errors.length && !messages.recordMesgs?.length && !messages.sessionMesgs?.length) {
    throw new Error(`could not decode FIT file: ${errors[0]?.message ?? 'unknown error'}`);
  }
  const session = messages.sessionMesgs?.[sessionIndex] ?? messages.sessionMesgs?.[0];
  const window = sessionWindow(session, messages.sessionMesgs?.length ?? 0);
  const inWindow = (d: unknown) =>
    d instanceof Date && d.getTime() >= window.from && d.getTime() <= window.to;

  const records = (messages.recordMesgs ?? []).filter((r) => inWindow(r.timestamp));
  const t0 = records[0]?.timestamp instanceof Date ? records[0].timestamp.getTime() : window.from;
  const secs = (d: unknown): number => (d instanceof Date ? (d.getTime() - t0) / 1000 : NaN);
  const firstLap = finite(session?.firstLapIndex) ?? 0;
  const lapCount = finite(session?.numLaps) ?? messages.lapMesgs?.length ?? 0;

  return {
    ...samplesFrom(records, secs),
    pauses: pausesFrom(
      (messages.eventMesgs ?? []).filter((e) => inWindow(e.timestamp)),
      secs,
    ),
    laps: (messages.lapMesgs ?? []).slice(firstLap, firstLap + lapCount).map((l) => lapFrom(l, secs)),
    totals: { distM: finite(session?.totalDistance) ?? 0, timerS: finite(session?.totalTimerTime) ?? 0 },
  };
}

interface SessionLike {
  startTime?: unknown;
  totalElapsedTime?: unknown;
  firstLapIndex?: unknown;
  numLaps?: unknown;
  totalDistance?: unknown;
  totalTimerTime?: unknown;
}

/** The session's time span; the whole file when it is the only session. */
function sessionWindow(session: SessionLike | undefined, sessions: number): { from: number; to: number } {
  const start = session?.startTime instanceof Date ? session.startTime.getTime() : null;
  const elapsed = finite(session?.totalElapsedTime);
  if (sessions <= 1 || start === null || elapsed === null) return { from: -Infinity, to: Infinity };
  return { from: start, to: start + elapsed * 1000 };
}

interface RecordLike {
  timestamp?: unknown;
  distance?: unknown;
  enhancedAltitude?: unknown;
  altitude?: unknown;
  heartRate?: unknown;
  enhancedSpeed?: unknown;
  speed?: unknown;
}

function samplesFrom(records: RecordLike[], secs: (d: unknown) => number) {
  const n = records.length;
  const t = new Float64Array(n);
  const dist = new Float64Array(n);
  const alt = new Float64Array(n);
  const hr = new Float64Array(n);
  const speed = new Float64Array(n);
  let lastDist = finite(records[0]?.distance) ?? 0;
  const dist0 = lastDist;
  for (let i = 0; i < n; i++) {
    const r = records[i]!;
    t[i] = secs(r.timestamp);
    // Distance can be missing on a sample (GPS dropout): carry the last one forward. It
    // is measured from this session's own start (a multisport file counts on from the swim).
    lastDist = finite(r.distance) ?? lastDist;
    dist[i] = lastDist - dist0;
    alt[i] = finite(r.enhancedAltitude) ?? finite(r.altitude) ?? NaN;
    hr[i] = finite(r.heartRate) ?? NaN;
    speed[i] = finite(r.enhancedSpeed) ?? finite(r.speed) ?? NaN;
  }
  return { t, dist, alt, hr, speed };
}

interface LapLike {
  startTime?: unknown;
  lapTrigger?: unknown;
  wktStepIndex?: unknown;
  totalDistance?: unknown;
  totalTimerTime?: unknown;
}

function lapFrom(l: LapLike, secs: (d: unknown) => number): WatchLap {
  return {
    startT: secs(l.startTime) || 0,
    trigger: typeof l.lapTrigger === 'string' ? l.lapTrigger : null,
    wktStepIndex: finite(l.wktStepIndex),
    distM: finite(l.totalDistance) ?? 0,
    timerS: finite(l.totalTimerTime) ?? 0,
  };
}

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Timer stop → next timer start, as [from, to] in seconds. */
function pausesFrom(
  events: { event?: unknown; eventType?: unknown; timestamp?: unknown }[],
  secs: (d: unknown) => number,
): Pause[] {
  const pauses: Pause[] = [];
  let stoppedAt: number | null = null;
  for (const e of events) {
    if (e.event !== 'timer') continue;
    const at = secs(e.timestamp);
    if (!Number.isFinite(at)) continue;
    const type = String(e.eventType);
    if (type.startsWith('stop')) stoppedAt ??= at;
    else if (type === 'start' && stoppedAt !== null) {
      if (at > stoppedAt) pauses.push({ from: stoppedAt, to: at });
      stoppedAt = null;
    }
  }
  return pauses;
}
