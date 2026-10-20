<script lang="ts">
  import { onMount } from 'svelte';
  import { whenDone } from './lib/exercise';
  import { app } from './lib/state/app.svelte';
  import { model } from './lib/state/model.svelte';
  import { view } from './lib/state/view.svelte';
  import ChartCard from './lib/ui/components/ChartCard.svelte';
  import DataTable from './lib/ui/components/DataTable.svelte';
  import ExerciseBoundary from './lib/ui/components/ExerciseBoundary.svelte';
  import Info from './lib/ui/components/Info.svelte';
  import InfoPop from './lib/ui/components/InfoPop.svelte';
  import Readout from './lib/ui/components/Readout.svelte';
  import SettingsSidebar from './lib/ui/components/SettingsSidebar.svelte';
  import StatTiles from './lib/ui/components/StatTiles.svelte';
  import ZoneCard from './lib/ui/components/ZoneCard.svelte';
  import { lastSyncedText } from './lib/ui/lastSynced';
  import { isTyping, keyAction } from './lib/ui/keys';
  import { layout } from './lib/ui/layout.svelte';
  import PhoneApp from './lib/ui/components/PhoneApp.svelte';
  import UpdateBanner from './lib/ui/components/UpdateBanner.svelte';
  import { updates } from './lib/ui/updates.svelte';

  onMount(() => {
    void app.start();
    updates.start();
  });

  // Tell the view how long the history is (and which windows exist) whenever that changes.
  $effect(() => {
    const d = model.daily;
    if (d) view.setContext(d.n, d.start, model.windowsOrNone);
  });

  // The keys (1–4, r, t, Esc) are mapped in ui/keys.ts; nothing happens until E31 is done.
  function onKey(e: KeyboardEvent) {
    const action = whenDone(
      () => keyAction(e, isTyping(e.target)),
      () => null,
    );
    if (action?.kind === 'reset') view.reset();
    else if (action?.kind === 'window') view.zoomToWindow(action.slot);
    else if (action?.kind === 'unpin') view.selected = null;
  }
</script>

<svelte:window onkeydown={onKey} />

{#if layout.phone}
  <PhoneApp />
{:else}
  <div class="page">
    <aside class="sidebar settings-col"><SettingsSidebar /></aside>

    <div class="wrap">
      <h1>
        Running history<Info>
          <p>
            One bar per day, height that day&rsquo;s own distance. The colour says what kind of session it
            was, or, in verdict mode, <strong
              >which rolling distance-per-week window is highest that day</strong
            >, so the answer is &ldquo;is my training trending up&rdquo; rather than &ldquo;was this run long
            enough&rdquo;.
          </p>
        </Info>
      </h1>
      <div class="status" class:offline={!app.online}>
        {app.runs.length} runs · {app.online ? 'Online' : 'Offline'} · {lastSyncedText(app.lastSync)}
        {#if app.reprocessing}· reprocessing {app.reprocessing.done} / {app.reprocessing.total}…{/if}
      </div>

      {#if model.dailyTodo}
        <div class="card empty">
          <h2>{model.dailyTodo.message}</h2>
          <p>Your runs are loaded; the charts appear once the daily series can be built.</p>
        </div>
      {:else if app.loaded && !model.daily}
        <div class="card empty">
          <h2>No runs yet</h2>
          <p>
            Enter your Intervals.icu athlete id and API key under <em>Data</em> in the settings, then press
            <strong>Sync</strong>. The key stays in this browser and is only ever sent to intervals.icu.
          </p>
        </div>
      {/if}

      <ExerciseBoundary card><StatTiles /></ExerciseBoundary>
      {#if model.daily}<ExerciseBoundary card><ChartCard /></ExerciseBoundary>{/if}
      <ExerciseBoundary card><ZoneCard /></ExerciseBoundary>
      <ExerciseBoundary card><DataTable /></ExerciseBoundary>
    </div>

    <aside class="sidebar"><ExerciseBoundary card><Readout /></ExerciseBoundary></aside>
  </div>
{/if}

<InfoPop />
<UpdateBanner />

<style>
  /* Three columns: settings, the chart, the readout. The sidebars are sticky, so the readout
     stays in view while the page scrolls; below 1300px they stack and stop sticking. The
     50vh bottom padding is scroll room: content below can grow and shrink without moving the
     view (legacy/CLAUDE.md, "Both sidebars stay in view"). */
  .page {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    justify-content: center;
    align-items: flex-start;
  }
  .wrap {
    max-width: 1120px;
    flex: 1 1 600px;
    min-width: 0;
    padding-bottom: 50vh;
  }
  .sidebar {
    flex: 0 1 280px;
    min-width: 240px;
    position: sticky;
    top: 20px;
    max-height: calc(100vh - 40px);
    overflow: auto;
  }
  @media (max-width: 1300px) {
    .sidebar {
      position: static;
      max-height: none;
    }
    .wrap {
      padding-bottom: 0;
    }
    .page {
      padding-bottom: 50vh;
    }
  }
  h1 {
    margin-bottom: 4px;
  }
  .status {
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 16px;
  }
  .status.offline {
    color: var(--bad);
  }
  .empty {
    padding: 20px 24px;
    max-width: 560px;
  }
  .empty h2 {
    font-size: 17px;
    margin: 0 0 8px;
  }
  .empty p {
    color: var(--text-secondary);
    margin: 0;
    font-size: 13px;
  }
</style>
