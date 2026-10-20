<script lang="ts">
  import { todo } from '../../exercise';
  import { model } from '../../state/model.svelte';
  import ExerciseBoundary from './ExerciseBoundary.svelte';
  import WeeklyTarget from './WeeklyTarget.svelte';

  interface Tile {
    /** The label ("Total distance"), the figure ("3579"), and its unit ("km", or ''). */
    k: string;
    v: string;
    u: string;
  }

  /*
   * TODO(E32) · stat tiles · difficulty ★☆☆ · phase 5 · checked in the app, no tests
   * The all-time figures above the chart, as a `$derived` list of four tiles, in this order:
   *   Total distance    the sum of model.daily.km, no decimals            unit 'km'
   *   Runs logged       app.runs.length                                   no unit
   *   Days with a run   "<days with km > 0> / <days in the series (n)>"   no unit
   *   All-time avg      total ÷ n, two decimals                           unit 'km/day'
   * An empty list while there is no daily series (model.daily is null).
   * Use $derived.by (a block that returns the value) rather than a function you call from the
   * markup: Svelte then recomputes it only when something it reads changes (a sync adds runs),
   * not on every render, and you never update it by hand. You'll need to import `app` from
   * '../../state/app.svelte' again.
   * Concepts:
   * - $derived and $derived.by: https://svelte.dev/docs/svelte/$derived
   * - {#each} with a key: https://svelte.dev/docs/svelte/each
   * - Number.prototype.toFixed: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed
   * Check in the app: the four tiles appear left of the Weekly target box (where the "Exercise
   * E32" placeholder is now), and "Runs logged" goes up after a Sync.
   * Spoiler: `renderTiles()` in legacy/running-history.html.
   */
  const tiles: Tile[] = $derived.by(() => todo('E32'));
</script>

{#if model.daily}
  <div class="tiles">
    <ExerciseBoundary card>
      {#each tiles as t (t.k)}
        <div class="card tile">
          <div class="k">{t.k}</div>
          <div class="v">{t.v}<span class="u">{t.u}</span></div>
        </div>
      {/each}
    </ExerciseBoundary>
    <ExerciseBoundary card><WeeklyTarget /></ExerciseBoundary>
  </div>
{/if}

<style>
  .tiles {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }
  .tile {
    padding: 12px 16px;
    min-width: 132px;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .k {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .v {
    font-size: 22px;
    font-weight: 600;
    margin-top: 2px;
  }
  .u {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-secondary);
    margin-left: 2px;
  }
</style>
