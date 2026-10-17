<script lang="ts">
  import { dateAt } from '../../domain/daily';
  import { fmtDate } from '../../domain/dates';
  import {
    fitPlan,
    LONG_MIN_DAYS,
    maxRunsFor,
    MAX_TRIPLE,
    MULTI2_MIN_DAYS,
    MULTI3_MIN_DAYS,
    PLAN_MAX_DAYS,
    PLAN_MAX_RUNS,
    PLAN_MAX_KM,
    targetFor,
    weekPlan,
    type Plan,
  } from '../../domain/weeklyTarget';
  import { SLOT_KEYS } from '../../domain/windows';
  import { model } from '../../state/model.svelte';
  import { settings } from '../../state/settings.svelte';
  import { km2, nf1 } from '../format';
  import Info from './Info.svelte';

  /**
   * The weekly target what-if. Seeded from real history (whole days and runs, fitted to the
   * caps) until edited; an edit is remembered in the prefs, and "reset" goes back to history.
   */
  const p = $derived(settings.p);
  const long = $derived({ long: p.targetLong, weight: p.targetLongW });
  const seed = $derived(model.seed);
  const plan = $derived.by((): Plan => {
    const base =
      p.plan ?? (seed ? { km: seed.km, days: seed.days, runs: seed.runs } : { km: 0, days: 0, runs: 0 });
    return fitPlan(base, 'days', long);
  });
  const t = $derived(targetFor(plan, long));
  const ok = $derived(plan.days > 0 && t.perRun > 0);
  const week = $derived(ok ? weekPlan(plan, long) : null);
  const fmt = (v: number) => String(+v.toFixed(1));

  function edit(which: 'km' | 'days' | 'runs', value: number) {
    if (!Number.isFinite(value)) return;
    settings.p.plan = fitPlan({ ...plan, [which]: value }, which, long);
  }

  const pill = $derived(p.plan ? 'what-if' : seed?.lastIsToday ? 'yesterday' : 'most recent');
  const windowLabel = $derived(model.windows[SLOT_KEYS.indexOf(p.targetWin)]?.label ?? '');
</script>

