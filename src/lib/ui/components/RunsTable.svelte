<script lang="ts">
  import { fmtDate } from '../../domain/dates';
  import { app } from '../../state/app.svelte';

  const rows = $derived([...app.runs].reverse());
  const clock = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.round(s % 60);
    return `${h ? h + ':' : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
  };
</script>

<div class="card tablewrap">
  <table>
    <thead>
      <tr><th>Date</th><th>Name</th><th>km</th><th>Time</th><th>Laps</th><th>Chunks</th></tr>
    </thead>
    <tbody>
      {#each rows as r (r.id)}
        {@const c = app.chunks.get(r.id)}
        <tr>
          <td>{fmtDate(r.localDate)} {r.startLocal.slice(11, 16)}</td>
          <td class="name">{r.name}</td>
          <td>{(r.distanceM / 1000).toFixed(2)}</td>
          <td>{clock(r.movingS)}</td>
          <td>{c ? `${c.lapRule} · ${c.segmentCount}` : '—'}</td>
          <td>{c ? c.distM.length : '—'}</td>
        </tr>
      {:else}
        <tr
          ><td colspan="6" class="empty">No runs yet: enter your Intervals.icu details and press Sync.</td
          ></tr
        >
      {/each}
    </tbody>
  </table>
</div>

<style>
  .tablewrap {
    max-height: 70vh;
    overflow: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
  }
  th,
  td {
    text-align: right;
    padding: 6px 12px;
    border-bottom: 1px solid var(--grid);
    font-variant-numeric: tabular-nums;
  }
  th:first-child,
  td:first-child,
  .name {
    text-align: left;
  }
  th {
    position: sticky;
    top: 0;
    background: var(--surface-1);
    color: var(--muted);
    font-weight: 500;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .empty {
    text-align: left;
    color: var(--muted);
  }
</style>
