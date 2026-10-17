import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/base.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('index.html has no #app element');

export default mount(App, { target });

// Development only: the stores on `window.__rh`, so a console (or a headless probe) can read
// and set anything, the way the legacy page's `__eval` hook did. Never in a production build.
if (import.meta.env.DEV) {
  void Promise.all([
    import('./lib/state/app.svelte'),
    import('./lib/state/model.svelte'),
    import('./lib/state/settings.svelte'),
    import('./lib/state/view.svelte'),
  ]).then(([a, m, s, v]) => {
    Object.assign(window, { __rh: { app: a.app, model: m.model, settings: s.settings, view: v.view } });
  });
}
