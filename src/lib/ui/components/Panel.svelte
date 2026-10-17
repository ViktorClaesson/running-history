<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fitCanvas } from '../charts/frame';
  import { chartPointer } from '../charts/interaction';

  interface Props {
    /** CSS height of the canvas. */
    height: number;
    title?: Snippet;
    /** Draws the panel. Runs inside an effect, so everything it reads is tracked. */
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  }
  let { height, title, draw }: Props = $props();

  let canvas: HTMLCanvasElement;
  let width = $state(0);

  // Watch the canvas's size: a resize changes `width`, which re-runs the draw effect below.
  // https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
  $effect(() => {
    const ro = new ResizeObserver(() => (width = canvas.clientWidth));
    ro.observe(canvas);
    return () => ro.disconnect();
  });

  // Redraw whenever anything `draw` reads changes (the view, the model, the settings, the
  // theme) or the size does. Svelte tracks those reads for us.
  $effect(() => {
    if (!width) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h } = fitCanvas(canvas, ctx);
    draw(ctx, w, h);
  });
</script>

{#if title}<div class="panel-title">{@render title()}</div>{/if}
<canvas bind:this={canvas} style:height="{height}px" {@attach chartPointer}></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    /* Vertical swipes scroll the page; horizontal drags and pinches are ours. */
    touch-action: pan-y;
    cursor: crosshair;
  }
  .panel-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    padding: 4px 0 2px 54px;
  }
</style>
