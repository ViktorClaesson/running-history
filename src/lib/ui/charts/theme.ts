import { ZONES } from '../../domain/paceZones';

/**
 * The colours the canvases draw with, read from the CSS custom properties in tokens.css,
 * so the canvas and the page can never disagree and dark mode just works. Read once per
 * frame (cheap) rather than cached, because the theme can change under us.
 */
export interface Theme {
  surface: string;
  text: string;
  textSecondary: string;
  muted: string;
  grid: string;
  baseline: string;
  rest: string;
  nocolour: string;
  vdot: string;
  accent: string;
  /** Window slot k's colour, which is also verdict k's (see tokens.css). */
  windows: [string, string, string, string];
  zoneWeak: string[];
  zoneStrong: string[];
}

export const WINDOW_CSS = ['--v-hp', '--v-pr', '--v-st', '--v-un'] as const;

export function readTheme(el: Element = document.documentElement): Theme {
  const style = getComputedStyle(el);
  const c = (name: string) => style.getPropertyValue(name).trim();
  return {
    surface: c('--surface-1'),
    text: c('--text-primary'),
    textSecondary: c('--text-secondary'),
    muted: c('--muted'),
    grid: c('--grid'),
    baseline: c('--baseline'),
    rest: c('--rest'),
    nocolour: c('--nocolour'),
    vdot: c('--vdot'),
    accent: c('--accent'),
    windows: [c(WINDOW_CSS[0]), c(WINDOW_CSS[1]), c(WINDOW_CSS[2]), c(WINDOW_CSS[3])],
    zoneWeak: ZONES.map((z) => c(z.weak)),
    zoneStrong: ZONES.map((z) => c(z.strong)),
  };
}

export const FONT = '11px system-ui, -apple-system, sans-serif';
