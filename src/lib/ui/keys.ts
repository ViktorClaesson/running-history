import { todo } from '../exercise';
/**
 * Keys for what's worth doing without aiming: 1–4 zoom to a window, r resets the view, t
 * or Esc releases the pin (legacy/CLAUDE.md, "Remembered settings", the **Keys** paragraph).
 * The mapping is a pure function so it can be tested; App.svelte listens on the window and
 * carries the action out.
 */
export type KeyAction = { kind: 'reset' } | { kind: 'window'; slot: number } | { kind: 'unpin' };

/** The parts of a KeyboardEvent the mapping reads. */
export type KeyPress = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>;

/*
 * TODO(E31) · keyboard shortcuts · difficulty ★☆☆ · phase 5
 *   keyAction(e, typing)
 *     1–4 → { kind: 'window', slot: 0–3 } · r → { kind: 'reset' } · t or Escape → { kind:
 *     'unpin' } · anything else → null. Letters case-insensitively.
 * Edge cases that matter, and why:
 * - A press with Ctrl, ⌘ (metaKey) or Alt held is left alone: ⌘R must still reload.
 * - typing (the key landed in an input, select or textarea) → null: there "r" is just a letter.
 * Background: legacy/CLAUDE.md, "Remembered settings" (the **Keys** paragraph).
 * Concepts:
 * - KeyboardEvent.key: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
 * - discriminated unions: https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions
 * Check: npm run exercise E31 (tests/ui/keys.test.ts). In the app 1–4, r, t and Esc work.
 * Spoiler: the `keydown` listeners in legacy/running-history.html.
 */
/**
 * The action for a key press, or null to leave it alone. Modified presses are left alone
 * (⌘R still reloads), and so is anything typed into a field (`typing`), where "r" is just
 * a letter. Letters work with Caps Lock or Shift too.
 */
export function keyAction(e: KeyPress, typing: boolean): KeyAction | null {
  return todo('E31', e, typing);
}

/** Whether a key press lands in something you type into. */
export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName))
  );
}
