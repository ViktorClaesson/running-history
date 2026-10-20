import { describe, expect, it } from 'vitest';
import { keyAction } from '../../src/lib/ui/keys';

const press = (key: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe('E31 keyboard shortcuts', () => {
  it('maps 1–4, r, t and Escape', () => {
    expect(keyAction(press('1'), false)).toEqual({ kind: 'window', slot: 0 });
    expect(keyAction(press('4'), false)).toEqual({ kind: 'window', slot: 3 });
    expect(keyAction(press('r'), false)).toEqual({ kind: 'reset' });
    expect(keyAction(press('R'), false)).toEqual({ kind: 'reset' }); // Caps Lock or Shift
    expect(keyAction(press('t'), false)).toEqual({ kind: 'unpin' });
    expect(keyAction(press('Escape'), false)).toEqual({ kind: 'unpin' });
  });

  it('leaves everything else alone', () => {
    for (const k of ['5', '0', 'x', 'Enter', ' ', 'ArrowLeft']) expect(keyAction(press(k), false)).toBeNull();
  });

  it('never steals a modified press (⌘R still reloads) or a letter typed into a field', () => {
    expect(keyAction(press('r', { metaKey: true }), false)).toBeNull();
    expect(keyAction(press('r', { ctrlKey: true }), false)).toBeNull();
    expect(keyAction(press('1', { altKey: true }), false)).toBeNull();
    expect(keyAction(press('r'), true)).toBeNull();
  });
});
