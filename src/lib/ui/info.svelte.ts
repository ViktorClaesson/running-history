import type { Snippet } from 'svelte';

/**
 * The one shared popover behind every (i). Shared and `position: fixed`, because the
 * sidebars scroll and would clip anything positioned inside them.
 */
class InfoStore {
  open = $state<{ content: Snippet; anchor: DOMRect } | null>(null);

  show(content: Snippet, anchor: Element): void {
    this.open = { content, anchor: anchor.getBoundingClientRect() };
  }

  hide(): void {
    this.open = null;
  }
}

export const info = new InfoStore();
