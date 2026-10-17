import { model } from '../state/model.svelte';
import { view } from '../state/view.svelte';

/**
 * The day the readout and the pace-zone card show: the hovered day, else the pinned one,
 * else the most recent run, so they always have something to show. `tag` says *why*
 * ("pinned", "most recent run", or nothing for a live hover), shared by both so they agree.
 */
export function shownDay(): { i: number; tag: string } | null {
  if (view.hover !== null) return { i: view.hover, tag: '' };
  if (view.selected !== null) return { i: view.selected, tag: 'pinned' };
  const last = model.daily?.lastRunIdx ?? -1;
  return last >= 0 ? { i: last, tag: 'most recent run' } : null;
}
