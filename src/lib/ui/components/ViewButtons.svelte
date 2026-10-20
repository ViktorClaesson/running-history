<script lang="ts">
  import { model } from '../../state/model.svelte';
  import { view } from '../../state/view.svelte';

  // On a phone there is no keyboard, so the key shortcuts get buttons: 1–4 zoom to a
  // window, reset the view, release the pin.
</script>

<div class="buttons">
  {#each model.windowsOrNone as w (w.key)}
    <button onclick={() => view.zoomToWindow(w.slot)} title="Zoom to the {w.label} window">{w.label}</button>
  {/each}
  <button onclick={() => view.reset()}>Reset</button>
  <button disabled={view.selected === null} onclick={() => (view.selected = null)}>Unpin</button>
</div>

<style>
  .buttons {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    padding: 8px 4px 2px;
  }
  button {
    min-height: 44px;
    min-width: 44px;
    font-size: 13px;
  }
</style>
