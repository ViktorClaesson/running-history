<script lang="ts">
  import { dateAt } from '../../domain/daily';
  import { fmtDate } from '../../domain/dates';
  import { BUCKET_LABELS, bucketVelocityRange, N_BUCKETS } from '../../domain/paceZones';
  import { VERDICTS } from '../../domain/verdict';
  import { vdotVsPeak } from '../../domain/vdot';
  import { WORKOUT_TYPES, type WorkoutType } from '../../domain/workoutType';
  import { model } from '../../state/model.svelte';
  import { settings } from '../../state/settings.svelte';
  import { bucketColours, workoutColour } from '../charts/ramps';
  import { WINDOW_CSS } from '../charts/theme';
  import { durStr, km2, nf0, nf1, paceOfVel, paceStr, perMonthKm, perYearKm, plural } from '../format';
  import { shownDay } from '../shownDay.svelte';
  import { theme } from '../theme.svelte';
  import Info from './Info.svelte';

  const shown = $derived(shownDay());
  const p = $derived(settings.p);

  /** "full activity 10.52km in 52:56 (5:02/km)" / "→ 45.4 grade-adj. · 10.2% off the peak" */
  function vdotBasis(i: number): [string, string] {
    const src = model.vdotDays?.source[i];
    const ran = (model.daily?.km[i] ?? 0) > 0;
    if (!src) return [ran ? 'no timing data' : 'no run', ''];
    const first = `${src.kind === 'lap' ? 'best lap' : 'full activity'} ${km2(src.km)}km in ${durStr(src.sec)} (${paceStr(src.sec / 60 / src.km)}/km)`;
    const r = vdotVsPeak(model.vdotDays!.value[i]!, model.vdot[i] ?? null);
    const vs =
      r === null ? '' : r >= 0.9995 ? ' · at the peak' : ` · ${((1 - r) * 100).toFixed(1)}% off the peak`;
    return [first, `→ ${model.vdotDays!.value[i]!.toFixed(1)}${src.adjusted ? ' grade-adj.' : ''}${vs}`];
  }

  const why = (w: WorkoutType | null) =>
    !w
      ? 'no timing'
      : w.noRunning
        ? 'no running laps'
        : `${nf0.format(w.pct)}% ${WORKOUT_TYPES[w.type].key}${w.plus ? '+' : ''}`;

  function bucketPace(b: number, vdot: number | null): string {
    if (!vdot) return '';
    const r = bucketVelocityRange(b, vdot);
    if (b === 0) return `over ${paceOfVel(r.hi!)}`;
    if (r.hi === null) return `under ${paceOfVel(r.lo)}`;
    return `${paceOfVel(r.lo)}–${paceOfVel(r.hi)}`;
  }
</script>

