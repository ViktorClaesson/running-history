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

## Status

Milestone 1 (scaffold). See the reading guide below as it grows.
