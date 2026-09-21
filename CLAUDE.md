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

Four stacked panels sharing one x-axis, one bar/point per calendar day:

1. **Bars** — height is the rolling average km/day over the trailing *volume*
   window (default 4 weeks). Colour is a *verdict on that day's run* (see below).
2. **Line** — average run days per week over the trailing *frequency* window
   (default 16 weeks, set independently), on a fixed 0–7 axis with a
   reference line per whole day. A day with two runs still counts as one day here.
3. **Line** — average runs per week over the same frequency window: every run
   counts, so a double-run day shows as 2. Axis is not fixed at 0–7 like the panel
   above it, since it can run higher.
4. **Line** — highest VDOT achieved by any workout in the trailing *VDOT* window
   (default 130 weeks, set independently — see "VDOT and pace zones" below).
   Undefined (a gap, not a zero) before the first-ever logged run.

Hovering a day fills a fixed-height readout: exact distance, the rolling average
(also as km/wk, km/mo, km/yr), runs per week — as two lines, run days/week on top
and every-run-counted below it — the day's peak VDOT, the day's target, and the
verdict. **Clicking a day pins it** there — see below.

The **Today's target** tile is a what-if calculator: both inputs (km/wk and runs/wk)
are editable, so a change in volume or frequency can be tried out, and it shows the
resulting per-run target plus the 1.5× long-run floor and 2× long-run target. It is
seeded from the exact quantities behind today's real target (`weeklyPrev[N-1]`,
`rpwPrev[N-1]`) so the default figure matches the chart and the hover readout. Editing
it never changes the bars — those keep their own per-day targets from actual history —
and once touched it shows the real figure alongside and offers a reset.

## The readout: pinning, and why it lives in a sticky sidebar

**Pinning.** Clicking a day sets `selected`; clicking it again, or Esc, releases it.
`shownDay()` is `hover ?? selected` — hover always wins, and the pinned day is only
what the readout *falls back* to. So moving the pointer off a bar, off the chart, or
onto another window leaves the numbers up and selectable instead of going idle. All
the "the model changed, redraw the readout" call sites go through `refreshReadout()`
rather than `setReadout(hover)`, or a window/band change would blank a pinned day.
The pinned day is drawn **dashed** (bars) and as a **hollow ring** (frequency panel)
against hover's solid outline and filled dot, so both can be on screen at once and
still read as two different things. Like zoom, it is view state and deliberately not
persisted in `runviz.prefs.v1`.

A pan ends in a mouseup on the canvas, which the browser then reports as a click —
`draggedNotClicked` (set from `drag.moved`, threshold 3px) is what stops a pan from
pinning whatever it happened to finish over.

**Sidebar, not inline.** The readout used to sit directly above the chart, so
scrolling down past a tall chart lost sight of it — no good once there were four
stacked panels plus the pace-zone histogram to scroll through. It now lives in
`<aside class="sidebar" id="readoutSidebar">`, a flex sibling of `.wrap` with
`position: sticky; top: 20px`, so it stays in view while the page scrolls.
`.page` wraps both as `display: flex; flex-wrap: wrap`; below **1300px** viewport
width the sidebar drops `position: sticky` (there's no longer room for two columns
side by side, so it just falls back to sitting in the normal flow).

Being pulled out of the main flow changes what "fixed height" needs to mean: the
sidebar's *own* height changing between idle and hovered no longer reflows the
chart next to it, so the old horizontal layout's flex-basis/max-width engineering
(needed only to stop a wrapping detail line from shoving the verdict pill onto a
second row) is gone — `.readout` is just a vertical list of full-width `.pair`
rows now. The one thing still worth keeping: `.readout .pair .v2` still reserves
**two line boxes** (`min-height: 2lh`) so a detail line wrapping to two lines
doesn't visibly nudge the sidebar's height on every hover, and `.readout .seg`
still keeps each `·`-separated piece unbreakable so a wrap lands on a separator
and never mid-phrase ("no / long runs", "564 / km/yr").

## The model (this is the part worth understanding)

All of it is derived in-browser from one array of daily distances.

- **Rolling windows** — two independent ones, each set in whole weeks in the
  controls (1–52) and stored internally in days. `WINDOW_VOL`, default 4 weeks,
  drives the volume panel: the average and the weekly-volume half of the target.
  `WINDOW_FREQ`, default 16 weeks, drives the two per-week panels (run days/week,
  runs/week) *and* the run-frequency half of the target and the long-run gate below
  — how often counts as a frequency question wherever it appears, even inside the
  volume panel's own target. They're split because "is my volume trending up" and
  "how often am I running" are useful over different spans; a shorter volume window
  reacts fast to a training block, a longer frequency window doesn't jitter with
  every rest day.