{#if p.panels.target}
  <div class="card tile">
    <div class="k">
      Weekly target<Info>
        <p>
          A what-if for splitting a week: how long each day&rsquo;s running should be to hit a weekly
          distance, given how many days you run and how many runs those days hold. Runs/wk can&rsquo;t go
          below days/wk.
        </p>
        {#if t.long}
          <p>
            With a long run, it is alone on its day and counts as {fmt(p.targetLongW)} days&rsquo; worth, so the
            week is split into days − 1 + {fmt(p.targetLongW)} shares and the long run takes {fmt(
              p.targetLongW,
            )} of them.
          </p>
          <p class="eq">
            long run = {fmt(p.targetLongW)} × {fmt(plan.km)} ÷ {fmt(plan.days - 1 + p.targetLongW)} =
            <b>{km2(t.longKm)} km</b><br />
            1-run day = ({fmt(plan.km)} − {km2(t.longKm)}) ÷ {fmt(t.restRuns)} = <b>{km2(t.perRun)} km</b>
          </p>
        {:else}
          <p>
            No long run here ({p.targetLong
              ? `it needs at least ${LONG_MIN_DAYS} days/wk`
              : 'switched off in the settings'}), so every run is an equal share.
          </p>
          <p class="eq">1-run day = {fmt(plan.km)} ÷ {fmt(plan.runs)} = <b>{km2(t.perRun)} km</b></p>
        {/if}
        <p>
          The template lays the week out Monday to Sunday. Run days are picked in the order Sat, Mon, Wed,
          Thu, Sun, Tue, Fri; Saturday is the long run (L); extra runs go out in the same order a round at a
          time; L is alone on its day and is the first to get a third run (L+1); Friday is never doubled;
          two-run days need ≥ {MULTI2_MIN_DAYS} days/wk, three-run days ≥ {MULTI3_MIN_DAYS}, and at most {MAX_TRIPLE}
          three-run days a week.
        </p>
        <p>
          Most runs/wk at each days/wk:
          <span class="eq"
            >{#each Array.from({ length: PLAN_MAX_DAYS }, (_, k) => k + 1) as d (d)}{d > 1
                ? ' · '
                : ''}{#if d === plan.days}<b>{d} → {maxRunsFor(d, long)}</b>{:else}{d} → {maxRunsFor(
                  d,
                  long,
                )}{/if}{/each}</span
          >
        </p>
        {#if seed && model.daily}
          <p>
            {p.plan
              ? 'You have edited the numbers. The real history says:'
              : 'The numbers start from the real history:'}<br />
            <span class="eq"
              >km/wk = {nf1.format(seed.kmSum)} km × 7 ÷ {seed.windowDays} days =
              <b>{nf1.format(seed.km)}</b><br />
              days/wk = {seed.runDays} run days × 7 ÷ {seed.windowDays} days =
              <b>{nf1.format(seed.days)}</b><br />
              runs/wk = {seed.nRuns} runs × 7 ÷ {seed.windowDays} days = <b>{nf1.format(seed.runs)}</b></span
            >
          </p>
          <p>
            That is the last {seed.windowDays} days (the {windowLabel} window), ending {fmtDate(
              dateAt(model.daily, seed.end),
            )}{seed.lastIsToday
              ? ' — yesterday, since today may not have all its runs in yet'
              : ', the last day in the data'}.
          </p>
        {/if}
      </Info>
      <span class="whatif">{pill}</span>
    </div>
    {#if p.plan}
      <button class="reset" title="Back to the real figures" onclick={() => (settings.p.plan = null)}
        >reset</button
      >
    {/if}
    <div class="plan">
      <input
        type="number"
        min="0"
        max={PLAN_MAX_KM}
        step="1"
        value={fmt(plan.km)}
        onchange={(e) => edit('km', e.currentTarget.valueAsNumber)}
      /><span class="u">km/wk</span>
      <input
        type="number"
        min="0"
        max={PLAN_MAX_DAYS}
        step="1"
        value={plan.days}
        onchange={(e) => edit('days', e.currentTarget.valueAsNumber)}
      /><span class="u">days/wk</span>
      <input
        type="number"
        min="0"
        max={PLAN_MAX_RUNS}
        step="1"
        value={plan.runs}
        onchange={(e) => edit('runs', e.currentTarget.valueAsNumber)}
      /><span class="u">runs/wk</span>
    </div>
    {#if week}
      <div class="weekplan">
        {#each week as w (w.name)}
          <div class={['wd', w.long && 'long', w.runs === 0 && 'rest']}>
            <span class="dn">{w.name}</span>
            <span class="wr"
              >{w.long
                ? w.runs > 1
                  ? `L+${w.runs - 1}`
                  : 'L'
                : w.runs === 0
                  ? 'rest'
                  : w.runs === 1
                    ? '1 run'
                    : `${w.runs} runs`}</span
            >
            <span class="wk">{w.runs ? nf1.format(w.km) : '–'}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="weekempty">No runs to lay out.</div>
    {/if}
  </div>
{/if}

<style>
  .tile {
    padding: 12px 64px 12px 16px;
    position: relative;
    min-width: 330px;
    flex: 0 1 auto;
  }
  .k {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .whatif {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent);
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 0 5px;
    margin-left: 5px;
    letter-spacing: 0;
    text-transform: none;
  }
  .reset {
    position: absolute;
    top: 8px;
    right: 10px;
    font-size: 11px;
    padding: 1px 7px;
  }
  .plan {
    display: flex;
    align-items: baseline;
    gap: 4px 6px;
    margin: 3px 0 1px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .plan input {
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    width: 52px;
    text-align: right;
    color: var(--text-primary);
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--border);
    padding: 0 2px;
    font-variant-numeric: tabular-nums;
  }
  .plan input:focus {
    outline: none;
    border-bottom-color: var(--accent);
  }
  .u {
    margin-right: 6px;
  }
  .weekplan {
    display: grid;
    grid-template-columns: repeat(7, minmax(44px, 1fr));
    gap: 4px;
    margin-top: 10px;
  }
  .wd {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 2px;
    border: 1px solid var(--border);
    border-radius: 6px;
    line-height: 1.3;
  }
  .wd.long {
    border-color: var(--accent);
  }
  .wd.rest {
    opacity: 0.45;
  }
  .dn {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .wr {
    font-size: 10px;
    color: var(--text-secondary);
  }
  .wk {
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .weekempty {
    font-size: 12px;
    color: var(--muted);
    margin-top: 10px;
  }
</style>
