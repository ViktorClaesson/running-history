<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/state/app.svelte';
  import { model } from './lib/state/model.svelte';
  import { view } from './lib/state/view.svelte';
  import ChartCard from './lib/ui/components/ChartCard.svelte';
  import DataTable from './lib/ui/components/DataTable.svelte';
  import Info from './lib/ui/components/Info.svelte';
  import InfoPop from './lib/ui/components/InfoPop.svelte';
  import Readout from './lib/ui/components/Readout.svelte';
  import SettingsSidebar from './lib/ui/components/SettingsSidebar.svelte';
  import StatTiles from './lib/ui/components/StatTiles.svelte';
  import ZoneCard from './lib/ui/components/ZoneCard.svelte';
  import { lastSyncedText } from './lib/ui/lastSynced';
  import UpdateBanner from './lib/ui/components/UpdateBanner.svelte';
  import { updates } from './lib/ui/updates.svelte';

  onMount(() => {
    void app.start();
    updates.start();
  });

  // Tell the view how long the history is (and which windows exist) whenever that changes.
  $effect(() => {
    const d = model.daily;
    if (d) view.setContext(d.n, d.start, model.windows);
  });

  /**
   * Keys for what's worth doing without aiming: 1–4 zoom to a window, r resets the view,
   * t or Esc releases the pin. Modified presses are left alone (⌘R still reloads), and so is
   * anything typed into an input, where "r" is just a letter.
   */
  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)))
      return;
    const k = e.key.toLowerCase();
    if (k === 'r') view.reset();
    else if (/^[1-4]$/.test(k)) view.zoomToWindow(Number(k) - 1);
    else if (k === 'escape' || k === 't') view.selected = null;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="page">
  <aside class="sidebar settings-col"><SettingsSidebar /></aside>

  <div class="wrap">
    <h1>
      Running history<Info>
        <p>
          One bar per day, height that day&rsquo;s own distance. The colour says what kind of session it was,
          or, in verdict mode, <strong>which rolling distance-per-week window is highest that day</strong>, so
          the answer is &ldquo;is my training trending up&rdquo; rather than &ldquo;was this run long
          enough&rdquo;.
        </p>
      </Info>
    </h1>
    <div class="status" class:offline={!app.online}>
      {app.runs.length} runs · {app.online ? 'Online' : 'Offline'} · {lastSyncedText(app.lastSync)}
      {#if app.reprocessing}· reprocessing {app.reprocessing.done} / {app.reprocessing.total}…{/if}
    </div>

    {#if app.loaded && !model.daily}
      <div class="card empty">
        <h2>No runs yet</h2>
        <p>
          Enter your Intervals.icu athlete id and API key under <em>Data</em> in the settings, then press
          <strong>Sync</strong>. The key stays in this browser and is only ever sent to intervals.icu.
        </p>
      </div>
    {/if}

    <StatTiles />
    {#if model.daily}<ChartCard />{/if}
    <ZoneCard />
    <DataTable />
  </div>

  <aside class="sidebar"><Readout /></aside>
</div>

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
