<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/state/app.svelte';
  import RunsTable from './lib/ui/components/RunsTable.svelte';
  import SyncPanel from './lib/ui/components/SyncPanel.svelte';

  // Opens the database and loads what's already synced, once, when the page mounts.
  onMount(() => {
    void app.start();
  });
</script>

<div class="page">
  <aside class="card side"><SyncPanel /></aside>
  <main>
    <h1>Running history <span class="count">{app.runs.length} runs</span></h1>
    <RunsTable />
  </main>
</div>

<style>
  .page {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .side {
    flex: 0 1 300px;
    padding: 14px 16px;
  }
  main {
    flex: 1 1 600px;
    min-width: 0;
  }
  .count {
    font-size: 13px;
    font-weight: 400;
    color: var(--muted);
  }
</style>
