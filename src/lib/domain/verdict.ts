import { todo } from '../exercise';
/**
 * The verdict: **which window's distance per week is highest that day**, the shortest
 * winning a tie. A rest day has none. It is the same argmax the "highlight the highest
 * line" drawing picks out, which is why slot k's line and verdict k share a colour.
 * See legacy/CLAUDE.md, "Verdict" (and why judging the run itself was dropped).
 */
export interface VerdictInfo {
  key: 'hp' | 'pr' | 'st' | 'un';
  label: string;
  arrow: string;
}

/** Indexed by the winning slot: a shorter window on top means more recent growth. */
export const VERDICTS: readonly VerdictInfo[] = [
  { key: 'hp', label: 'highly productive', arrow: '▲▲' },
  { key: 'pr', label: 'productive', arrow: '▲' },
  { key: 'st', label: 'steady', arrow: '=' },
  { key: 'un', label: 'unproductive', arrow: '▼' },
];

/*
 * TODO(E05) · verdict · difficulty ★☆☆ · phase 1
 *   highestSlot(series, i, slots)  which of `slots` has the highest series[k][i]. A tie keeps
 *                                  the earlier slot in the list (compare with a strict >).
 *   classify(vol, dayKm, i)        the verdict on day i: null on a rest day (dayKm not > 0),
 *                                  otherwise highestSlot over all four slots of `vol`.
 * Edge cases that matter, and why:
 * - The shortest window wins a tie. A shorter window on top means more recent growth, which
 *   is the more productive reading.
 * - `!(dayKm > 0)` rather than `dayKm <= 0` also treats NaN as a rest day.
 * - The line highlight calls highestSlot with only the lines that are drawn, so don't assume
 *   `slots` is [0, 1, 2, 3].
 * Background: legacy/CLAUDE.md, "The model" (the bullet "Verdict"), including why judging the
 * run itself was dropped.
 * Concepts:
 * - for…of: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
 * - strict vs loose comparison of NaN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NaN
 * Check: npm run exercise E05 (tests/domain/windows.test.ts, "E05 verdict"). In the app, with
 * "Colour bars by: verdict", the bars take the colour of the winning window, and the table and
 * readout show the verdict.
 * Spoiler: `classify()` in legacy/running-history.html (a ladder of comparisons that this
 * argmax replaces; the test checks the two agree).
 */
/** The winning slot (0 = shortest window) on day i, or null on a rest day. */
export function classify(vol: readonly Float64Array[], dayKm: number, i: number): number | null {
  return todo('E05', vol, dayKm, i);
}

/**
 * Which of `slots` has the highest value on day i. Strictly greater, so a tie keeps the
 * earlier (shorter) slot. Shared with the line highlight, which passes only the drawn slots.
 */
export function highestSlot(
  series: readonly ArrayLike<number>[],
  i: number,
  slots: readonly number[],
): number {
  return todo('E05', series, i, slots);
}
