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

/** The winning slot (0 = shortest window) on day i, or null on a rest day. */
export function classify(vol: readonly Float64Array[], dayKm: number, i: number): number | null {
  if (!(dayKm > 0)) return null;
  return highestSlot(vol, i, [0, 1, 2, 3]);
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
  let best = slots[0]!;
  for (const k of slots) if (series[k]![i]! > series[best]![i]!) best = k;
  return best;
}