- **Target** — what a run that day had to be to hold the average steady:
  **weekly volume ÷ (run days per week + 1)** when long runs are active, otherwise
  ÷ run days per week (which is just mean km per *running* day). Weekly volume comes
  from `WINDOW_VOL`; run days per week comes from `WINDOW_FREQ` — the target blends
  both windows on purpose, one for "how much" and one for "how often". The `+1` is
  because one run per week is expected to be the long one, so a 3-runs/week week is
  1+1+2 = 4 target-sized efforts.
  Computed **only from the window ending yesterday**, never including the day being
  judged (comparing a run to an average it is part of is circular; and the raw
  average also moves when an old run drops out of the window).
  A median-run mode existed briefly and was removed — once the long run is counted
  as an extra day the mean is no longer skewed the way that was meant to fix.
- **Long runs** — a second scheme read against **2×** target instead of 1×, for days
  past the 1.5× midpoint. Gated two ways: only at **≥3.0 run days/week** over
  `WINDOW_FREQ` (`LONG_MIN_RUNS_PER_WEEK`), and by default only when a **single**
  run clears 1.5× on its own (`longNeedsSingleRun`) rather than a day reaching it
  across two runs.
- **Verdict** — ratio of the day's distance to its target, then:
  `|ratio − centre| ≤ stableBand` → **stable**; otherwise **productive** (above) or
  **unproductive** (below), with colour ramping to full strength over the remaining
  distance to the halfway mark (`gradient window = 50% − stableBand`). Band default
  ±1%, adjustable 0–5%.
  With a ±5% band the whole range tiles as: `<50 full un | 50–95 ramp | 95–105
  stable | 105–150 ramp pr` (normal, centre 1×) then `150–195 ramp un | 195–205
  stable | 205–250 ramp pr | >250 full pr` (long, centre 2×).
- **Everything is divided by its full window, always** — the average and weekly
  volume by `WINDOW_VOL`, run days/week, runs/week and the long-run gate by
  `WINDOW_FREQ`. Each window's own first stretch of days therefore ramps in from
  zero rather than being extrapolated: one run on day one is 0.1 run days/week over
  a 16-week window, not "7 a week" off a single elapsed day. A "days elapsed"
  ramp-in mode existed and was removed: it made the readout say "1 of 1 days" while
  the rate was computed against a 7-day floor, which was both inconsistent and not
  what the chart is for.

## VDOT and pace zones

**VDOT** is Jack Daniels' fitness score, derived here rather than taken from
Runalyze's own `vo2max` column — that field is only on ~half of activities,
undocumented in method, and wouldn't necessarily agree with the pace-zone formula
below. Two published Daniels & Gilbert (1979) curves do the work: `vo2FromVelocity`
(the VO2 cost of running at a given pace) and `pctVo2max` (the fraction of VO2max a
runner can hold for a given duration). Dividing a lap's actual VO2 cost by what
percentage-of-max its duration implies gives that lap's *implied* VDOT — the same
arithmetic a race calculator uses for a race, generalised to any lap: an easy lap
implies a low VDOT (low cost, and %max is close to 1 anyway over a long duration),
a genuinely hard lap implies close to the runner's real ceiling. Verified against
vdoto2.com's own worked example — VDOT 51.8 round-trips to its quoted easy/marathon/
threshold/interval/repetition paces (5:14/4:23/4:08/3:48/3:33 min/km) within rounding.

