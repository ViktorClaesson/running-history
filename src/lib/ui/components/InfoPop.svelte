<script lang="ts">
  import { info } from '../info.svelte';

  let pop: HTMLDivElement | undefined = $state();
  let pos = $state({ x: 0, y: 0 });

  // Placing the popover needs its own size, which only exists once it has rendered:
  // an $effect runs after the DOM update, so it can measure and then position.
  $effect(() => {
    const o = info.open;
    if (!o || !pop) return;
    const pr = pop.getBoundingClientRect();
    const gap = 6;
    const x = Math.min(Math.max(8, o.anchor.left - 10), innerWidth - pr.width - 8);
    let y = o.anchor.bottom + gap;
    if (y + pr.height > innerHeight - 8) y = Math.max(8, o.anchor.top - gap - pr.height);
    pos = { x, y };
  });
</script>

<svelte:window onscroll={() => info.hide()} />

{#if info.open}
  <div class="pop" bind:this={pop} style:left="{pos.x}px" style:top="{pos.y}px">
    {@render info.open.content()}
  </div>
{/if}

<style>
  .pop {
    position: fixed;
    z-index: 30;
    max-width: 320px;
    padding: 10px 12px;
    background: var(--surface-1);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    font-size: 12px;
    line-height: 1.5;
    pointer-events: none;
  }
  .pop :global(p) {
    margin: 0;
  }
  .pop :global(p + p) {
    margin-top: 6px;
  }
  .pop :global(.eq) {
    font-variant-numeric: tabular-nums;
    color: var(--text-primary);
  }
</style>
