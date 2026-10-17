<script lang="ts">
  import type { Snippet } from 'svelte';
  import { info } from '../info.svelte';

  // The explanation is passed as children: <Info>…long text…</Info>
  let { children }: { children: Snippet } = $props();
  let icon: HTMLElement;
</script>

<span
  class="info"
  role="button"
  tabindex="0"
  aria-label="More information"
  bind:this={icon}
  onmouseenter={() => info.show(children, icon)}
  onmouseleave={() => info.hide()}
  onfocus={() => info.show(children, icon)}
  onblur={() => info.hide()}>i</span
>

<style>
  .info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid currentColor;
    font:
      600 9px/1 system-ui,
      -apple-system,
      sans-serif;
    font-style: normal;
    text-transform: none;
    letter-spacing: 0;
    color: var(--muted);
    cursor: help;
    vertical-align: middle;
    margin-left: 6px;
    user-select: none;
    translate: 0 -0.9px;
  }
  .info:hover,
  .info:focus-visible {
    color: var(--text-primary);
    outline: none;
  }
</style>
