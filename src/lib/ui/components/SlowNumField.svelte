<script lang="ts">
  import { tick } from 'svelte';

  /**
   * A number setting whose change is expensive (it rebuilds every run's chunks). Typing or
   * clicking the arrows only schedules the change: it applies DEBOUNCE_MS after the last
   * edit. While it applies, the box is locked and a spinner shows beside it.
   */
  const DEBOUNCE_MS = 1000;

  interface Props {
    value: number;
    min: number;
    max: number;
    step: number;
    onset: (v: number) => void;
  }
  let { value, min, max, step, onset }: Props = $props();

  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const decimals = $derived(step < 1 ? String(step).split('.')[1]!.length : 0);
  const shown = $derived(String(+value.toFixed(decimals)));

  function schedule(el: HTMLInputElement) {
    const v = Math.round(el.valueAsNumber / step) * step;
    clearTimeout(timer);
    if (el.value === '' || !Number.isFinite(v) || v < min || v > max) return; // half-typed: wait
    timer = setTimeout(() => void apply(+v.toFixed(10)), DEBOUNCE_MS);
  }

  async function apply(v: number) {
    if (v === value) return;
    busy = true;
    // Let the spinner paint before the (synchronous) recompute takes over the main thread.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    onset(v);
    // Svelte recomputes and redraws everything that read the setting during this flush.
    await tick();
    busy = false;
  }
</script>

<span class="slow">
  <input
    type="number"
    {min}
    {max}
    {step}
    disabled={busy}
    value={shown}
    oninput={(e) => schedule(e.currentTarget)}
    onchange={(e) => schedule(e.currentTarget)}
  />
  {#if busy}<span class="spinner" role="status" aria-label="Recomputing"></span>{/if}
</span>

<style>
  .slow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  /* A transform animation runs on the compositor, so it keeps turning while the main thread is busy. */
  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--grid);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2.4s;
    }
  }
</style>
