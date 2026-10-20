<script lang="ts">
  import { dateAt } from '../../domain/daily';
  import { fmtDate } from '../../domain/dates';
  import { binCount, paceHistogram, ZONES } from '../../domain/paceZones';
  import { WORKOUT_TYPES } from '../../domain/workoutType';
  import { model } from '../../state/model.svelte';
  import { settings } from '../../state/settings.svelte';
  import { leadColours, workoutColour } from '../charts/ramps';
  import { durStr, km2, nf0, paceStr } from '../format';
  import { shownDay } from '../shownDay.svelte';
  import { theme } from '../theme.svelte';
  import ZoneHist from './ZoneHist.svelte';

  /**
   * The shown day's runs, one pace-zone histogram each (sharing one y-scale so they compare
   * directly). Always rendered, empty days included, so the card doesn't flicker in and out
   * while scanning days. A two-run day is taller, so the card grows at once but only shrinks
   * after SHRINK_MS without anything taller being asked for.
   */
  const SHRINK_MS = 700;

  const p = $derived(settings.p);
  const shown = $derived(shownDay());
  const lead = $derived(leadColours(theme.current));

  const day = $derived.by(() => {
    const d = model.daily;
    if (!d || !shown) return null;
    const i = shown.i;
    const vdot = model.vdot[i] ?? null;
    const runs = d.runs[i] ?? [];
    const hists = runs.map((r) =>
      r.chunks && vdot ? paceHistogram(r.chunks, vdot, p.zoneBars, p.gapPace) : null,
    );
    const all = hists.length ? hists : [null];
    const byDist = p.zoneAxis === 'dist';
    const maxVal = Math.max(1, ...all.flatMap((h) => (h ? Array.from(byDist ? h.km : h.mins) : [])));
    const empty =
      d.km[i]! > 0
        ? 'No VDOT yet this far back in history — nothing to judge the pace against.'
        : 'No run that day.';
    return { i, vdot, runs, hists: all, byDist, maxVal, empty, date: dateAt(d, i) };
  });

  const zeros = $derived(new Float64Array(binCount(p.zoneBars)));

  // The height hold. `natural` is measured after each render.
  let inner: HTMLDivElement | undefined = $state();
  let held = $state(0);
  let shrinking = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void day; // re-measure whenever the shown day changes
    if (!inner) return;
    const natural = inner.offsetHeight;
    clearTimeout(timer);
    if (natural >= held) {
      held = natural;
      shrinking = false;
      return;
    }
    shrinking = true;
    timer = setTimeout(() => {
      held = natural;
      shrinking = false;
    }, SHRINK_MS);
  });

  function shares(sc: number[] | null): { pct: string; colour: string }[] {
    const tot = sc ? sc.reduce((a, b) => a + b, 0) : 0;
    if (!sc || !(tot > 0)) return [];
    return sc.map((v, t) => ({
      pct: `${nf0.format((v / tot) * 100)}%`,
      colour: workoutColour(theme.current, t),
    }));
  }
</script>

