/**
 * Learning mode. On the `v2-exercises` branch a part of the app is left for you to write:
 * each missing function body is `return todo('E04', …)`, with a `TODO(E04)` block above it
 * saying what to build. `todo` throws an `ExerciseNotDoneError`, and the parts of the app
 * that need that function show "Exercise E04 not done yet: window series" in its place
 * instead of crashing (see ui/components/ExerciseBoundary.svelte). docs/GUIDE.md walks
 * through them in order; `npm run exercises` lists the ones still open.
 *
 * On `v2-solution` nothing calls `todo`, so none of this ever fires.
 */

/** Every exercise, in the order to do them (each needs only the ones before it). */
export const EXERCISES = {
  E01: { title: 'dates', difficulty: 1, phase: 1 },
  E02: { title: 'rolling sums', difficulty: 1, phase: 1 },
  E03: { title: 'daily series', difficulty: 2, phase: 1 },
  E04: { title: 'window series', difficulty: 2, phase: 1 },
  E05: { title: 'verdict', difficulty: 1, phase: 1 },
  E06: { title: 'VDOT formulas', difficulty: 1, phase: 2 },
  E07: { title: 'VDOT per day', difficulty: 2, phase: 2 },
  E08: { title: 'rolling max', difficulty: 3, phase: 2 },
  E09: { title: 'pace-zone edges', difficulty: 3, phase: 2 },
  E10: { title: 'pace histogram', difficulty: 1, phase: 2 },
  E11: { title: 'workout type', difficulty: 2, phase: 2 },
  E12: { title: 'stress score', difficulty: 1, phase: 2 },
  E13: { title: 'volume by pace zone', difficulty: 2, phase: 2 },
  E14: { title: 'weekly target', difficulty: 1, phase: 2 },
  E15: { title: 'template week', difficulty: 3, phase: 2 },
  E16: { title: 'lap detection', difficulty: 2, phase: 3 },
  E17: { title: 'grade-adjusted pace', difficulty: 2, phase: 3 },
  E18: { title: 'samples', difficulty: 2, phase: 3 },
  E19: { title: 'chunks', difficulty: 3, phase: 3 },
  E20: { title: 'repositories', difficulty: 2, phase: 4 },
  E21: { title: 'request budget', difficulty: 2, phase: 4 },
  E22: { title: 'retry with backoff', difficulty: 3, phase: 4 },
  E23: { title: 'activity list validation', difficulty: 1, phase: 4 },
  E24: { title: 'sync ranges and decisions', difficulty: 2, phase: 4 },
  E25: { title: 'ordered downloads', difficulty: 3, phase: 4 },
  E26: { title: 'settings validation', difficulty: 2, phase: 4 },
  E27: { title: 'worker messages', difficulty: 2, phase: 4 },
  E28: { title: 'zoom', difficulty: 2, phase: 5 },
  E29: { title: 'axis ticks', difficulty: 2, phase: 5 },
  E30: { title: 'bar axis', difficulty: 2, phase: 5 },
  E31: { title: 'keyboard shortcuts', difficulty: 1, phase: 5 },
  E32: { title: 'stat tiles', difficulty: 1, phase: 5 },
  E33: { title: 'pan, tap and pinch', difficulty: 3, phase: 5 },
} as const;

export type ExerciseId = keyof typeof EXERCISES;

/** Thrown by `todo`: this part of the app is an exercise that hasn't been written yet. */
export class ExerciseNotDoneError extends Error {
  readonly id: ExerciseId;

  constructor(id: ExerciseId) {
    super(`Exercise ${id} not done yet: ${EXERCISES[id].title}`);
    this.name = 'ExerciseNotDoneError';
    this.id = id;
  }
}

/**
 * The body of a function that is still an exercise. Pass the function's own parameters
 * along, so the type checker doesn't flag them as unused while the body is missing.
 */
export function todo(id: ExerciseId, ..._inputs: unknown[]): never {
  throw new ExerciseNotDoneError(id);
}

/** By name rather than `instanceof`, so it still works across a hot reload of this module. */
export function isNotDone(e: unknown): e is ExerciseNotDoneError {
  return e instanceof Error && e.name === 'ExerciseNotDoneError';
}

/**
 * `run()`, or `fallback()` if it hits an exercise that isn't done. For the few shared pieces
 * that would otherwise take everything after them down (the axis ticks every panel uses,
 * the zoom, the bar colours); everything else just shows its placeholder. Any other error
 * is passed on untouched.
 */
export function whenDone<T>(run: () => T, fallback: (e: ExerciseNotDoneError) => T): T {
  try {
    return run();
  } catch (e) {
    if (isNotDone(e)) return fallback(e);
    throw e;
  }
}

/** For a `catch` that would otherwise swallow an unfinished exercise as an ordinary failure. */
export function rethrowIfNotDone(e: unknown): void {
  if (isNotDone(e)) throw e;
}
