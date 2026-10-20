<script lang="ts">
  import { SLOT_KEYS } from '../../domain/windows';
  import { model } from '../../state/model.svelte';
  import { PANEL_KEYS, type PanelKey } from '../../state/prefs';
  import { settings } from '../../state/settings.svelte';
  import { view } from '../../state/view.svelte';
  import { leadColours } from '../charts/ramps';
  import { WINDOW_CSS } from '../charts/theme';
  import { theme } from '../theme.svelte';
  import Info from './Info.svelte';
  import NumField from './NumField.svelte';
  import SlowNumField from './SlowNumField.svelte';
  import SyncPanel from './SyncPanel.svelte';

  /**
   * Grouped by what each setting moves, in the same order as what they control appears on
   * the page (legacy/CLAUDE.md, "The settings sidebar"). Inputs write straight into
   * `settings.p`; everything that depends on them recomputes or redraws by itself.
   */
  const p = $derived(settings.p);
  const lead = $derived(leadColours(theme.current));
  const winLabel = (slot: number) => model.windows[slot]?.label ?? '';
  const winsN = $derived(model.windows.map((w) => w.weeks).join(' / '));
  void PANEL_KEYS;

  function setPanel(k: PanelKey, on: boolean) {
    settings.p.panels[k] = on;
  }

  function reset() {
    settings.resetAll();
    view.reset();
  }
</script>