{#if p.panels.zone && day}
  <div class="card zonecard">
    <div class="title">
      Pace zones for {fmtDate(day.date)}{#if shown?.tag}<span class="pin">{shown.tag}</span>{/if}
    </div>
    {#if shrinking}
      <div class="shrink" title="The card shrinks back to fit this day when the bar runs out">
        {#key held}<span style:animation-duration="{SHRINK_MS}ms"></span>{/key}
      </div>
    {/if}
    <div class="body" style:min-height="{held}px" style:transition={shrinking ? '' : 'none'}>
      <div bind:this={inner}>
        <div class="legend">
          <span class="item"><span class="swatch" style:background={lead.standing}></span>Standing</span>
          <span class="item"><span class="swatch" style:background={lead.walking}></span>Walking</span>
          <span class="item"><span class="swatch" style:background={lead.recovery}></span>Recovery</span>
          {#each ZONES as z, k (z.key)}
            <span class="item"
              ><span class="swatch" style:background={theme.current.zoneStrong[k]}></span>{z.label}</span
            >
          {/each}
        </div>
        {#each day.hists as h, a (a)}
          {@const run = day.runs[a]}
          {#if run}
            {@const w = model.workouts[day.i]?.[a] ?? null}
            <div class="run">
              {day.runs.length > 1 ? `Run ${a + 1} of ${day.runs.length}` : 'Run'} · {run.startLocal.slice(
                11,
                16,
              )} · {km2(run.km)} km ·
              {durStr(run.sec)}{#if w}{' · '}<span style:color={workoutColour(theme.current, w.type)}
                  >{WORKOUT_TYPES[w.type].label}</span
                >{/if}
              {#if shares(model.scores[day.i]?.[a] ?? null).length}{' · '}<span
                  class="shares"
                  title="Share of the workout-type score: recovery / endurance / marathon / threshold / interval / repetition"
                  >{#each shares(model.scores[day.i]?.[a] ?? null) as s, t (t)}{t > 0 ? ' / ' : ''}<span
                      style:color={s.colour}>{s.pct}</span
                    >{/each}</span
                >
              {/if}
            </div>
          {/if}
          {#if run && run.segments.length > 1}
            <details class="laps">
              <summary>Laps ({run.segments.length}): pace and grade-adjusted pace</summary>
              <table>
                <thead><tr><th>Lap</th><th>km</th><th>Time</th><th>Pace</th><th>GAP</th></tr></thead>
                <tbody>
                  {#each run.segments as seg, k (k)}
                    {#if seg.km >= 0.02}
                      <tr>
                        <td>{k + 1}</td>
                        <td>{km2(seg.km)}</td>
                        <td>{durStr(seg.sec)}</td>
                        <td>{paceStr(seg.sec / 60 / seg.km)}</td>
                        <td>{paceStr(seg.flatSec / 60 / seg.km)}</td>
                      </tr>
                    {/if}
                  {/each}
                </tbody>
              </table>
            </details>
          {/if}
          <div class="canvas-wrap">
            <ZoneHist
              mins={h?.mins ?? zeros}
              km={h?.km ?? zeros}
              zoneBars={p.zoneBars}
              maxVal={day.maxVal}
              byDist={day.byDist}
              vdot={h ? day.vdot : null}
            />
            {#if !h}<div class="empty">{day.empty}</div>{/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .zonecard {
    position: relative;
    margin-top: 20px;
    padding: 12px 12px 8px;
  }
  .title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    padding: 4px 0 2px 4px;
  }
  .body {
    transition: min-height 0.25s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .body {
      transition: none !important;
    }
  }
  .shrink {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 48px;
    height: 3px;
    border-radius: 2px;
    background: var(--grid);
    overflow: hidden;
  }
  .shrink > span {
    display: block;
    height: 100%;
    background: var(--muted);
    transform-origin: left;
    animation: shrink linear forwards;
  }
  @keyframes shrink {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }
  .legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    padding: 0 4px 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
  }
  .run {
    padding: 6px 4px 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .shares {
    font-weight: 400;
  }
  .canvas-wrap {
    position: relative;
  }
  .laps {
    padding: 0 4px 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .laps summary {
    cursor: pointer;
    color: var(--muted);
  }
  .laps table {
    border-collapse: collapse;
    margin-top: 4px;
    font-variant-numeric: tabular-nums;
  }
  .laps th,
  .laps td {
    text-align: right;
    padding: 1px 10px 1px 0;
  }
  .laps th {
    color: var(--muted);
    font-weight: 500;
    font-size: 11px;
  }
  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 24px;
    color: var(--muted);
    font-size: 13px;
    pointer-events: none;
  }
  .pin {
    display: inline-block;
    vertical-align: middle;
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 0 5px;
    margin-left: 6px;
    text-transform: none;
    letter-spacing: 0;
  }
</style>
