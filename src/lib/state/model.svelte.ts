import { isNotDone, whenDone, type ExerciseNotDoneError } from '../exercise';
import { buildDaily, dateAt, type Daily } from '../domain/daily';
import { todayLocal } from '../domain/dates';
import { perWeek } from '../domain/rolling';
import { dayStress } from '../domain/stress';
import { classify } from '../domain/verdict';
import { dayVdots, rollingMax } from '../domain/vdot';
import { targetSeed } from '../domain/weeklyTarget';
import { buildWindows, SLOT_KEYS, windowSeries } from '../domain/windows';
import { workoutFromScores, zoneScores, type WorkoutType } from '../domain/workoutType';
import { dayBuckets, zoneArea } from '../domain/zoneVolume';
import { app } from './app.svelte';
import { settings } from './settings.svelte';

/**
 * Everything the charts and the readout show, derived from the synced data and the
 * settings. Each field is a `$derived`: computed on first read, cached, and recomputed only
 * when something it read changes. So moving a drawing-only setting (bar scale) recomputes
 * nothing here, and moving the VDOT window recomputes VDOT and what hangs off it, not the
 * distance windows. https://svelte.dev/docs/svelte/$derived
 *
 * On the exercise branch a field whose code isn't written yet throws ExerciseNotDoneError
 * when read, and the component reading it shows a placeholder instead. Only the two fields
 * the page frame itself needs are caught here: `daily` (null, with `dailyTodo` saying
 * which exercise is missing) and `windowsOrNone` (empty until E04).
 */
class ModelStore {
  readonly today = todayLocal();

  private dailyOrTodo: Daily | ExerciseNotDoneError | null = $derived(
    whenDone<Daily | ExerciseNotDoneError | null>(
      () => buildDaily(app.runs, app.samples, settings.p.chunkSec, settings.p.gapExp, this.today),
      (e) => e,
    ),
  );
  daily: Daily | null = $derived(isNotDone(this.dailyOrTodo) ? null : this.dailyOrTodo);
  /** The exercise standing between the synced runs and the daily series, if any. */
  dailyTodo: ExerciseNotDoneError | null = $derived(isNotDone(this.dailyOrTodo) ? this.dailyOrTodo : null);
  windows = $derived(buildWindows(settings.p.windowBase, settings.p.windowMult));
  /** `windows`, or none until E04 is done: for the page frame (settings, view, buttons). */
  windowsOrNone = $derived(
    whenDone(
      () => this.windows,
      () => [],
    ),
  );
  series = $derived(this.daily ? windowSeries(this.daily, this.windows) : null);

  vdotDays = $derived(
    this.daily
      ? dayVdots(this.daily, {
          minLapM: settings.p.minLapM,
          correction: settings.p.vdotCorr,
          gap: settings.p.gapVdot,
        })
      : null,
  );
  /** The rolling peak VDOT per day; null before the first reading. */
  vdot = $derived(this.vdotDays ? rollingMax(this.vdotDays.value, settings.p.windowVdot) : []);

  stress = $derived(this.daily ? dayStress(this.daily, this.vdot) : null);
  stressSeries = $derived(
    this.stress
      ? {
          raw: this.windows.map((w) => perWeek(this.stress!.raw, w.days)),
          rel: this.windows.map((w) => perWeek(this.stress!.rel, w.days)),
        }
      : null,
  );

  buckets = $derived(this.daily ? dayBuckets(this.daily, this.vdot, settings.p.gapPace) : null);
  zoneAreaSlot = $derived(SLOT_KEYS.indexOf(settings.p.zoneAreaWin));
  zoneAreaByMin = $derived(settings.p.zoneAreaMode === 'min' || settings.p.zoneAreaMode === 'pctMin');
  zoneArea = $derived(
    this.daily && this.buckets
      ? zoneArea(
          this.zoneAreaByMin ? this.buckets.min : this.buckets.km,
          this.daily.n,
          this.windows[this.zoneAreaSlot]!.days,
        )
      : null,
  );

  /** Workout-type scores per run, [day][run]; null for a run with nothing to judge. */
  scores = $derived(
    this.daily
      ? this.daily.runs.map((runs, i) =>
          runs.map((r) =>
            r.chunks && this.vdot[i]
              ? zoneScores(r.chunks, this.vdot[i], settings.p.wtExp, settings.p.gapPace)
              : null,
          ),
        )
      : [],
  );
  /** The share threshold is applied after scoring, so moving it doesn't re-score anything. */
  workouts: (WorkoutType | null)[][] = $derived(
    this.scores.map((day) => day.map((sc) => (sc ? workoutFromScores(sc, settings.p.wtShare) : null))),
  );

  /** Verdict slot per day (−1 on a rest day). */
  verdicts = $derived.by(() => {
    const out = new Int8Array(this.daily?.n ?? 0).fill(-1);
    if (!this.daily || !this.series) return out;
    for (let i = 0; i < this.daily.n; i++) out[i] = classify(this.series.vol, this.daily.km[i]!, i) ?? -1;
    return out;
  });

  seed = $derived(
    this.daily
      ? targetSeed(
          this.daily,
          this.windows[SLOT_KEYS.indexOf(settings.p.targetWin)]!.days,
          dateAt(this.daily, this.daily.n - 1) === this.today,
        )
      : null,
  );
}

export const model = new ModelStore();
