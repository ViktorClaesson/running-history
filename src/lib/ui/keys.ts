/**
 * Keys for what's worth doing without aiming: 1–4 zoom to a window, r resets the view, t
 * or Esc releases the pin (legacy/CLAUDE.md, "Remembered settings", the **Keys** paragraph).
 * The mapping is a pure function so it can be tested; App.svelte listens on the window and
 * carries the action out.
 */
export type KeyAction = { kind: 'reset' } | { kind: 'window'; slot: number } | { kind: 'unpin' };

/** The parts of a KeyboardEvent the mapping reads. */
export type KeyPress = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>;

/**
 * The action for a key press, or null to leave it alone. Modified presses are left alone
 * (⌘R still reloads), and so is anything typed into a field (`typing`), where "r" is just
 * a letter. Letters work with Caps Lock or Shift too.
 */
export function keyAction(e: KeyPress, typing: boolean): KeyAction | null {
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return null;
  const k = e.key.toLowerCase();
  if (k === 'r') return { kind: 'reset' };
  if (/^[1-4]$/.test(k)) return { kind: 'window', slot: Number(k) - 1 };
  if (k === 'escape' || k === 't') return { kind: 'unpin' };
  return null;
}

/** Whether a key press lands in something you type into. */
export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName))
  );
}
