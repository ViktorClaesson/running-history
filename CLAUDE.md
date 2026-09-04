# running-history

A single self-contained HTML page that visualises my running history from a
[Runalyze](https://runalyze.com) CSV export. `running-history.html` is the whole
project: no build step, no server, no dependencies, no network access. Open it in a
browser and it works.

The point of the chart is **not** "how much did I run" — it is *"is my training
trending up or down, and did today's run help?"*

## Running it

```
open running-history.html
```

First open asks for a Runalyze activities CSV (mine lives at
`~/Downloads/runalyze-activities.csv`; re-export from Runalyze → Settings → Export
to refresh). After that the page opens straight into the chart.

## What the chart shows

Two stacked panels sharing one x-axis, one bar/point per calendar day:

1. **Bars** — height is the rolling average km/day over the trailing window
   (default 70 days). Colour is a *verdict on that day's run* (see below).
2. **Line** — average run days per week over the same window, on a fixed 0–7 axis
   with a reference line per whole day.

Hovering a day fills a fixed-height readout: exact distance, the rolling average
(also as km/wk, km/mo, km/yr), run days per week, the day's target, and the verdict.

## The model (this is the part worth understanding)

All of it is derived in-browser from one array of daily distances.

- **Rolling window** `WINDOW`, default 70 days (a clean multiple of 7), adjustable
  7–365 in the controls.
- **Target** — what a run that day had to be to hold the average steady. Computed
  **only from the window ending yesterday**, never including the day being judged
  (comparing a run to an average it is part of is circular; and the raw average also
  moves when an old run drops out of the window).
  - `mean` mode: weekly volume ÷ (run days per week + 1) when long runs are active,
    otherwise ÷ run days per week — which is just mean km per *running* day. The
    `+1` is because one run per week is expected to be the long one, so a
    3-runs/week week is 1+1+2 = 4 target-sized efforts.
  - `median` mode: the middle run of the previous window. The `+1` correction does
    not apply (it is a property of the mean decomposition).
- **Long runs** — a second scheme read against **2×** target instead of 1×, for days
  past the 1.5× midpoint. Gated two ways: only at **≥3.0 run days/week**
  (`LONG_MIN_RUNS_PER_WEEK`), and by default only when a **single** run clears 1.5×
  on its own (`longNeedsSingleRun`) rather than a day reaching it across two runs.
- **Verdict** — ratio of the day's distance to its target, then:
  `|ratio − centre| ≤ stableBand` → **stable**; otherwise **productive** (above) or
  **unproductive** (below), with colour ramping to full strength over the remaining
  distance to the halfway mark (`gradient window = 50% − stableBand`). Band default
  ±1%, adjustable 0–5%.
  With a ±5% band the whole range tiles as: `<50 full un | 50–95 ramp | 95–105
  stable | 105–150 ramp pr` (normal, centre 1×) then `150–195 ramp un | 195–205
  stable | 205–250 ramp pr | >250 full pr` (long, centre 2×).
- **Weekly rates are never extrapolated from under 7 days** of history — one run on
  day one is not "7 runs a week". Both the volume and the run count share that floor,
  so their ratio is unaffected.
- The **"first N days ÷"** control only affects how the average *line* is drawn
  during ramp-in. It deliberately does **not** touch the target.

## Colour system

Two schemes, three meanings each, plus rest days. Hexes live in the CSS custom
properties at the top of the file (light and dark, each declared under three scopes
— see the comment there).

| | productive | unproductive | stable |
|---|---|---|---|
| Normal run | blue `--n-pr` | orange `--n-un` | weakest step of `--n-pr` |
| Long run | violet `--l-pr` | olive `--l-un` | weakest step of `--l-pr` |

Rest days are a pale neutral `--rest`; a run whose scheme has colouring switched off
is a mid neutral `--nocolour`.

**The important constraint:** six mutually distinguishable hues do not exist. Within
a scheme the pair carries the meaning and is validated strongly (normal CVD ΔE 20.9 /
normal-vision 25.8; long 24.0 / 26.3). *Across* schemes colour cannot separate —
violet's complement lands in the yellow-green that collides with orange under
red-green colourblindness (ΔE ~2). So **long runs are marked by a 45° hatch**, which
stays on even when their colouring is toggled off. Do not "fix" the cross-scheme
similarity by adding more hues; it has been measured and it does not work.

Ramps are interpolated in OKLab (`hexToOklab` / `oklabToCss`) so mid-ramp steps stay
clean, precomputed once per frame into 24 steps.

## Data pipeline

- CSV is parsed in-browser (`parseCsv` handles quoted fields, embedded commas,
  doubled quotes, CRLF). Required columns: `time`, `timezoneOffset`, `distance`,
  `sportid`.
- Each activity is filed under its **local** calendar day (`time + timezoneOffset*60`,
  read as UTC), then aggregated per day into `values` (total km), `maxRun` (longest
  single run) and `nRuns` (count). 63 of my days have more than one run.
- **Sport IDs are per-account**, so there is no way to detect "running" generically.
  `summariseSports` shows every sport with count / total km / median speed and
  pre-ticks a guess: the busiest sport with median speed 7.5–17 km/h, plus anything
  comparable in volume. Speed alone over-selects — cross-country skiing at 8.2 km/h
  sits squarely in running range.
- Parsed data is cached in `localStorage` under `runviz.data.v2` (`SCHEMA = 2`; bump
  both together if the shape changes), ~12 KB. Selected sports in `runviz.sports.v2`.
- Where supported, the picked file is also kept as a `FileSystemFileHandle` in
  IndexedDB (`runviz` / `handles`), which powers "Refresh from file" and a silent
  re-read on open when permission is still granted. **A browser cannot open a
  filesystem path stored as a string** — a handle is the only way to remember a file,
  which is why the data itself is cached rather than a path.

## File layout

One file, in this order: CSS custom properties → styles → markup → load-gate markup
→ bootstrap script (CSV parsing, storage, sport picker, boot) → app script, whose
entire body is wrapped in `if (DATA) { … }` so nothing runs until data exists.

Roughly: `recompute` (avg + run counts + `computeTargets`) → `classify` (verdict per
day) → `buildRamps`/`barColour` → `drawBars`/`drawFreq`/`drawAll` →
`setReadout`/`renderTable`/`renderTiles`/`syncLabels`.

## Gotchas that have bitten before

- **Declaration order.** `recompute()` runs at load. Anything it touches (`WINDOW`,
  `compareMode`, `LONG_MIN_RUNS_PER_WEEK`, the series arrays) must be declared
  *above* that call or the whole script dies on a `const`/`let` TDZ error, which
  surfaces confusingly as "Cannot access 'C' before initialization".
- **`[hidden]` vs `display`.** An author `display:` rule beats the UA stylesheet
  behind the `hidden` attribute. `.gate[hidden] { display: none }` exists for that
  reason.
- **Never a dual axis.** Two measures = two stacked panels sharing the x mapping.
- **Bars must never gap.** Each bar runs from its own day boundary to the next, both
  edges pixel-snapped, so neighbours share an edge exactly at any zoom.
- **Zoom is cursor-anchored** — the fractional day under the pointer keeps its screen
  x; it must not re-centre or pin the left edge.
- **The readout must not change height** between idle and hovered. The idle state
  carries an invisible label/value spacer so it matches by construction.
- Floating point: `1.05 - 1 > 0.05`, so band edges need the epsilon in `classify`.

## How to verify a change

There are no unit tests; the page is verified by driving headless Chrome. Both of
these were used constantly and are worth reusing:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# screenshot (then actually look at it)
"$CHROME" --headless=new --disable-gpu --virtual-time-budget=4000 \
  --window-size=1240,900 --screenshot=out.png "file://$PWD/running-history.html"
```

For behaviour, copy the page to a temp file, inject a script before `</body>` that
sets up a state and writes results into `document.title`, then read the title back
with `--dump-dom | grep -o '<title>[^<]*'`. Wrap it in `try/catch` and report
`e.message`, otherwise a thrown error just looks like empty output. Beware
redeclaring an existing top-level name in the probe (`const ro`, `const out`) — that
is a `SyntaxError` that kills the whole block.

Assert against an independent implementation where the maths matters: the target
formula and the rolling median were both checked by brute-forcing every day in the
probe and comparing (agreement to ~1e-14).

For colour changes, run the `dataviz` skill's validator before committing to hexes —
`node validate_palette.js "#hex,#hex,…" --mode light --pairs all` — and treat a
red-green CVD ΔE below 8 as a real failure, not a nit. It needs `{"type":"module"}`
in the same directory and the filename kept as `validate_palette.js`.

## Working preferences

- Say plainly when a request can't work as literally specified (paths in
  localStorage, six distinguishable hues) and offer the closest thing that does.
- Verify before claiming; quote the actual numbers.
- Keep it one dependency-free file that works from `file://`.
