import { whenDone } from '../exercise';
import { dayNumber, type IsoDate } from '../domain/dates';
import type { Window } from '../domain/windows';
import { clampView, zoomAbout, type ViewState } from '../ui/charts/geometry';
import type { SavedView } from './prefs';
import { settings } from './settings.svelte';

/** Each animation frame closes this fraction of the gap to the target (legacy feel). */
const EASE = 0.25;

/**
 * What the chart is looking at: the zoom/pan (`span` days around `center`), the day
 * under the pointer (`hover`) and the pinned day (`selected`).
 *
 * The view is remembered as `{span, right}` with `right` a date (days since 1970), so it
 * survives a re-sync that adds days; `right` is null when the view runs to the newest day,
 * so it keeps doing that as the history grows. See legacy/CLAUDE.md, "The default view".
 */
class ViewStore {
  span = $state(560);
  center = $state(0);
  hover = $state<number | null>(null);
  selected = $state<number | null>(null);
  private n = 0;
  private startDay = 0;
  private windows: readonly Window[] = [];
  private target: ViewState | null = null;
  private frame = 0;

  /**
   * Called when the history is known, and again whenever it grows or the windows change.
   * A view parked at the newest day stays there as days are added; changing the windows
   * moves what "default" means but deliberately doesn't re-fit the current view.
   */
  setContext(n: number, start: IsoDate, windows: readonly Window[]): void {
    const prevN = this.n;
    const firstTime = prevN === 0;
    const wasAtEnd = !firstTime && this.center + this.span / 2 >= prevN - 0.5;
    this.n = n;
    this.startDay = dayNumber(start);
    this.windows = windows;
    if (firstTime) this.apply(this.fromSaved(settings.p.view));
    else if (wasAtEnd && n !== prevN) this.apply({ span: this.span, center: n - this.span / 2 });
  }

  get state(): ViewState {
    return { span: this.span, center: this.center };
  }

  /** The zoom that `1`–`4` and the default use: window k plus the next one down. */
  windowSpan(k: number): number {
    const w = this.windows[k];
    if (!w) return Math.min(this.n, 560);
    return Math.max(5, Math.min(this.n, w.days * (1 + 1 / settings.p.windowMult)));
  }

  get defaultSpan(): number {
    return this.windowSpan(this.windows.length - 1);
  }

  zoomToWindow(k: number): void {
    const span = this.windowSpan(k);
    this.animateTo({ span, center: this.n - span / 2 });
  }

  reset(): void {
    this.zoomToWindow(this.windows.length - 1);
  }

  /** Cursor-anchored zoom; `factor` > 1 zooms out. Does nothing until exercise E28 is done. */
  zoom(frac: number, factor: number): void {
    this.stopAnimation();
    this.apply(
      whenDone(
        () => zoomAbout(this.state, frac, factor, this.n),
        () => this.state,
      ),
    );
  }

  /** Moves the view so that `center` is the new centre (used while dragging). */
  panTo(center: number): void {
    this.stopAnimation();
    this.apply({ span: this.span, center });
  }

  /** Sets the view outright (clamped); used by pinch, which does its own anchoring. */
  set(v: ViewState): void {
    this.stopAnimation();
    this.apply(v);
  }

  togglePin(i: number): void {
    this.selected = this.selected === i ? null : i;
  }

  private apply(v: ViewState): void {
    const c = clamp(v, this.n);
    this.span = c.span;
    this.center = c.center;
    settings.p.view = this.toSaved();
  }

  private fromSaved(saved: SavedView | null): ViewState {
    const span = saved?.span ?? this.defaultSpan;
    const center = saved && saved.right !== null ? saved.right - this.startDay - span / 2 : this.n - span / 2;
    return { span, center };
  }

  /** null when this is the default view; `right` null when it runs to the newest day. */
  private toSaved(): SavedView | null {
    const right = this.center + this.span / 2;
    const atEnd = right >= this.n - 0.5;
    if (atEnd && Math.abs(this.span - this.defaultSpan) < 0.5) return null;
    return {
      span: Math.round(this.span * 100) / 100,
      right: atEnd ? null : Math.round((this.startDay + right) * 100) / 100,
    };
  }

  private animateTo(t: ViewState): void {
    this.target = clamp(t, this.n);
    if (!this.frame) this.frame = requestAnimationFrame(() => this.step());
  }

  private step(): void {
    const t = this.target;
    if (!t) return;
    const ds = t.span - this.span;
    const dc = t.center - this.center;
    if (Math.abs(ds) < 0.01 && Math.abs(dc) < 0.001) {
      this.apply(t);
      this.stopAnimation();
      return;
    }
    this.apply({ span: this.span + ds * EASE, center: this.center + dc * EASE });
    this.frame = requestAnimationFrame(() => this.step());
  }

  private stopAnimation(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.target = null;
  }
}

/** clampView, or until exercise E28 is done the view as asked for (it can then drift past the ends). */
const clamp = (v: ViewState, n: number): ViewState =>
  whenDone(
    () => clampView(v, n),
    () => v,
  );

export const view = new ViewStore();
