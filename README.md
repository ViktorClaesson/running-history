# running-history v2

My running history, charted: *is my training trending up or down, and did today's run
help?* A Svelte 5 + TypeScript rebuild of the single-file app in [`legacy/`](legacy/),
fed from [Intervals.icu](https://intervals.icu) instead of a Runalyze CSV, with all data
kept locally in the browser (IndexedDB) so it works offline and installs as an app.

## Running it

Needs Node 20.19+ (`nvm use` picks up `.nvmrc`).

| Command | What it does |
|---|---|
| `npm install` | install dependencies |
| `npm run dev` | dev server at http://localhost:5173 with hot reload |
| `npm run build` | type-check, then build static files into `dist/` |
| `npm run preview` | serve the built `dist/` locally |
| `npm run test` | run the unit tests once ([Vitest](https://vitest.dev/)) |
| `npm run lint` | ESLint + Prettier check |

## Your data and your key

Everything lives in this browser, per device: summaries, raw FIT files and processed
chunks in IndexedDB, settings and the Intervals.icu API key in localStorage. The key is
entered in the app (settings → Data), never committed, never logged, and only ever sent to
intervals.icu. The deployed site contains no keys. A phone needs its key entered once and
its own Sync.

## Offline and installing

The build includes a service worker ([what that is](https://web.dev/learn/pwa/service-workers))
that precaches the whole app, so it opens with no network and shows the last synced data;
only Sync needs a connection. Chrome (desktop and Android) offers "Install app", and the
installed app opens full-screen from the home screen.

**Updates** use the "prompt" strategy: a new deploy downloads in the background and a banner
offers *Reload*. Code is never swapped under a running page, and an open app checks for a new
version every hour and whenever it returns to the foreground, so an installed app can't get
stuck on an old version.

## Deploying (GitHub Pages)

`.github/workflows/deploy.yml` builds with `BASE_PATH=/running-history/`, runs lint and tests,
and deploys `dist/` (plus the legacy page at its old URL, `running-history.html`). It only
takes effect once **Settings → Pages → Source** is switched from the branch to
**GitHub Actions**; until then Pages keeps serving `main` as before. So: merge, switch the
source, then run the workflow (it also runs on every push to `main`).

To try a production build locally: `npm run build && npm run preview`.
