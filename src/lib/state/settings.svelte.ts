import { whenDone } from '../exercise';
import { PHONE_QUERY } from '../ui/layout.svelte';
import { defaultPrefs, loadPrefs, savePrefs, type Prefs } from './prefs';

/** Which defaults apply is decided once, at startup: a phone starts with fewer panels. */
const PHONE = typeof matchMedia !== 'undefined' && matchMedia(PHONE_QUERY).matches;

/** Writes are batched: a burst of changes (dragging the zoom) is saved once it settles. */
const SAVE_DELAY_MS = 400;

/**
 * The display settings, reactive. Components read and write `settings.p.whatever`
 * directly (or `bind:` to it); every change is saved shortly afterwards. Until exercise E26
 * is done they start from the defaults and aren't saved.
 */
class SettingsStore {
  p = $state<Prefs>(
    whenDone(
      () => loadPrefs(localStorage, PHONE),
      () => defaultPrefs(PHONE),
    ),
  );
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // An effect outside a component needs its own root. It re-runs whenever anything
    // inside `p` changes, because `$state.snapshot` reads every field.
    // https://svelte.dev/docs/svelte/$effect#$effect.root
    $effect.root(() => {
      $effect(() => {
        const snapshot = $state.snapshot(this.p);
        clearTimeout(this.timer);
        this.timer = setTimeout(
          () =>
            whenDone(
              () => savePrefs(snapshot, localStorage, PHONE),
              () => {},
            ),
          SAVE_DELAY_MS,
        );
      });
    });
  }

  /**
   * The sidebar's Reset: every setting back to its default, and the default zoom. Leaves
   * the weekly target's what-if alone: that box has its own reset.
   */
  resetAll(): void {
    const plan = this.p.plan;
    this.p = { ...defaultPrefs(PHONE), plan };
  }
}

export const settings = new SettingsStore();
