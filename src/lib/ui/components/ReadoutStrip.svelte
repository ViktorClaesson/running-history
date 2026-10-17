<script lang="ts">
  import { dateAt } from '../../domain/daily';
  import { fmtDate } from '../../domain/dates';
  import { VERDICTS } from '../../domain/verdict';
  import { WORKOUT_TYPES } from '../../domain/workoutType';
  import { model } from '../../state/model.svelte';
  import { settings } from '../../state/settings.svelte';
  import { workoutColour } from '../charts/ramps';
  import { WINDOW_CSS } from '../charts/theme';
  import { km2 } from '../format';
  import { shownDay } from '../shownDay.svelte';
  import { theme } from '../theme.svelte';
  import Readout from './Readout.svelte';

  /**
   * The phone's readout: one compact strip that stays at the top while the page scrolls,
   * following the tapped day (else the most recent run). Tap it to open the full readout.
   */
  let open = $state(false);
  const shown = $derived(shownDay());

  const summary = $derived.by(() => {
    const d = model.daily;
    if (!d || !shown) return null;
    const i = shown.i;
    const ws = (model.workouts[i] ?? []).filter((w) => w !== null);
    const top = ws.reduce<(typeof ws)[number] | null>(
      (a, b) => (a === null || b.type > a.type ? b : a),
      null,
    );
    const verdict = model.verdicts[i] ?? -1;
    const label =
      d.km[i]! <= 0
        ? { text: 'rest day', colour: 'var(--text-secondary)' }
        : settings.p.barColour === 'workout' && top
          ? { text: WORKOUT_TYPES[top.type].label, colour: workoutColour(theme.current, top.type) }
          : verdict >= 0
            ? { text: VERDICTS[verdict]!.label, colour: `var(${WINDOW_CSS[verdict]})` }
            : { text: '', colour: '' };
    return {
      date: fmtDate(dateAt(d, i)),
      tag: shown.tag,
      km: d.km[i]! > 0 ? `${km2(d.km[i]!)} km` : 'no run',
      label,
      vdot: model.vdot[i] != null ? model.vdot[i]!.toFixed(1) : '—',
    };
  });
</script>

<div class="strip-wrap">
  <button class="card strip" onclick={() => (open = !open)} aria-expanded={open}>
    {#if summary}
      <span class="line1"
        >{summary.date}{#if summary.tag}<span class="pin">{summary.tag}</span>{/if}</span
      >
      <span class="line2">
        <b>{summary.km}</b>{' · '}<span style:color={summary.label.colour}>{summary.label.text}</span
        >{' · VDOT '}{summary.vdot}
      </span>
    {:else}
      <span class="line1">Tap a day to see its numbers</span>
    {/if}
    <span class="chev" class:open>▾</span>
  </button>
  {#if open}
    <div class="sheet"><Readout /></div>
  {/if}
</div>

<style>
  .strip-wrap {
    position: sticky;
    top: 0;
    z-index: 10;
    margin: 0 -12px 12px;
    padding: 8px 12px 0;
    background: var(--page);
  }
  .strip {
    width: 100%;
    min-height: 52px;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    text-align: left;
    padding: 8px 12px;
    color: var(--text-primary);
    font-size: 14px;
  }
  .line1 {
    font-weight: 600;
  }
  .line2 {
    font-size: 13px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }
  .chev {
    grid-row: 1 / span 2;
    grid-column: 2;
    align-self: center;
    color: var(--muted);
    transition: rotate 0.2s;
  }
  .chev.open {
    rotate: 180deg;
  }
  .sheet {
    max-height: 65vh;
    overflow: auto;
    padding: 8px 0 4px;
  }
  .pin {
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 0 5px;
    margin-left: 6px;
  }
</style>
