import { whenDone } from '../exercise';
import { model } from '../state/model.svelte';
import { settings } from '../state/settings.svelte';
import type { BarSegment } from './charts/barsPanel';
import { workoutColour } from './charts/ramps';
import type { Theme } from './charts/theme';

/**
 * A day's bar, one segment per run (earliest at the bottom), in the colours the
 * "Colour bars by" setting asks for: the verdict (a statement about the day, so every
 * segment shares it), the workout type (about each run, so each gets its own), or none.
 * A colouring whose exercise isn't done yet (verdict E05, workout type E11) draws grey.
 */
export function barSegments(i: number, theme: Theme): BarSegment[] {
  const daily = model.daily;
  if (!daily || !(daily.km[i]! > 0)) return [{ frac: 1, colour: theme.rest }];
  const runs = daily.runs[i]!;
  const total = runs.reduce((a, r) => a + r.km, 0);
  const verdict = settings.p.barColour === 'verdict' ? orNone(() => model.verdicts[i]!, -1) : -1;
  const flat = verdict < 0 ? theme.nocolour : theme.windows[verdict]!;
  const colourOf = (k: number) =>
    settings.p.barColour === 'workout'
      ? orNone(() => workoutColour(theme, model.workouts[i]?.[k]?.type ?? null), theme.nocolour)
      : flat;
  if (!(total > 0)) return [{ frac: 1, colour: colourOf(0) }];
  return runs.map((r, k) => ({ frac: r.km / total, colour: colourOf(k) }));
}

const orNone = <T>(read: () => T, none: T): T =>
  whenDone(
    () => read(),
    () => none,
  );
