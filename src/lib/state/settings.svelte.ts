import { defaultPrefs, loadPrefs, savePrefs, type Prefs } from './prefs';

/** Writes are batched: a burst of changes (dragging the zoom) is saved once it settles. */
const SAVE_DELAY_MS = 400;

/**
 * The display settings, reactive. Components read and write `settings.p.whatever`
 * directly (or `bind:` to it); every change is saved shortly afterwards.
 */
class SettingsStore {
  p = $state<Prefs>(loadPrefs());
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // An effect outside a component needs its own root. It re-runs whenever anything
    // inside `p` changes, because `$state.snapshot` reads every field.
    // https://svelte.dev/docs/svelte/$effect#$effect.root
    $effect.root(() => {
      $effect(() => {
        const snapshot = $state.snapshot(this.p);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => savePrefs(snapshot), SAVE_DELAY_MS);
      });
    });
  }

  /**
   * The sidebar's Reset: every setting back to its default, and the default zoom. Leaves
   * the weekly target's what-if alone: that box has its own reset.
   */
  resetAll(): void {
    const plan = this.p.plan;
    this.p = { ...defaultPrefs(), plan };
  }
}

export const settings = new SettingsStore();