<div class={['card', 'readout', !shown && 'idle']}>
  {#if !shown || !model.daily || !model.series}
    <span class="date">Hover a bar to see that day&rsquo;s numbers</span>
  {:else}
    {@const i = shown.i}
    {@const d = model.daily}
    {@const s = model.series}
    {@const runs = d.runs[i] ?? []}
    {@const verdict = model.verdicts[i] ?? -1}
    <span class="date"
      >{fmtDate(dateAt(d, i))}{#if shown.tag}<span class="pin">{shown.tag}</span>{/if}</span
    >

    <span class="pair detail">
      <span class="k">Distance that day</span>
      <span class="v"
        >{d.km[i]! > 0 ? `${km2(d.km[i]!)} km` : 'no run'}{#if runs.length > 1}<span class="sub-v"
            >{` in ${runs.length} runs`}</span
          >{/if}</span
      >
      <span class="v2">{runs.length > 1 ? runs.map((r) => km2(r.km)).join(' + ') + ' km' : ''}</span>
    </span>

    <span class="pair">
      <span class="k">Distance per week</span>
      <span class="wingrid">
        {#each model.windows as w (w.key)}
          <span class="sw" style:background="var({WINDOW_CSS[w.slot]})"></span>
          <span class="wl">{w.label}</span>
          <span class="wv">{s.vol[w.slot]![i]!.toFixed(1)} km</span>
          <span class="wx"
            ><span class="seg">{nf0.format(perMonthKm(s.vol[w.slot]![i]!))} km/mo</span> ·
            <span class="seg">{nf0.format(perYearKm(s.vol[w.slot]![i]!))} km/yr</span></span
          >
        {/each}
      </span>
    </span>

    <span class="pair">
      <span class="k">Run days/Runs per week</span>
      <span class="wingrid">
        {#each model.windows as w (w.key)}
          <span class="sw" style:background="var({WINDOW_CSS[w.slot]})"></span>
          <span class="wl">{w.label}</span>
          <span class="wv"
            >{s.runs[w.slot]![i]!.toFixed(1)}<span class="wu">{' runs in '}</span>{s.freq[w.slot]![
              i
            ]!.toFixed(1)}<span class="wu">{' days'}</span></span
          >
          <span class="wx has-info"
            ><Info
              >{plural(s.runsIn[w.slot]![i]!, 'run')} in {plural(s.runDaysIn[w.slot]![i]!, 'day')} (out of {w.days}
              days)</Info
            ></span
          >
        {/each}
      </span>
    </span>

    <span class="pair">
      <span class="k">Stress that day</span>
      <span class="v"
        >{#if d.km[i]! > 0}{nf0.format(model.stress?.raw[i] ?? 0)} raw<span class="sub-v"
            >{` · ${nf0.format(model.stress?.rel[i] ?? 0)} relative`}</span
          >{:else}no run{/if}</span
      >
    </span>

    <span class="pair">
      <span class="k">Raw/Relative stress per week</span>
      <span class="wingrid stressgrid">
        {#each model.windows as w (w.key)}
          {@const raw = model.stressSeries?.raw[w.slot]![i] ?? 0}
          {@const rel = model.stressSeries?.rel[w.slot]![i] ?? 0}
          <span class="sw" style:background="var({WINDOW_CSS[w.slot]})"></span>
          <span class="wl">{w.label}</span>
          <span class="wv">{nf0.format(raw)}</span>
          <span class="wx">{nf0.format(raw / 7)}/day</span>
          <span class="wv rel">{nf0.format(rel)}</span>
          <span class="wx">{nf0.format(rel / 7)}/day</span>
        {/each}
      </span>
    </span>

    <span class="pair">
      <span class="k"
        >By pace zone, {model.windows[model.zoneAreaSlot]?.label}
        {model.zoneAreaByMin ? 'min' : 'km'}/week</span
      >
      <span class="wingrid zonegrid">
        {#if model.zoneArea}
          {@const za = model.zoneArea}
          {@const colours = bucketColours(theme.current)}
          {@const tot = za.total[i]!}
          {#each Array.from({ length: N_BUCKETS }, (_, k) => N_BUCKETS - 1 - k) as b (b)}
            {@const x = za.bands[b]![i]!}
            <span class="sw fill" style:background={colours[b]}></span>
            <span class="wl">{BUCKET_LABELS[b]}</span>
            <span class="wv"
              >{(model.zoneAreaByMin ? nf0 : nf1).format(x)} {model.zoneAreaByMin ? 'min' : 'km'}</span
            >
            <span class="wx wp">{tot > 0 ? nf0.format((x / tot) * 100) + '%' : ''}</span>
            <span class="wx">{bucketPace(b, model.vdot[i] ?? null)}</span>
          {/each}
        {/if}
      </span>
    </span>

    <span class="pair">
      <span class="k">VDOT (peak, trailing {Math.round(p.windowVdot / 7)}w)</span>
      <span class="v">{model.vdot[i] != null ? model.vdot[i]!.toFixed(1) : '—'}</span>
      {#if true}
        {@const [line1, line2] = vdotBasis(i)}
        <span class="v2"
          >{line1}{#if line2}<br /><span class="seg">{line2}</span>{/if}</span
        >
      {/if}
    </span>

    {#if p.barColour === 'workout' && verdict >= 0}
      {@const ws = model.workouts[i] ?? []}
      {@const known = ws.filter((w) => w !== null)}
      {@const top = known.reduce<WorkoutType | null>((a, b) => (a === null || b.type > a.type ? b : a), null)}
      {#if top === null}
        <span class="badge" style:color="var(--text-secondary)"
          >no timing data<span class="why">&nbsp;</span></span
        >
      {:else}
        <span class="badge" style:color={workoutColour(theme.current, top.type)}>
          <span
            >{#each ws as w, k (k)}{k > 0 ? ' + ' : ''}<span
                style:color={workoutColour(theme.current, w?.type ?? null)}
                >{w ? WORKOUT_TYPES[w.type].label : '?'}</span
              >{/each}</span
          >
          <span class="why" title={ws.map(why).join(' · ')}>{ws.map(why).join(' · ')}</span>
        </span>
      {/if}
    {:else}
      <span
        class="badge"
        style:color={verdict >= 0 ? `var(${WINDOW_CSS[verdict]})` : 'var(--text-secondary)'}
      >
        {verdict >= 0 ? `${VERDICTS[verdict]!.arrow} ${VERDICTS[verdict]!.label}` : '— rest day'}
        <span class="why">{verdict >= 0 ? `${model.windows[verdict]!.label} highest` : '\u00a0'}</span>
      </span>
    {/if}
  {/if}
</div>

<style>
  /* A vertical list of full-width rows. The `.v2` two-line reserve keeps a wrapping detail
     line from nudging the sidebar's height on every hover (legacy/CLAUDE.md, the readout). */
  .readout {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .date {
    font-size: 15px;
    font-weight: 600;
  }
  .idle .date {
    color: var(--text-secondary);
    font-weight: 400;
  }
  .pair {
    display: flex;
    flex-direction: column;
  }
  .k {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .v {
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .sub-v {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-secondary);
  }
  .v2 {
    font-size: 11px;
    font-weight: 400;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    margin-top: 1px;
    min-height: 2lh;
  }
  .detail .v2 {
    min-height: 1lh;
  }
  .wingrid {
    display: grid;
    grid-template-columns: auto auto auto 1fr;
    gap: 1px 5px;
    align-items: baseline;
    margin-top: 3px;
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }
  .sw {
    width: 10px;
    height: 3px;
    border-radius: 2px;
    align-self: center;
  }
  .sw.fill {
    height: 9px;
  }
  .wl {
    color: var(--text-secondary);
  }
  .wv {
    text-align: right;
    font-weight: 600;
  }
  /* The dim note gives first when a row runs out of room: a step smaller than the rest. */
  .wx {
    color: var(--muted);
    font-size: 10px;
  }
  .wu {
    font-weight: 400;
    color: var(--text-secondary);
  }
  .wx.has-info {
    align-self: center;
    display: flex;
  }
  .wx.has-info :global(.info) {
    margin-left: 0;
    translate: none;
  }
  .stressgrid {
    grid-template-columns: auto auto auto auto auto 1fr;
  }
  .stressgrid .wv.rel {
    padding-left: 10px;
  }
  .zonegrid {
    grid-template-columns: auto auto auto auto 1fr;
  }
  .zonegrid .wp {
    text-align: right;
  }
  .seg {
    white-space: nowrap;
  }
  .badge {
    display: inline-flex;
    align-self: flex-start;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 10px;
    border: 1px solid currentColor;
  }
  /* One line, always: three runs' worth of figures would wrap and grow the sidebar on
     those days. The full text is in the tooltip, and per run in the pace-zone card. */
  .why {
    font-size: 10px;
    font-weight: 400;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .badge {
    max-width: 100%;
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
    white-space: nowrap;
  }
</style>
