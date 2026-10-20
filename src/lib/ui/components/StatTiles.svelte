<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { model } from '../../state/model.svelte';
  import ExerciseBoundary from './ExerciseBoundary.svelte';
  import WeeklyTarget from './WeeklyTarget.svelte';

  // All-time figures, then the weekly-target what-if (legacy `renderTiles`).
  const tiles = $derived.by(() => {
    const d = model.daily;
    if (!d) return [];
    const total = d.km.reduce((a, b) => a + b, 0);
    const runDays = d.km.filter((v) => v > 0).length;
    return [
      { k: 'Total distance', v: total.toFixed(0), u: 'km' },
      { k: 'Runs logged', v: String(app.runs.length), u: '' },
      { k: 'Days with a run', v: `${runDays} / ${d.n}`, u: '' },
      { k: 'All-time avg', v: (total / d.n).toFixed(2), u: 'km/day' },
    ];
  });
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
