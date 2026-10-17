<script lang="ts">
  import { dateAt } from '../../domain/daily';
  import { fmtDate } from '../../domain/dates';
  import { VERDICTS } from '../../domain/verdict';
  import { WORKOUT_TYPES } from '../../domain/workoutType';
  import { model } from '../../state/model.svelte';
  import { settings } from '../../state/settings.svelte';
  import { view } from '../../state/view.svelte';
  import { visibleRange } from '../charts/geometry';
  import { workoutColour } from '../charts/ramps';
  import { WINDOW_CSS } from '../charts/theme';
  import { km2, nf0 } from '../format';
  import { theme } from '../theme.svelte';

  /** Past this many days in view the table drops the oldest, so the newest is always first. */
  const MAX_ROWS = 400;
  // The table reads slots 1 and 2: 4 weeks for km/week, 16 for the run rates (at the defaults).
  const VOL_SLOT = 1;
  const FREQ_SLOT = 2;

  const rows = $derived.by(() => {
    const d = model.daily;
    if (!d) return { days: [] as number[], inView: 0 };
    const [a, b] = visibleRange({ width: 1000, view: view.state }, d.n);
    const lo = Math.max(0, Math.ceil(a + 1));
    const hi = Math.min(d.n - 1, b - 1);
    const days: number[] = [];
    for (let i = hi; i >= Math.max(lo, hi - MAX_ROWS + 1); i--) days.push(i);
    return { days, inView: hi - lo + 1 };
  });
</script>

{#if settings.p.panels.table && model.daily && model.series}
  {@const d = model.daily}
  {@const s = model.series}
  <div class="card tablewrap">
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Distance (km)</th><th>km / week</th><th>Run days / week</th><th>Runs / week</th><th
            >Verdict</th
          ><th>Workout</th>
        </tr>
      </thead>
      <tbody>
        {#each rows.days as i (i)}
          {@const v = model.verdicts[i] ?? -1}
          <tr>
            <td>{fmtDate(dateAt(d, i))}</td>
            <td>{d.km[i]! > 0 ? km2(d.km[i]!) : '—'}</td>
            <td>{s.vol[VOL_SLOT]![i]!.toFixed(1)}</td>
            <td>{s.freq[FREQ_SLOT]![i]!.toFixed(1)}</td>
            <td>{s.runs[FREQ_SLOT]![i]!.toFixed(1)}</td>
            <td>
              {#if v >= 0}
                <span style:color="var({WINDOW_CSS[v]})">{VERDICTS[v]!.arrow} {VERDICTS[v]!.label}</span><br
                /><span class="why">{model.windows[v]!.label} highest</span>
              {:else}<span class="dim">— no run</span>{/if}
            </td>
            <td>
              {#each model.workouts[i] ?? [] as w, k (k)}
                {#if k > 0}<br />+
                {/if}
                {#if w}
                  <span style:color={workoutColour(theme.current, w.type)}>{WORKOUT_TYPES[w.type].label}</span
                  >
                  <span class="muted"
                    >{nf0.format(w.pct)}% {WORKOUT_TYPES[w.type].key}{w.plus ? '+' : ''}</span
                  >
                {:else}<span class="dim">no timing</span>{/if}
              {:else}—{/each}
            </td>
          </tr>
        {/each}
        {#if rows.inView > MAX_ROWS}
          <tr
            ><td colspan="7" class="note"
              >Showing the most recent {MAX_ROWS} of {rows.inView} days in view — zoom in for the rest.</td
            ></tr
          >
        {/if}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .tablewrap {
    margin-top: 20px;
    max-height: 340px;
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
  tr:last-child td {
    border-bottom: 0;
  }
  th:first-child,
  td:first-child {
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
  .why {
    color: var(--muted);
    font-size: 10px;
  }
  .muted {
    color: var(--muted);
  }
  .dim {
    color: var(--text-secondary);
  }
  td.note {
    text-align: left;
    color: var(--muted);
  }
</style>