A day's own VDOT is the **max implied VDOT over its laps** — every lap, warmup and
rest included, no tag filtering, since a slow lap simply never wins that search on
its own. The **VDOT panel** is the rolling max of that across the trailing *VDOT*
window (`WINDOW_VDOT`, default 130 weeks — the only one of the three windows that
wants years, not weeks, because "what's my fitness ceiling" and "how often am I
running" are different-timescale questions). It's a plain sliding-window max
(monotonic deque, O(N)), not a target, so — unlike the volume/frequency target math
— there's no circularity to avoid in including the day itself.

**Laps** come from Runalyze's `splits` column: `<tag><km>|<time>` pieces joined by
`-`, e.g. `I1.012|3:54`. The tag (`W`arm-up, `I`nterval, `R`est/`P`ause, `C`ooldown,
`U`ntagged autolap) is read from real exports but not used for anything — see above.
A day with no parsed splits (older activities, or ones Runalyze didn't lap) falls
back to treating the whole day as a single lap.

**Pace zones** (easy/marathon/threshold/interval/repetition) are five %VDOT bands,
anchored at 65.7/81.8/88.0/97.6/106.2% (back-solved from the vdoto2.com example
above) with the boundary between two neighbours at their midpoint, so the bands
tile the %VDOT axis with no gap or overlap. The two open ends (below easy, above
repetition) are closed off at 40% and 120% purely so the outer zones have something
finite to split into 10 sub-bands each — not physiological limits, just where the
binning stops mattering. `zoneBandFor()` maps a %VDOT to one of the 50 bins
(`zone*10 + subBand`, continuous easy0..easy9, marathon0..marathon9, ...).

**The pace-zone histogram** (below the four main panels) is pinned-day-only,
deliberately keyed on `selected` rather than `shownDay()` — it's the one place on
the page that does not follow hover, because a lap walk plus a 50-bin canvas
redraw on every mouse-move would be the wrong trade. It judges the pinned day's
laps against **that day's own rolling VDOT** (the fitness level at the time), not
today's — a hard rep from years ago is read against years-ago fitness. Empty when
the day has no run, or predates the very first logged run (VDOT isn't a
meaningful zero, so there's nothing to bin against).

**Colour**: five hues (blue/green/gold/orange/red) validated with the `dataviz`
skill's palette checker using **adjacent** pairs, not all-pairs — this is an
ordered bar histogram where neighbours are what matters, the same basis the
checker itself uses for stacks/bars/lines. Light mode's worst adjacent CVD ΔE is
22.0, dark mode's is 12.5, both comfortably above the 8.0 target. "Threshold"
reads as gold/mustard rather than a bright lemon yellow: true yellow's natural
lightness sits outside the band usable once chroma and CVD separation both have
to hold, so gold is the closest a five-hue ordered set gets while still passing.

## Remembered settings

`runviz.prefs.v1` holds everything the controls row and the what-if box can be set
to, so the page opens the way it was left: `windowVol`, `windowFreq`, `windowVdot`,
`stableBand`, `longNeedsSingleRun`, `colourNormal`, `colourLong`, and `plan`
(`null` = the what-if box follows real history, `{km, days}` = edited). Three rules:

- **Read at the very top of the `if (DATA)` block**, above `let WINDOW_VOL` /
  `let WINDOW_FREQ` / `let WINDOW_VDOT`, because `recompute()` runs at load and
  reads the first two — the declaration-order gotcha below. (`WINDOW_VDOT` isn't
  read by `recompute()`, but is declared alongside the other two for the same reason.)
- **Validated field by field on load** (`loadPrefs`), against the same limits as the
  inputs, so a stale or hand-edited entry can only produce a state the UI can reach.
  All three windows are additionally rounded to the nearest whole week, since
  that's the only unit the controls can produce — `windowVdot`'s range is 1–260
  weeks, wider than the other two's 1–52, since it wants years rather than weeks.
  Anything that fails falls back to `PREF_DEFAULTS` for that field alone.
- **Written only when something is off-default** (`savePrefs`), and the entry is
  *removed* the moment everything is back to default. A page whose settings have
  never been touched leaves nothing behind.

`syncControls()` is the one place state is pushed *into* the DOM — the markup carries
the defaults, and a remembered setting has to overwrite them at boot.

**There are two resets, and each owns only what sits next to it.**

- **Reset** in the chart's controls row: all three windows, stable band, the
  long-run rule and both colour toggles back to their defaults, plus the view
  zoomed back out. It does *not* touch the what-if.
- **reset** in the Today's target tile: clears the what-if back to following real
  history, and nothing else.

Neither has to know what the other owns, because both just mutate their own state
and call `savePrefs()` — which rewrites the whole entry from current state, keeping
it if anything is still off-default and dropping it if nothing is. So a chart reset
with an edited what-if leaves an entry holding only the plan, and vice versa.

Double-clicking a panel still resets only the zoom, which is view state and
deliberately *not* remembered — persisting it would fight the Reset button and open
the page mid-history.

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

The pace-zone histogram is a separate five-hue scheme (`--z-*`), validated the same
way but on a different basis — see "VDOT and pace zones" above.

## Data pipeline

- CSV is parsed in-browser (`parseCsv` handles quoted fields, embedded commas,
  doubled quotes, CRLF). Required columns: `time`, `distance`, `sportid`.
- **`time` is already the local wall clock**, stored as a Unix timestamp, so reading
  its UTC parts (`new Date(t * 1000).toISOString().slice(0, 10)`) gives the local
  calendar day directly. `timezoneOffset` is a *record* of the offset that applied
  (60 in winter, 120 in summer here — it tracks DST), **not** something still to be
  added, and it is no longer read at all.
  This was wrong until Sep 2026: adding the offset shifted every activity that
  started at or after 22:00 local into the *next* day — 25 of 641 runs, wrong on 41
  of 592 run-days, and visible as "no run" on a day that had one with its distance
  glued onto the following day. Verified against Runalyze's own day grouping for
  22–31 Aug 2026: unshifted agrees on all ten days activity by activity, shifted
  disagrees on three. If this ever looks wrong again, the discriminator is an
  activity starting between 22:00 and midnight — nothing else moves.
- Each activity is filed under that day, then aggregated per day into `values`
  (total km), `maxRun` (longest single run), `nRuns` (count), `sec` (total elapsed
  seconds, for VDOT) and `laps` (parsed `splits`, also for VDOT — see "VDOT and
  pace zones" above). 63 of my days have more than one run.
- **Sport IDs are per-account**, so there is no way to detect "running" generically.
  `summariseSports` shows every sport with count / total km / median speed and
  pre-ticks a guess: the busiest sport with median speed 7.5–17 km/h, plus anything
  comparable in volume. Speed alone over-selects — cross-country skiing at 8.2 km/h
  sits squarely in running range.
- Parsed data is cached in `localStorage` under `runviz.data.v2` (`SCHEMA = 4`).
  `SCHEMA` guards what the cached numbers *mean*, not only their shape — the day
  attribution fix bumped it to 3 with the shape unchanged, because the cached values
  were wrong and can only be rebuilt from the CSV. It was bumped again to 4 when
  `sec`/`laps` were added for VDOT, this time because the shape itself changed: an
  older cached copy simply doesn't have those arrays. A stale schema opens the gate
  with `staleCache` set, which says why it is asking for the file again instead of
  doing it silently. Selected sports in `runviz.sports.v2`.
  Settings in `runviz.prefs.v1` (see below).
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

- **Declaration order.** `recompute()` runs at load. Anything it touches
  (`WINDOW_VOL`, `WINDOW_FREQ`, `compareMode`, `LONG_MIN_RUNS_PER_WEEK`, the series
  arrays) must be declared
  *above* that call or the whole script dies on a `const`/`let` TDZ error, which
  surfaces confusingly as "Cannot access 'C' before initialization". `loadPrefs()`
  therefore sits above `let WINDOW_VOL`/`let WINDOW_FREQ`; `savePrefs()` may
  *reference* things declared later (`stableBand`, `plan`) because it is only ever
  *called* later.
- **`[hidden]` vs `display`.** An author `display:` rule beats the UA stylesheet
  behind the `hidden` attribute. `.gate[hidden] { display: none }` exists for that
  reason.
- **Never a dual axis.** Two measures = two stacked panels sharing the x mapping.
- **Bars must never gap.** Each bar runs from its own day boundary to the next, both
  edges pixel-snapped, so neighbours share an edge exactly at any zoom.
- **Zoom is cursor-anchored** — the fractional day under the pointer keeps its screen
  x; it must not re-centre or pin the left edge.
- **The readout must not change height** between idle, hovered and pinned. The idle
  state carries an invisible label/value spacer, and `.v2` reserves two line boxes,
  so all three match by construction. See the readout section above before touching
  its flex properties.
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
formula was checked by brute-forcing every day inside the probe and comparing
(agreement to ~1e-14). Do the same for anything new.

For colour changes, run the `dataviz` skill's validator before committing to hexes —
`node validate_palette.js "#hex,#hex,…" --mode light --pairs all` — and treat a
red-green CVD ΔE below 8 as a real failure, not a nit. It needs `{"type":"module"}`
in the same directory and the filename kept as `validate_palette.js`.

## Working preferences

- Say plainly when a request can't work as literally specified (paths in
  localStorage, six distinguishable hues) and offer the closest thing that does.
- Verify before claiming; quote the actual numbers.
- Keep it one dependency-free file that works from `file://`.
