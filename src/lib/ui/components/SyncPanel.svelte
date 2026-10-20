<script lang="ts">
  import { todayLocal } from '../../domain/dates';
  import { PROCESSING_VERSION } from '../../data/processingVersion';
  import { app } from '../../state/app.svelte';
  import { parseEarliest } from '../../state/syncConfig';
  import { dayText } from '../lastSynced';

  // A local copy of the form, so typing doesn't save on every keystroke; "Save" commits it.
  let athleteId = $state(app.config.athleteId);
  let apiKey = $state(app.config.apiKey);
  let earliest = $state<string>(app.config.earliest);
  let types = $state(app.config.types.join(', '));

  function save() {
    app.saveConfig({
      athleteId: athleteId.trim(),
      apiKey: apiKey.trim(),
      earliest: parseEarliest(earliest) ?? app.config.earliest,
      types: types
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }

  const lastSyncText = $derived.by(() => {
    const s = app.lastSync;
    if (!s) return 'never synced';
    const local = new Date(s.at);
    const time = local.toTimeString().slice(0, 5);
    return `last synced ${dayText(todayLocal(local))} ${time} · ${s.requests} requests`;
  });

  const progressText = $derived.by(() => {
    const s = app.sync;
    if (s.kind !== 'running') return '';
    const p = s.progress;
    if (p.phase === 'listing') return `Listing activities… (${p.requests} requests)`;
    const failed = p.failed ? ` · ${p.failed} failed` : '';
    return `Fetching ${p.done} / ${p.total}${failed} · ${p.requests} requests`;
  });

  const pauseText = $derived.by(() => {
    const p = app.pause;
    if (!p) return '';
    const at = new Date(p.until).toTimeString().slice(0, 5);
    const why =
      p.reason === 'day'
        ? 'daily request limit reached'
        : p.reason === 'window'
          ? '15-minute request limit reached'
          : 'Intervals.icu asked us to slow down';
    return `Sync paused: ${why}, resumes at ${at}`;
  });
</script>

<section class="group">
  <h2 class="title">Data · Intervals.icu</h2>
  <div class={['status', !app.online && 'offline']}>{app.online ? 'Online' : 'Offline'} · {lastSyncText}</div>

  {#if app.pause}
    <div class="banner" role="status">{pauseText}</div>
  {/if}

  <label class="chk"
    >Athlete id <input
      type="text"
      class="wide"
      bind:value={athleteId}
      placeholder="i12345"
      autocomplete="off"
    /></label
  >
  <label class="chk"
    >API key <input type="password" class="wide" bind:value={apiKey} autocomplete="off" /></label
  >
  <label class="chk">Earliest date <input type="date" class="wide" bind:value={earliest} /></label>
  <label class="chk"
    >Types <input
      type="text"
      class="wide"
      bind:value={types}
      title="Activity types that count as running, comma-separated"
    /></label
  >
  <button onclick={save}>Save</button>

  <div class="row">
    {#if app.sync.kind === 'running'}
      <button onclick={() => app.cancelSync()}>Cancel</button>
    {:else}
      <button class="primary" disabled={!app.canSync} onclick={() => app.startSync()}>Sync</button>
    {/if}
    <span class="note">{progressText}</span>
  </div>
  {#if app.sync.kind === 'done'}
    <div class="note">
      {app.sync.result.fetched} fetched, {app.sync.result.skipped} unchanged, {app.sync.result.failed.length} failed
      ·
      {app.sync.result.requests} requests
    </div>
  {:else if app.sync.kind === 'error'}
    <div class="note bad">{app.sync.message}</div>
  {/if}

  <div class="row">
    <button disabled={!!app.reprocessing} onclick={() => app.reprocessStale(true)}>Reprocess all</button>
    <span class="note">
      {#if app.reprocessing}Reprocessing {app.reprocessing.done} / {app.reprocessing.total}…{:else}processing
        v{PROCESSING_VERSION}
      {/if}
    </span>
  </div>
  <button
    disabled={!app.canSync}
    title="Re-fetch everything from the earliest date, and drop runs Intervals.icu no longer has"
    onclick={() => app.startSync({ from: app.config.earliest, to: todayLocal() })}>Full re-sync</button
  >
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .title {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .status {
    font-size: 11px;
    color: var(--muted);
  }
  .status.offline {
    color: var(--bad);
  }
  .banner {
    font-size: 12px;
    color: var(--bad);
    border: 1px solid currentColor;
    border-radius: 6px;
    padding: 6px 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .note {
    font-size: 11px;
    color: var(--muted);
  }
  .note.bad {
    color: var(--bad);
  }
  label.chk {
    justify-content: space-between;
  }
  .wide {
    width: 150px !important;
    text-align: left !important;
  }
</style>
