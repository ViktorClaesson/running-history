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

## How the data flows

```
 Intervals.icu ──fetch──▶ sync.ts ──────────────────────────▶ IndexedDB (Dexie, db.ts)
  (list + FIT files)      │ list, decide what's new,            activities  small summaries
                          │ download raw FIT                    raw         FIT files as fetched
                          ▼                                     samples     cleaned per-second data
                 Web Worker (process.worker.ts)                 meta        last sync, pending
                   decodeFit → detectSegments → buildSamples      ▲
                          │                                       │ reprocess.ts rebuilds samples
                          └── one transaction per run ────────────┘ from raw, offline

 startup: IndexedDB ──▶ app.svelte.ts (runs + samples, never raw)
            ──▶ model.svelte.ts: buildDaily (time chunks) → windows, verdict, VDOT, zones, stress … ($derived)
            ──▶ components: ChartCard (canvas drawers in ui/charts), Readout, ZoneCard, table
                 settings.svelte.ts (prefs) and view.svelte.ts (zoom, hover, pin) feed both
```

## Reading guide

Start with [`docs/GUIDE.md`](docs/GUIDE.md) if you are working through the exercises. To read
the finished code, this order follows the data:

1. **Domain** (`src/lib/domain/`, pure TypeScript, start here): `dates.ts`, `daily.ts`,
   `rolling.ts`, `windows.ts`, `verdict.ts`, then `vdot.ts`, `paceZones.ts`, `workoutType.ts`,
   `stress.ts`, `zoneVolume.ts`, `weeklyTarget.ts`; and the processing side, `laps.ts`,
   `gap.ts`, `samples.ts`, `chunks.ts`. Each has tests in `tests/domain/`.
2. **Data** (`src/lib/data/`): `db.ts` (tables), `sources/intervalsIcu.ts`, `http.ts`
   (rate limits, retries), `sync.ts`, `fit.ts`, `reprocess.ts`, `processClient.ts` with
   `../workers/`.
3. **State** (`src/lib/state/`): `app.svelte.ts` (data + sync status), `prefs.ts` and
   `settings.svelte.ts`, `view.svelte.ts`, `model.svelte.ts`.
4. **UI** (`src/lib/ui/`): `components/ChartCard.svelte` and `Panel.svelte`, one drawer in
   `charts/` (e.g. `windowPanel.ts`), `charts/interaction.ts`, then `Readout.svelte`.
5. `legacy/CLAUDE.md` explains *why* every feature behaves the way it does.

**Where to change…**

| | |
|---|---|
| the verdict rule | `src/lib/domain/verdict.ts` (`classify`) |
| the default windows (1 / 4 / 16 / 64 weeks) | `PREF_DEFAULTS.windowBase` / `windowMult` in `src/lib/state/prefs.ts` |
| the chunk length | it's a setting (*Min chunk length*, 0–60 s); its default is `chunkSec` in `src/lib/state/prefs.ts` |
| the gradient window or GAP model | `GRADE_WINDOW_M` and `minettiCost` in `src/lib/domain/gap.ts` (bump `PROCESSING_VERSION` in `src/lib/data/processingVersion.ts` for the window; reprocessing runs by itself) |
| which activity types count | the *Types* field in the app (default in `src/lib/state/syncConfig.ts`) |
| the API politeness | `INTERVALS_LIMITS` in `src/lib/data/http.ts`, `SYNC_CONCURRENCY` in `sync.ts` |
| a colour | `src/styles/tokens.css` (validated palette: read legacy/CLAUDE.md "Colour system" first) |

Development builds expose the stores as `window.__rh` (`app`, `model`, `settings`, `view`)
for poking at things from the browser console.

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
