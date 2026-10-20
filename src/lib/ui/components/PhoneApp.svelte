<script lang="ts">
  import { app } from '../../state/app.svelte';
  import { model } from '../../state/model.svelte';
  import { lastSyncedText } from '../lastSynced';
  import ChartCard from './ChartCard.svelte';
  import DataTable from './DataTable.svelte';
  import ExerciseBoundary from './ExerciseBoundary.svelte';
  import ReadoutStrip from './ReadoutStrip.svelte';
  import SettingsSidebar from './SettingsSidebar.svelte';
  import StatTiles from './StatTiles.svelte';
  import ViewButtons from './ViewButtons.svelte';
  import ZoneCard from './ZoneCard.svelte';

  /**
   * The phone layout: a sticky readout strip, one tab of content at a time, and a tab bar
   * at the bottom. Same components as the desktop, arranged for a narrow screen.
   */
  type Tab = 'chart' | 'zones' | 'settings';
  let tab = $state<Tab>('chart');
  const TABS: { key: Tab; label: string }[] = [
    { key: 'chart', label: 'Chart' },
    { key: 'zones', label: 'Zones' },
    { key: 'settings', label: 'Settings' },
  ];
</script>

<div class="phone">
  {#if tab !== 'settings' && model.daily}<ExerciseBoundary><ReadoutStrip /></ExerciseBoundary>{/if}
  <div class="status" class:offline={!app.online}>
    {app.runs.length} runs · {app.online ? 'Online' : 'Offline'} · {lastSyncedText(app.lastSync)}
  </div>

  {#if tab === 'chart'}
    {#if model.daily}
      <ExerciseBoundary card><ChartCard /></ExerciseBoundary>
      <ViewButtons />
      <div class="below"><ExerciseBoundary card><StatTiles /></ExerciseBoundary></div>
    {:else if model.dailyTodo}
      <div class="card empty">{model.dailyTodo.message}: the charts appear once it is.</div>
    {:else if app.loaded}
      <div class="card empty">
        No runs yet: open <b>Settings</b>, enter your Intervals.icu details and press Sync.
      </div>
    {/if}
  {:else if tab === 'zones'}
    <ExerciseBoundary card><ZoneCard /></ExerciseBoundary>
    <ExerciseBoundary card><DataTable /></ExerciseBoundary>
  {:else}
    <SettingsSidebar />
  {/if}
</div>

<nav class="tabs">
  {#each TABS as t (t.key)}
    <button class:active={tab === t.key} onclick={() => (tab = t.key)}>{t.label}</button>
  {/each}
</nav>

<style>
  .phone {
    padding-bottom: calc(76px + env(safe-area-inset-bottom));
  }
  .status {
    font-size: 12px;
    color: var(--muted);
    margin: 0 2px 10px;
  }
  .status.offline {
    color: var(--bad);
  }
  .below {
    margin-top: 16px;
  }
  .empty {
    padding: 16px;
    color: var(--text-secondary);
  }
  .tabs {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    background: var(--surface-1);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .tabs button {
    flex: 1;
    min-height: 56px;
    border: 0;
    border-radius: 0;
    font-size: 14px;
    color: var(--muted);
  }
  .tabs button.active {
    color: var(--accent);
    font-weight: 600;
    box-shadow: inset 0 2px 0 var(--accent);
  }
</style>
