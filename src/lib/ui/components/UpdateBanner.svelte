<script lang="ts">
  import { updates } from '../updates.svelte';
</script>

{#if updates.needRefresh}
  <div class="banner" role="status">
    A new version is ready. <button class="primary" onclick={() => updates.reload()}>Reload</button>
    <button onclick={() => (updates.needRefresh = false)}>Later</button>
  </div>
{/if}

<style>
  .banner {
    position: fixed;
    left: 50%;
    bottom: 20px;
    translate: -50% 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    font-size: 13px;
  }
</style>
