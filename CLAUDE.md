# running-history v2

Svelte 5 (runes only) + TypeScript (strict) + Vite SPA, Dexie for IndexedDB, a Web Worker
for processing, vite-plugin-pwa for offline/install. Data comes from Intervals.icu.

- `legacy/` holds the old single-file app and its long `CLAUDE.md`. That doc is the
  **behavioural spec** (what every panel does and why, the maths, the colour system, the
  gotchas). Read the relevant section before changing behaviour. It is reference only:
  don't edit it.
- `docs/intervals-api-findings.md`: what the Intervals.icu API actually returns.
- Layers, dependencies pointing one way: `src/lib/domain` (pure TS, no DOM/Svelte/IDB/fetch)
  ← `src/lib/data` (Dexie, Intervals client, sync, reprocess) ← `src/lib/ui` + `src/lib/state`.
- Colours live in `src/styles/tokens.css`, copied verbatim from legacy. Don't change them
  without asking and re-validating (see legacy CLAUDE.md "Colour system").
- Node 22 via nvm: `export PATH=~/.nvm/versions/node/v22.23.3/bin:$PATH` (default is 18).
- Verify with `npm run check`, `npm run test`, `npm run lint`, `npm run build`.
- Commit messages: never end with "Co-authored by model". Branch + PR, never push to main.