<div class="card settings">
  <SyncPanel />

  <section class="group">
    <h2 class="title">
      Weekly target<Info
        >A what-if box that lays a week out day by day: how far each day should be to hit a weekly distance.
        It starts from your real history over the window picked below. The (i) on the box itself shows the
        rules and the sums.</Info
      >
    </h2>
    <label class="chk"
      ><input
        type="checkbox"
        checked={p.panels.target}
        onchange={(e) => setPanel('target', e.currentTarget.checked)}
      /> Weekly target box</label
    >
    <label
      class="chk"
      title="Count one run a week as the long run: alone on its day and worth more than one of the others. Only applies at 3 or more days a week."
    >
      <input type="checkbox" bind:checked={settings.p.targetLong} /> Include a long run
    </label>
    <label
      class="chk"
      title="How many ordinary run days the long run is worth, 1-3. At 2 it is twice a one-run day."
    >
      Long run counts as <NumField
        value={p.targetLongW}
        min={1}
        max={3}
        step={0.1}
        disabled={!p.targetLong}
        onset={(v) => (settings.p.targetLongW = v)}
      /> days
    </label>
    <label
      class="chk"
      title="Which rolling window the box's starting km/wk, days/wk and runs/wk are averaged over, ending on the last day in the data (or the day before, if that is today)."
    >
      Based on
      <select bind:value={settings.p.targetWin}>
        {#each SLOT_KEYS as k, slot (k)}<option value={k}>{winLabel(slot)}</option>{/each}
      </select> window
    </label>
  </section>

  <section class="group">
    <h2 class="title">
      Distance bars<Info>
        <p>
          One bar per day, its height that day&rsquo;s own distance. On the <strong>log</strong> axis equal
          <em>ratios</em> are equal heights, so one very long run can&rsquo;t flatten every short one. On the
          <strong>linear</strong> axis, capping long days keeps one ultra from squashing the rest: anything longer
          is drawn at the cap with a break across its top, and the axis reads &ldquo;X+&rdquo;. The readout and
          the table always give the real distance. A day with no run gets a short grey stub, so it can still be
          hovered and clicked.
        </p>
        {#if p.barColour === 'verdict'}
          <p>
            <strong>Verdict:</strong> which distance-per-week window is highest that day, the shortest winning
            a tie.
            {winLabel(0)} highest is highly productive, {winLabel(1)} productive, {winLabel(2)} steady, {winLabel(
              3,
            )} unproductive: the shorter the window on top, the more recent the growth. A rest day has no verdict.
          </p>
        {:else if p.barColour === 'workout'}
          <p>
            <strong>Workout type:</strong> each chunk (Min chunk length, under Pace zones) scores its speed (km/h)
            to the power below, times its distance, towards the zone it was run in. Then, hardest first, each zone
            is pooled with every faster one, and the first pool to reach the share below is the run&rsquo;s type.
          </p>
        {/if}
      </Info>
    </h2>
    <label class="chk" title="Log makes equal ratios equal heights; linear makes heights plain kilometres.">
      Scale <select bind:value={settings.p.barScale}
        ><option value="log">logarithmic</option><option value="linear">linear</option></select
      >
    </label>
    <label
      class="chk"
      title="Draw any day longer than this at this height, marked as cut off. The readout and table still give the real distance."
    >
      <input type="checkbox" bind:checked={settings.p.barCap} /> Cap at
      <NumField value={p.barCapKm} min={1} max={500} step={1} onset={(v) => (settings.p.barCapKm = v)} /> km
    </label>
    <label
      class="chk"
      title="What the colour of each run's bar says: where training stands that day, what kind of session it was, or nothing."
    >
      Colour bars by
      <select bind:value={settings.p.barColour}
        ><option value="verdict">verdict</option><option value="workout">workout type</option><option
          value="none">nothing</option
        ></select
      >
    </label>
    {#if p.barColour === 'verdict'}
      <div class="legend">
        <div class="legend-row">
          <span class="legend-tag">Verdict</span>
          <span class="item"
            ><span class="swatch" style:background="var(--v-hp)"></span>▲▲ highly productive</span
          >
          <span class="item"><span class="swatch" style:background="var(--v-pr)"></span>▲ productive</span>
          <span class="item"><span class="swatch" style:background="var(--v-st)"></span>= steady</span>
          <span class="item"><span class="swatch" style:background="var(--v-un)"></span>▼ unproductive</span>
        </div>
        <div class="legend-row">
          <span class="legend-tag">No run</span><span class="item"
            ><span class="swatch" style:background="var(--rest)"></span>rest day</span
          >
        </div>
      </div>
    {:else if p.barColour === 'workout'}
      <div class="legend">
        <div class="legend-row">
          <span class="legend-tag">Workout</span>
          <span class="item"
            ><span class="swatch" style:background="var(--z-repetition)"></span>repetition</span
          >
          <span class="item"><span class="swatch" style:background="var(--z-interval)"></span>interval</span>
          <span class="item"><span class="swatch" style:background="var(--z-threshold)"></span>threshold</span
          >
          <span class="item"><span class="swatch" style:background="var(--z-marathon)"></span>marathon</span>
          <span class="item"><span class="swatch" style:background="var(--z-easy)"></span>endurance</span>
          <span class="item"><span class="swatch" style:background={lead.recovery}></span>recovery</span>
          <span class="item"><span class="swatch" style:background="var(--rest)"></span>rest day</span>
        </div>
      </div>
      <label
        class="chk"
        title="How much faster chunks count for. 0 is plain distance in each zone; higher leans harder towards the fastest."
      >
        Speed weight <NumField
          value={p.wtExp}
          min={0}
          max={4}
          step={0.5}
          onset={(v) => (settings.p.wtExp = v)}
        /> power
      </label>
      <label
        class="chk"
        title="How much of the run's score a zone, pooled with every faster zone, needs before it names the run. 50 would be a majority; lower leans towards the harder types."
      >
        Wins at <NumField
          value={p.wtShare}
          min={1}
          max={100}
          step={1}
          onset={(v) => (settings.p.wtShare = v)}
        /> % of score
      </label>
    {/if}
  </section>

  <section class="group">
    <h2 class="title">
      Volume &amp; frequency panels<Info
        >{winsN}-week rolling averages. Each line's colour is also its verdict colour: whichever line is
        highest on the day is what the bars are coloured by in verdict mode. Untick one to take it, and its
        window-start mark, off the panels; it stays in the readout.</Info
      >
    </h2>
    <div class="legend">
      <div
        class="legend-row"
        title="Hiding a line takes it off the panels and its window-start mark off every panel. It stays in the readout."
      >
        <span class="legend-tag">Lines</span>
        {#each SLOT_KEYS as k, slot (k)}
          <label class={['item', !p.lines[k] && 'off']}>
            <input type="checkbox" bind:checked={settings.p.lines[k]} /><span
              class="swatch line"
              style:background="var({WINDOW_CSS[slot]})"
            ></span>{winLabel(slot)}
          </label>
        {/each}
      </div>
    </div>
    <label class="chk"
      ><input
        type="checkbox"
        checked={p.panels.vol}
        onchange={(e) => setPanel('vol', e.currentTarget.checked)}
      /> Distance/week panel</label
    >
    <label class="chk"
      ><input
        type="checkbox"
        checked={p.panels.freq}
        onchange={(e) => setPanel('freq', e.currentTarget.checked)}
      /> Run days/week panel</label
    >
    <label class="chk"
      ><input
        type="checkbox"
        checked={p.panels.runs}
        onchange={(e) => setPanel('runs', e.currentTarget.checked)}
      /> Runs/week panel</label
    >
    <label
      class="chk"
      title="Every chunk scores hours × (km/h)², summed over the week, at the raw speed (the watch's own, never grade-adjusted): it measures the pounding of landing."
      ><input
        type="checkbox"
        checked={p.panels.sraw}
        onchange={(e) => setPanel('sraw', e.currentTarget.checked)}
      /> Raw stress/week panel</label
    >
    <label
      class="chk"
      title="Every chunk scores 100 × hours × (speed ÷ threshold speed)², so an hour at threshold is 100. Threshold speed is read off that day's VDOT."
      ><input
        type="checkbox"
        checked={p.panels.srel}
        onchange={(e) => setPanel('srel', e.currentTarget.checked)}
      /> Relative stress/week panel</label
    >
    <label
      class="chk"
      title="Weeks in the shortest of the four rolling windows. The other three follow from the multiple below."
    >
      Shortest window <NumField
        value={p.windowBase}
        min={1}
        max={8}
        step={1}
        onset={(v) => (settings.p.windowBase = v)}
      /> weeks
    </label>
    <label
      class="chk"
      title="Each window is this many times the one before it. Changing these moves the verdict colours too."
    >
      Next window × <NumField
        value={p.windowMult}
        min={2}
        max={8}
        step={1}
        onset={(v) => (settings.p.windowMult = v)}
      />
    </label>
    <label
      class="chk"
      title="Along every stretch, the highest of the four lines is drawn at full strength and the other three faded. Off draws all four at full strength, for comparing two windows against each other."
    >
      <input type="checkbox" bind:checked={settings.p.highlightMax} /> Highlight the highest line
    </label>
  </section>

  <section class="group">
    <h2 class="title">VDOT panel</h2>
    <label class="chk"
      ><input
        type="checkbox"
        checked={p.panels.vdot}
        onchange={(e) => setPanel('vdot', e.currentTarget.checked)}
      /> VDOT panel</label
    >
    <label class="chk"
      >VDOT window <NumField
        value={p.windowVdot}
        scale={1 / 7}
        min={1}
        max={260}
        step={1}
        onset={(v) => (settings.p.windowVdot = v)}
      /> weeks</label
    >
    <label
      class="chk"
      title="A lap (manual lap or workout step) shorter than this can't be trusted on its own for VDOT: too short and fast a rep overstates it wildly. The whole run is always checked too."
    >
      Min lap for VDOT <NumField
        value={p.minLapM}
        min={100}
        max={5000}
        step={100}
        onset={(v) => (settings.p.minLapM = v)}
      /> m
    </label>
    <label
      class="chk"
      title="Every workout's VDOT is multiplied by this. The watch tends to read a little fast; 0.98 takes 2% off. Moves the VDOT panel and, with it, where the pace-zone boundaries sit."
    >
      VDOT correction × <NumField
        value={p.vdotCorr}
        min={0.9}
        max={1}
        step={0.01}
        onset={(v) => (settings.p.vdotCorr = v)}
      />
    </label>
    <label
      class="chk"
      title="One dot per run day whose own reading is within the percentage below of the peak in force that day, drawn at the day's own value."
    >
      <input type="checkbox" bind:checked={settings.p.vdotNearDots} /> Mark near-max days
    </label>
    <label class="chk" title="0 marks only the days that set the peak; 100 marks every run day.">
      …within <NumField
        value={p.vdotNearPct}
        min={0}
        max={100}
        step={1}
        onset={(v) => (settings.p.vdotNearPct = v)}
      /> % of the peak
    </label>
    <label
      class="chk"
      title="Compute VDOT off the grade-adjusted (flat-equivalent) time instead of the time actually taken. Moves the VDOT panel and the pace-zone boundaries."
    >
      <input type="checkbox" bind:checked={settings.p.gapVdot} /> Grade-adjusted pace for VDOT
    </label>
  </section>

  <section class="group">
    <h2 class="title">
      Pace-zone volume<Info
        >One rolling window&rsquo;s running, split by which pace zone each chunk was run in, so the bands add
        up to that window&rsquo;s own distance-per-week line. Slowest band at the bottom, so the hard running
        is the band on top. Whole zones only, never the histogram&rsquo;s sub-bands.</Info
      >
    </h2>
    <div class="legend">
      <div class="legend-row">
        <span class="legend-tag">Zones</span>
        <span class="item"><span class="swatch" style:background={lead.standing}></span>standing</span>
        <span class="item"><span class="swatch" style:background={lead.walking}></span>walking</span>
        <span class="item"><span class="swatch" style:background={lead.recovery}></span>recovery</span>
        <span class="item"><span class="swatch" style:background="var(--z-easy)"></span>endurance</span>
        <span class="item"><span class="swatch" style:background="var(--z-marathon)"></span>marathon</span>
        <span class="item"><span class="swatch" style:background="var(--z-threshold)"></span>threshold</span>
        <span class="item"><span class="swatch" style:background="var(--z-interval)"></span>interval</span>
        <span class="item"><span class="swatch" style:background="var(--z-repetition)"></span>repetition</span
        >
      </div>
    </div>
    <label class="chk"
      ><input
        type="checkbox"
        checked={p.panels.zarea}
        onchange={(e) => setPanel('zarea', e.currentTarget.checked)}
      /> Pace-zone volume panel</label
    >
    <label
      class="chk"
      title="Which of the four rolling windows the stacked-zone panel (and the readout's zone table) is over."
    >
      Window <select bind:value={settings.p.zoneAreaWin}
        >{#each SLOT_KEYS as k, slot (k)}<option value={k}>{winLabel(slot)}</option>{/each}</select
      >
    </label>
    <label
      class="chk"
      title="What the bands measure: km or minutes per week in each zone, or each zone's share of the week."
    >
      Stack
      <select bind:value={settings.p.zoneAreaMode}>
        <option value="km">km / week</option><option value="min">minutes / week</option><option value="pctKm"
          >% of distance</option
        ><option value="pctMin">% of time</option>
      </select>
    </label>
  </section>

  <section class="group">
    <h2 class="title">Pace zones</h2>
    <label class="chk"
      ><input
        type="checkbox"
        checked={p.panels.zone}
        onchange={(e) => setPanel('zone', e.currentTarget.checked)}
      /> Pace-zone histogram</label
    >
    <label class="chk" title="How many sub-bands each of the five pace zones splits into.">
      Pace-zone bars <NumField
        value={p.zoneBars}
        min={1}
        max={20}
        step={1}
        onset={(v) => (settings.p.zoneBars = v)}
      /> per zone
    </label>
    <label class="chk" title="What each bar's height measures. The hover text always gives both.">
      Bar height <select bind:value={settings.p.zoneAxis}
        ><option value="time">time (min)</option><option value="dist">distance (km)</option></select
      >
    </label>
    <label
      class="chk"
      title="Runs are cut into chunks of at least this many seconds (never across a manual lap) before their speed is read; 0 reads every second on its own. Moves the histogram, the pace-zone volume, the workout types and the stress scores. VDOT reads whole laps and runs, so it doesn't move."
    >
      Min chunk length <SlowNumField
        value={p.chunkSec}
        min={0}
        max={60}
        step={1}
        onset={(v) => (settings.p.chunkSec = v)}
      /> s
    </label>
    <label
      class="chk"
      title="Bin each chunk by its grade-adjusted pace instead of the pace actually run. Only moves the chunks, never the zone boundaries."
    >
      <input type="checkbox" bind:checked={settings.p.gapPace} /> Grade-adjusted pace
    </label>
    <label
      class="chk"
      title="How strongly a climb counts: Minetti's energy cost curve to this power. 1 is pure Minetti (a 6% climb worth +36%), 0.83 is what Runalyze uses, 0.5 matches Garmin's own GAP best on my laps. Applies to the histogram, the pace-zone volume, the workout types, and VDOT when its own GAP setting is on."
    >
      GAP strength <SlowNumField
        value={p.gapExp}
        min={0.3}
        max={1}
        step={0.05}
        onset={(v) => (settings.p.gapExp = v)}
      />
    </label>
  </section>

  <section class="group">
    <h2 class="title">Data table</h2>
    <label class="chk"
      ><input
        type="checkbox"
        checked={p.panels.table}
        onchange={(e) => setPanel('table', e.currentTarget.checked)}
      /> Data table</label
    >
  </section>

  <button
    onclick={reset}
    title="Put every setting in this sidebar back to its default and the view back to the default span. Leaves the weekly target's numbers alone: that box has its own reset."
    >Reset</button
  >
</div>

<style>
  .settings {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }
  .title {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .legend {
    display: flex;
    flex-direction: column;
    gap: 3px;
    align-items: flex-start;
  }
  .legend-row {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .legend-tag {
    color: var(--text-secondary);
    font-weight: 600;
    min-width: 82px;
  }
  .item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .item.off {
    opacity: 0.4;
  }
  .item input {
    margin: 0;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
  }
  .swatch.line {
    width: 16px;
    height: 3px;
  }
</style>
