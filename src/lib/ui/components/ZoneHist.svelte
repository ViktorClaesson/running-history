<script lang="ts">
  import {
    binVelocityRange,
    RECOVERY_BIN,
    STANDING_BIN,
    WALKING_BIN,
    ZONE_BIN_OFFSET,
    ZONES,
  } from '../../domain/paceZones';
  import { fitCanvas } from '../charts/frame';
  import { binAt, drawZoneHistogram } from '../charts/zoneHistogram';
  import { paceOfVel } from '../format';
  import { theme } from '../theme.svelte';

  interface Props {
    mins: Float64Array;
    km: Float64Array;
    zoneBars: number;
    maxVal: number;
    byDist: boolean;
    /** The day's VDOT; null on an empty stand-in day (no hover then). */
    vdot: number | null;
  }
  let { mins, km, zoneBars, maxVal, byDist, vdot }: Props = $props();

  let canvas: HTMLCanvasElement;
  let width = $state(0);
  let hoverBin = $state<number | null>(null);

  $effect(() => {
    const ro = new ResizeObserver(() => (width = canvas.clientWidth));
    ro.observe(canvas);
    return () => ro.disconnect();
  });

  $effect(() => {
    if (!width) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = fitCanvas(canvas, ctx);
    drawZoneHistogram(ctx, w, h, theme.current, {
      values: byDist ? km : mins,
      zoneBars,
      maxVal,
      axisLabel: byDist ? 'km' : 'minutes',
      hoverBin,
    });
  });

  /** "Marathon 1 · 4:32–4:24/km · 3.2 min · 0.60 km" (both measures, whichever the bars use). */
  const hoverText = $derived.by(() => {
    if (hoverBin === null || vdot === null) return vdot === null ? ' ' : 'Hover a bar to see its pace range';
    const b = hoverBin;
    const r = binVelocityRange(b, vdot, zoneBars);
    const amount = `${mins[b]!.toFixed(1)} min · ${km[b]!.toFixed(2)} km`;
    const range =
      r.hi === null
        ? `faster than ${paceOfVel(r.lo)}/km`
        : b === STANDING_BIN
          ? `slower than ${paceOfVel(r.hi)}/km`
          : `${paceOfVel(r.lo)}–${paceOfVel(r.hi)}/km`;
    const name =
      b === STANDING_BIN
        ? 'Standing'
        : b === WALKING_BIN
          ? 'Walking'
          : b === RECOVERY_BIN
            ? 'Recovery'
            : `${ZONES[Math.floor((b - ZONE_BIN_OFFSET) / zoneBars)]!.label} ${(b - ZONE_BIN_OFFSET) % zoneBars}`;
    return `${name} · ${range} · ${amount}`;
  });

  function onMove(e: PointerEvent) {
    if (vdot === null) return;
    hoverBin = binAt(e.clientX - canvas.getBoundingClientRect().left, width, zoneBars);
  }
</script>

<div class="zone-hover">{hoverText}</div>
<canvas bind:this={canvas} onpointermove={onMove} onpointerleave={() => (hoverBin = null)}></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 220px;
  }
  .zone-hover {
    padding: 0 4px 8px;
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
    min-height: 1lh;
  }
</style>
