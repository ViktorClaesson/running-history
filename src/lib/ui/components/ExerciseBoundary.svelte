<script lang="ts">
  import type { Snippet } from 'svelte';
  import { isNotDone } from '../../exercise';

  /**
   * Wraps a part of the page that may need an exercise that isn't done yet (learning mode,
   * see src/lib/exercise.ts). If anything inside throws ExerciseNotDoneError, this shows
   * "Exercise E04 not done yet: window series" in its place and the rest of the page carries
   * on. Any other error shows its message too, rather than taking the page down, and goes
   * to the console. https://svelte.dev/docs/svelte/svelte-boundary
   *
   * Renders no element of its own, so it changes nothing about the layout when all is well.
   */
  interface Props {
    children: Snippet;
    /** Keep the placeholder this tall (CSS px), e.g. a chart panel's height. */
    height?: number;
    /** A card of its own (with the card's padding), for things that are a card. */
    card?: boolean;
  }
  let { children, height, card = false }: Props = $props();

  function onerror(e: unknown) {
    if (!isNotDone(e)) console.error(e);
  }
</script>

<svelte:boundary {onerror}>
  {@render children()}

  {#snippet failed(error)}
    <div class={['todo', card && 'card']} style:min-height={height ? `${height}px` : undefined}>
      {#if isNotDone(error)}
        <span><b>Exercise {error.id}</b>{error.message.slice(`Exercise ${error.id}`.length)}</span>
      {:else}
        <span>This part failed: {error instanceof Error ? error.message : String(error)}</span>
      {/if}
    </div>
  {/snippet}
</svelte:boundary>

<style>
  .todo {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    margin: 4px 0;
    border: 1px dashed var(--border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--muted);
    box-sizing: border-box;
  }
  .todo.card {
    margin: 0 0 16px;
    padding: 14px 16px;
  }
  b {
    font-weight: 600;
    color: var(--text-secondary);
  }
</style>
