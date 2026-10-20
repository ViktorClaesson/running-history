import { todo, whenDone } from '../../exercise';
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
 *
 * Hover, wheel zoom and double-click are wired in `chartPointer`; pressing, dragging,
 * releasing and pinching are the functions below it (exercise E33 on the exercise branch).
 */
export const DRAG_PX = 3;
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

/*
 * TODO(E33) · pan, tap and pinch · difficulty ★★★ · phase 5 · checked in the app, no tests
 * Five handlers, called by chartPointer below (which already does hover, wheel zoom and
 * double-click, and keeps `touches`: pointerId → clientX for every finger down):
 *   startDrag(canvas, e)  a primary press (e.button 0) starts a drag: capture the pointer
 *                         (setPointerCapture, so the drag continues outside the canvas), remember
 *                         where it started and the view's centre in `drag`, cursor 'grabbing'.
 *   panTo(canvas, x)      mid-drag: move the view so the day grabbed stays under the pointer
 *                         (pixels moved ÷ bar width = days); once it has moved more than DRAG_PX,
 *                         mark the drag as moved.
 *   endDrag(canvas, e)    end a pointer drag (not one started by the zoom key); if it never
 *                         moved and this is a pointerup (not a pointercancel), it was a click:
 *                         toggle the pin on the day under it (view.togglePin).
 *   startPinch(canvas)    a second finger: cancel any drag; remember the two fingers' distance,
 *                         the span, the centre, and the frac (fracAt) of the point between them.
 *   movePinch()           the span scales by start distance ÷ current distance; place the centre
 *                         so the day that was under the fingers stays under them (as in E28).
 * Edge cases that matter, and why:
 * - A pan must never end in a pin: that's what the DRAG_PX guard is for.
 * - Touch has no hover, so a tap pins (tap again to release). Vertical swipes still scroll the
 *   page because the canvas has `touch-action: pan-y`.
 * Background: legacy/CLAUDE.md, "The readout: pinning…" and "Gotchas that have bitten before"
 * ("Holding the key is holding the mouse button").
 * Concepts:
 * - Pointer Events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
 * - setPointerCapture: https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
 * - touch-action: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
 * - Svelte attachments ({@attach}): https://svelte.dev/docs/svelte/@attach
 * Check in the app (desktop): drag the chart sideways, it follows the mouse; click a bar, it
 * pins (the readout says "pinned"); a drag that ends on a bar doesn't pin it. On a phone, or
 * Chrome DevTools' device mode with touch: tap pins, one-finger drag pans, two fingers zoom.
 * Spoiler: `onMove()`, `onTouchStart()` and `onTouchMove()` in legacy/running-history.html.
 */
/** Pointer down (not the second finger of a pinch): a primary press starts a drag. */
function startDrag(canvas: HTMLCanvasElement, e: PointerEvent): void {
  todo('E33', canvas, e);
}

/** Mid-drag: the day grabbed stays under the pointer. Past DRAG_PX it counts as a drag, not a click. */
function panTo(canvas: HTMLCanvasElement, x: number): void {
  todo('E33', canvas, x);
}

/** Pointer up (or cancelled): ends a drag; a press that never moved is a click, and pins the day. */
function endDrag(canvas: HTMLCanvasElement, e: PointerEvent): void {
  todo('E33', canvas, e);
}

/** Runs a handler that is (part of) exercise E33, doing nothing until it is written. */
const unlessTodo = (f: () => void) => whenDone(f, () => {});

/** A Svelte attachment: `<canvas {@attach chartPointer}>`. Returns its own cleanup. */
export function chartPointer(canvas: HTMLCanvasElement): () => void {
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') touches.set(e.pointerId, e.clientX);
    if (e.pointerType === 'touch' && touches.size === 2) unlessTodo(() => startPinch(canvas));
    else unlessTodo(() => startDrag(canvas, e));
  };
  const onMove = (e: PointerEvent) => {
    const x = localX(canvas, e.clientX);
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, e.clientX);
    if (pinch) return unlessTodo(movePinch);
    lastPointer = { canvas, x };
    if (drag) return unlessTodo(() => panTo(canvas, x));
    if (e.pointerType !== 'touch') view.hover = dayUnder(canvas, x);
  };
  const onUp = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    unlessTodo(() => endDrag(canvas, e));
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

/** A second finger went down: from now on the two fingers zoom, anchored between them. */
function startPinch(canvas: HTMLCanvasElement): void {
  todo('E33', canvas);
}

/** The day under the fingers when the pinch started stays under them as the span scales. */
function movePinch(): void {
  todo('E33');
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
