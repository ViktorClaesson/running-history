import { readTheme, type Theme } from './charts/theme';

/**
 * The current colours, as reactive state: when the OS switches between light and dark,
 * `theme.current` changes and every canvas that read it redraws.
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
 */
class ThemeStore {
  current = $state<Theme>(readTheme());

  constructor() {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => (this.current = readTheme()));
  }
}

export const theme = new ThemeStore();
