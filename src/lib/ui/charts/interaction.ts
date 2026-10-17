import { model } from '../../state/model.svelte';
import { view } from '../../state/view.svelte';
import { dayAt, PAD, plotW, type XMap } from './geometry';

/**
 * Pointer handling shared by every panel (they all drive the same view). Pointer Events
 * give mouse, pen and touch one code path:
 * - mouse: hover follows the pointer; click pins a day; drag pans;
 *   ⌘/Ctrl + wheel zooms about the cursor (a plain wheel scrolls the page, so the page
 *   stays scrollable over the chart); a trackpad pinch arrives as a ctrl-wheel and zooms;
 *   double-click resets the view;
 * - touch: no hover, so a tap selects (tap again to release); one-finger horizontal drag
 *   pans; two-finger pinch zooms; vertical swipes still scroll the page (`touch-action: pan-y`
 *   on the canvas).
 * A pan must never end in a pin: a press that moved more than DRAG_PX is a drag, not a click.
 * https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
 */
const DRAG_PX = 3;
/** Wheel delta → zoom factor; the legacy feel. */
const WHEEL_ZOOM = 0.0022;

interface Drag {
  x: number;
  center: number;
  moved: boolean;
  /** Started by holding the zoom key rather than a button: only the key ends it. */
  key: boolean;
}

let drag: Drag | null = null;
/** The last pointer position over a panel, for a key-started pan (a keydown has no coordinates). */
let lastPointer: { canvas: HTMLCanvasElement; x: number } | null = null;
const touches = new Map<number, number>(); // pointerId → clientX, for pinch
let pinch: { dist: number; span: number; frac: number; center: number } | null = null;

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const ZOOM_KEY = IS_MAC ? 'Meta' : 'Control';

const xmapOf = (canvas: HTMLCanvasElement): XMap => ({ width: canvas.clientWidth, view: view.state });
const localX = (canvas: HTMLCanvasElement, clientX: number) => clientX - canvas.getBoundingClientRect().left;

function dayUnder(canvas: HTMLCanvasElement, x: number): number | null {
  const m = xmapOf(canvas);
  const n = model.daily?.n ?? 0;
  const i = dayAt(m, x);
  return i >= 0 && i < n && x >= PAD.l && x <= m.width - PAD.r ? i : null;
}

const fracAt = (canvas: HTMLCanvasElement, x: number) =>
  Math.min(1, Math.max(0, (x - PAD.l) / plotW(xmapOf(canvas))));

function panTo(canvas: HTMLCanvasElement, x: number): void {
  if (!drag) return;
  if (Math.abs(x - drag.x) > DRAG_PX) drag.moved = true;
  const barW = plotW(xmapOf(canvas)) / view.span;
  view.panTo(drag.center - (x - drag.x) / barW);
}

/** A Svelte attachment: `<canvas {@attach chartPointer}>`. Returns its own cleanup. */
export function chartPointer(canvas: HTMLCanvasElement): () => void {
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') touches.set(e.pointerId, e.clientX);
    if (e.pointerType === 'touch' && touches.size === 2) return startPinch(canvas);
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { x: localX(canvas, e.clientX), center: view.center, moved: false, key: false };
    canvas.style.cursor = 'grabbing';
  };
  const onMove = (e: PointerEvent) => {
    const x = localX(canvas, e.clientX);
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, e.clientX);
    if (pinch) return movePinch();
    lastPointer = { canvas, x };
    if (drag) return panTo(canvas, x);
    if (e.pointerType !== 'touch') view.hover = dayUnder(canvas, x);
  };
  const onUp = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (!drag || drag.key) return;
    const wasClick = !drag.moved;
    drag = null;
    canvas.style.cursor = '';
    if (wasClick && e.type === 'pointerup') {
      const i = dayUnder(canvas, localX(canvas, e.clientX));
      if (i !== null) view.togglePin(i);
    }
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    lastPointer = null;
    if (!drag) view.hover = null;
  };
  const onWheel = (e: WheelEvent) => {
    if (!e.metaKey && !e.ctrlKey) return; // let the page scroll
    e.preventDefault();
    const x = localX(canvas, e.clientX);
    view.zoom(fracAt(canvas, x), Math.exp(e.deltaY * WHEEL_ZOOM));
    // Mid-pan, re-anchor on the zoomed view, or the next move would snap back.
    if (drag) [drag.x, drag.center] = [x, view.center];
    view.hover = dayUnder(canvas, x);
  };
  const onDbl = () => view.reset();

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('dblclick', onDbl);
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('dblclick', onDbl);
  };
}

function startPinch(canvas: HTMLCanvasElement): void {
  drag = null;
  const [a, b] = [...touches.values()] as [number, number];
  const mid = localX(canvas, (a + b) / 2);
  pinch = {
    dist: Math.max(1, Math.abs(a - b)),
    span: view.span,
    frac: fracAt(canvas, mid),
    center: view.center,
  };
}

/** The day under the fingers when the pinch started stays under them as the span scales. */
function movePinch(): void {
  if (!pinch || touches.size < 2) return;
  const [a, b] = [...touches.values()] as [number, number];
  const span = pinch.span * (pinch.dist / Math.max(1, Math.abs(a - b)));
  const anchor = pinch.center - pinch.span / 2 + pinch.frac * pinch.span;
  view.set({ span, center: anchor + (0.5 - pinch.frac) * span });
}

/**
 * Holding the zoom key is holding the mouse button: pressed with the pointer over a panel
 * it starts a pan from there; releasing it (or leaving the window) ends it. Wired once on
 * the window by the chart card.
 */
export function onZoomKeyDown(e: KeyboardEvent): void {
  if (e.key !== ZOOM_KEY || e.repeat || drag || !lastPointer) return;
  drag = { x: lastPointer.x, center: view.center, moved: false, key: true };
  lastPointer.canvas.style.cursor = 'grabbing';
}

export function onZoomKeyUp(e: KeyboardEvent | FocusEvent): void {
  if (e instanceof KeyboardEvent && e.key !== ZOOM_KEY) return;
  if (!drag?.key) return;
  drag = null;
  if (lastPointer) lastPointer.canvas.style.cursor = '';
}

/** While a key pan is on, plain pointer moves pan. */
export const keyPanActive = (): boolean => drag?.key === true;
