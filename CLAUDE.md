# running-history v2

Svelte 5 (runes only) + TypeScript (strict) + Vite SPA, Dexie for IndexedDB, a Web Worker
for processing, vite-plugin-pwa for offline/install. Data comes from Intervals.icu.

- `legacy/` holds the old single-file app and its long `CLAUDE.md`: the **behavioural spec**
  (what every panel does and why, the maths, the colours, the gotchas). Read the relevant
  section before changing behaviour. Reference only: don't edit it.
- `README.md` has the data-flow diagram, reading guide and "where to change…" table;
  `docs/intervals-api-findings.md` what the API really returns; `docs/GUIDE.md` the exercises.
- Layers, dependencies pointing one way: `src/lib/domain` (pure TS, no DOM/Svelte/IDB/fetch)
  ← `src/lib/data` (Dexie, Intervals client, sync, reprocess) ← `src/lib/state` + `src/lib/ui`.
- Processing stores cleaned per-second **samples** (timer time, distance, the watch's
  `enhancedSpeed`, 25 m-window gradient, HR, segment). Pace zones, workout type, stress and
  zone volume read **time-based chunks** built from them in memory (setting `chunkSec`,
  0–60 s); VDOT reads whole runs and manual-lap/workout-step **segments**. Chunks never
  cross a segment.
- GAP is pure Minetti, combined by energy: sum flat-equivalent *metres*
  (distance × C(g)/C(0)) over real time, never a flat-equivalent time. Stress always reads
  raw speed.
- Colours live in `src/styles/tokens.css`, copied verbatim from legacy. Don't change them
  without asking and re-validating.
- Svelte 5 strips whitespace at the start/end of an element's content: use `{' · '}`.
- The readout must not change height from day to day (verify by sweeping every day with
  `window.__rh` in a dev build; currently 804 px on all days × all zone modes).
- Node 22 via nvm: `export PATH=~/.nvm/versions/node/v22.23.3/bin:$PATH` (default is 18).
- Verify with `npm run check`, `npm run test`, `npm run lint`, `npm run build`.
- Never put API keys, FIT files or other personal data in the repo (it is public).
- Commit messages: never end with "Co-authored by model". Branch + PR, never push to main.
