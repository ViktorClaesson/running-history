<script lang="ts">
  import { dateAt } from '../../domain/daily';
  import { fmtDate } from '../../domain/dates';
  import { model } from '../../state/model.svelte';
  import type { PanelKey } from '../../state/prefs';
  import { settings } from '../../state/settings.svelte';
  import { view } from '../../state/view.svelte';
  import { barSegments } from '../barColours';
  import { drawBars } from '../charts/barsPanel';
  import type { Frame } from '../charts/frame';
  import { leftDay } from '../charts/geometry';
  import { IS_MAC, onZoomKeyDown, onZoomKeyUp } from '../charts/interaction';
  import { bucketColours } from '../charts/ramps';
  import { drawVdot } from '../charts/vdotPanel';
  import { drawWindowPanel } from '../charts/windowPanel';
  import { drawZoneArea } from '../charts/zoneAreaPanel';
  import { theme } from '../theme.svelte';
  import Info from './Info.svelte';
  import Panel from './Panel.svelte';
  import { layout } from '../layout.svelte';

  const zoomKey = IS_MAC ? '⌘' : 'Ctrl';
  const p = $derived(settings.p);
  const winsN = $derived(model.windows.map((w) => w.weeks).join(' / '));

  // Panels in page order; the lowest one shown carries the date labels.
  type ChartPanel = 'bars' | Exclude<PanelKey, 'zone' | 'table' | 'target'>;
  const ORDER: ChartPanel[] = ['bars', 'vol', 'freq', 'runs', 'sraw', 'srel', 'vdot', 'zarea'];
  const bottom = $derived([...ORDER].reverse().find((k) => k === 'bars' || p.panels[k]) ?? 'bars');

  let dashSeen = $state(false);

  function frame(panel: ChartPanel, ctx: CanvasRenderingContext2D, w: number, h: number): Frame | null {
    const daily = model.daily;
    if (!daily) return null;
    return {
      ctx,
      width: w,
      height: h,
      x: { width: w, view: { span: view.span, center: view.center } },
      n: daily.n,
      hover: view.hover,
      selected: view.selected,
      theme: theme.current,
      isBottom: bottom === panel,
      dateAt: (i) => dateAt(daily, i),
    };
  }

  const visible = $derived(model.windows.map((w) => p.lines[w.key]));
  const windowDays = $derived(model.windows.map((w) => w.days));

  function windowPanel(
    panel: ChartPanel,
    series: readonly Float64Array[] | undefined,
    axisLabel: string,
    fixed7 = false,
  ) {
    return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const f = frame(panel, ctx, w, h);
      if (!f || !series) return;
      drawWindowPanel(f, { series, visible, highlight: p.highlightMax, fixed7, axisLabel, windowDays });
    };
  }

  // The chart card's title names the first and last day with any of its bar in view.
  const title = $derived.by(() => {
    const d = model.daily;
    if (!d) return 'Training history';
    const a = Math.max(0, Math.floor(leftDay({ width: 1, view: view.state })));
    const b = Math.min(d.n - 1, Math.ceil(view.center + view.span / 2) - 1);
    return `Training history from ${fmtDate(dateAt(d, a))} to ${fmtDate(dateAt(d, b))}`;
  });

  const zaMeasure = $derived(
    { km: 'Distance per week', min: 'Time per week', pctKm: 'Share of distance', pctMin: 'Share of time' }[
      p.zoneAreaMode
    ],
  );
  const zaAxis = $derived(
    { km: 'km / week', min: 'min / week', pctKm: '% of km', pctMin: '% of time' }[p.zoneAreaMode],
  );
  const vdotNote = $derived(
    !p.vdotNearDots
      ? ''
      : p.vdotNearPct === 0
        ? ' — dots: the days that set it'
        : ` — dots: days within ${p.vdotNearPct}% of it${dashSeen ? ', above the dashed line' : ''}`,
  );
</script>

<svelte:window onkeydown={onZoomKeyDown} onkeyup={onZoomKeyUp} onblur={onZoomKeyUp} />

<div class="card chartcard">
  <h2 class="chart-title">
    {title}<Info>
      <p>
        Hold <kbd>{zoomKey}</kbd> and scroll, or pinch, to zoom (a plain scroll just scrolls the page); the
        day under the cursor stays put. Drag to pan, or hold <kbd>{zoomKey}</kbd> and move the mouse.
        Double-click, or press
        <kbd>r</kbd>, for the default view; <kbd>1</kbd>–<kbd>4</kbd> zoom to each window, ending on the most recent
        day. The zoom is remembered.
      </p>
      <p>
        Click a day to pin it in the readout; click it again, or press <kbd>t</kbd> or Esc, to release. The coloured
        dots mark where each window reaches back to: filled from the hovered day, hollow from the pinned one, a
        chevron at the left edge for a window that reaches past what's drawn.
      </p>
    </Info>
  </h2>

  <Panel
    height={300}
    draw={(ctx, w, h) => {
      const f = frame('bars', ctx, w, h);
      if (!f || !model.daily) return;
      const t = f.theme;
      drawBars(f, {
        km: model.daily.km,
        segments: (i) => barSegments(i, t),
        scale: p.barScale,
        capKm: p.barCap ? p.barCapKm : null,
        marks: model.windows
          .filter((w) => p.lines[w.key])
          .map((w) => ({ days: w.days, colour: t.windows[w.slot]!, slot: w.slot, yAt: null })),
      });
    }}
  >
    {#snippet title()}Distance per day{/snippet}
  </Panel>

  {#if p.panels.vol}
    <Panel height={layout.phone ? 130 : 156} draw={windowPanel('vol', model.series?.vol, 'km / week')}>
      {#snippet title()}Distance per week — {winsN}-week rolling averages{/snippet}
    </Panel>
  {/if}
  {#if p.panels.freq}
    <Panel
      height={layout.phone ? 130 : 156}
      draw={windowPanel('freq', model.series?.freq, 'run days / week', true)}
    >
      {#snippet title()}Run days per week — {winsN}-week rolling averages{/snippet}
    </Panel>
  {/if}
  {#if p.panels.runs}
    <Panel height={layout.phone ? 130 : 156} draw={windowPanel('runs', model.series?.runs, 'runs / week')}>
      {#snippet title()}Runs per week — {winsN}-week rolling averages{/snippet}
    </Panel>
  {/if}
  {#if p.panels.sraw}
    <Panel
      height={layout.phone ? 130 : 156}
      draw={windowPanel('sraw', model.stressSeries?.raw, 'raw / week')}
    >
      {#snippet title()}Raw stress score per week — {winsN}-week rolling averages{/snippet}
    </Panel>
  {/if}
  {#if p.panels.srel}
    <Panel
      height={layout.phone ? 130 : 156}
      draw={windowPanel('srel', model.stressSeries?.rel, 'rel. / week')}
    >
      {#snippet title()}Relative stress score per week — {winsN}-week rolling averages{/snippet}
    </Panel>
  {/if}
  {#if p.panels.vdot}
    <Panel
      height={156}
      draw={(ctx, w, h) => {
        const f = frame('vdot', ctx, w, h);
        if (!f || !model.vdotDays) return;
        dashSeen = drawVdot(f, {
          vdot: model.vdot,
          dayValue: model.vdotDays.value,
          nearDots: p.vdotNearDots,
          nearPct: p.vdotNearPct,
          windowDays: p.windowVdot,
        }).dashSeen;
      }}
    >
      {#snippet title()}Highest VDOT in the trailing {p.windowVdot} days{vdotNote}{/snippet}
    </Panel>
  {/if}
  {#if p.panels.zarea}
    <Panel
      height={156}
      draw={(ctx, w, h) => {
        const f = frame('zarea', ctx, w, h);
        const za = model.zoneArea;
        if (!f || !za) return;
        const k = model.zoneAreaSlot;
        drawZoneArea(f, {
          bands: za.bands,
          total: za.total,
          pct: p.zoneAreaMode.startsWith('pct'),
          colours: bucketColours(f.theme),
          axisLabel: zaAxis,
          windowDays: model.windows[k]!.days,
          windowColour: f.theme.windows[k]!,
        });
      }}
    >
      {#snippet title()}{zaMeasure} by pace zone — {model.windows[model.zoneAreaSlot]?.label} rolling{/snippet}
    </Panel>
  {/if}

  <div class="hint" hidden={layout.phone}>
    <kbd>{zoomKey}</kbd>+scroll zoom · hold <kbd>{zoomKey}</kbd> pan · <kbd>1</kbd>–<kbd>4</kbd> zoom to
    window ·
    <kbd>r</kbd> reset view · <kbd>t</kbd> release pin
  </div>
</div>

<style>
  .chartcard {
    padding: 12px 12px 8px;
  }
  .chart-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 6px;
    padding-left: 4px;
    color: var(--text-primary);
  }
  .hint {
    padding: 6px 4px 0;
    font-size: 11px;
    color: var(--muted);
  }
  kbd {
    font: inherit;
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0 3px;
    color: var(--text-secondary);
  }
</style>
