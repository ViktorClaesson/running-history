# Working through the exercises

The `v2-exercises` branch is the finished app with 33 pieces taken out. Each missing piece is
a function whose body is `return todo('E07', …)`, with a `TODO(E07)` block above it that says
what to build. Until you write it, the parts of the app that need it show a dashed placeholder
("**Exercise E07** not done yet: VDOT per day") and everything else keeps working. Every
exercise has tests that fail until it is done and pass once it is, and each one needs only the
exercises before it. So work in order, keep the app open, and watch it come back to life.

The finished code is on `v2-solution`. Compare with it when you're stuck, but try the hints
first: the point is the thinking, not the typing.

- [Phase 0: before you start](#phase-0-before-you-start)
- [Phase 1: basics (the bars appear)](#phase-1-basics-the-bars-appear)
- [Phase 2: fitness maths](#phase-2-fitness-maths)
- [Phase 3: processing](#phase-3-processing)
- [Phase 4: data and the asynchronous web](#phase-4-data-and-the-asynchronous-web)
- [Phase 5: the UI](#phase-5-the-ui)
- [Bonus: the offline app](#bonus-the-offline-app)
- [Asking Claude for help without being handed the answer](#asking-claude-for-help-without-being-handed-the-answer)

---

## Phase 0: before you start

### Running it

You need Node 22 (`nvm use`, or `export PATH=~/.nvm/versions/node/v22.23.3/bin:$PATH`), then:

| Command | What it does |
|---|---|
| `npm install` | once |
| `npm run dev` | the app at http://localhost:5173, reloading as you save |
| `npm run exercises` | the exercises still open, with difficulty and file |
| `npm run exercise E04` | the tests of one exercise (`npm run test -- E04` does the same) |
| `npm run test` | every test |
| `npm run check` | the type checker (TypeScript and Svelte) |
| `npm run lint` | ESLint and Prettier (`npm run format` fixes the formatting) |

`npm run test:watch -- -t E04` re-runs one exercise's tests on every save, which is the most
pleasant way to work.

### Getting your data in

Sync itself is an exercise (phase 4), so load your data with the finished app first:

1. `git switch v2-solution`, `npm run dev`, open http://localhost:5173, enter your Intervals.icu
   athlete id and API key under **Data** in the settings, and press **Sync**.
2. `git switch v2-exercises` and run `npm run dev` again, **on the same port**.

The data lives in the browser's IndexedDB for `localhost:5173`, so both branches see it.
Everything you build reads that data. A buggy exercise can only mess up the copy in this
browser, and switching back to `v2-solution` and pressing Sync (or **Reprocess all**) restores
it. Settings are not remembered until E26, so the page opens with the defaults every time.

Development builds put the stores on `window.__rh` (`app`, `model`, `settings`, `view`): in the
browser console, `__rh.model.daily` shows the daily series you built.

### A tour of the folders

```
src/lib/domain/   pure TypeScript: dates, the daily series, windows, VDOT, zones… (phases 1–3)
src/lib/data/     IndexedDB (Dexie), the Intervals.icu client, sync, the worker client (phase 4)
src/lib/workers/  the Web Worker that turns a FIT file into samples (phase 4)
src/lib/state/    the stores the UI reads: app (data, sync), model (everything derived), settings, view
src/lib/ui/       Svelte components and the canvas drawing code (phase 5)
src/lib/exercise.ts  the list of exercises, todo() and its error
tests/            one folder per layer; test names start with the exercise id
legacy/           the old single-file app, and legacy/CLAUDE.md: *why* everything behaves as it does
```

Dependencies point one way: `domain` knows nothing about the browser, `data` uses `domain`, and
`state` and `ui` use both. That is why most exercises are plain functions you can test without
a browser.

### How the data flows

```
Intervals.icu ──fetch──▶ sync.ts ─────────────────────────────▶ IndexedDB
                          list runs, decide what's new,           activities, raw FIT files,
                          download FIT files                      samples (per second)
                              │                                       ▲
                              ▼                                       │
                    Web Worker: FIT → laps → samples ─────────────────┘

startup: IndexedDB ─▶ app store (runs + samples)
           ─▶ model store: buildDaily (chunks) → windows, verdict, VDOT, zones, stress …
           ─▶ components: the chart panels, the readout, the zone card, the table
```

The README has the long version. The phases follow this flow from the middle outwards. First
the maths that turns runs into lines (phases 1 and 2). Then how a recording becomes samples and
chunks (phase 3). Then where the data comes from (phase 4). Last, the interface around it
(phase 5).

### Reading a `TODO(Exx)` block

```ts
/*
 * TODO(E04) · window series · difficulty ★★☆ · phase 1
 *   buildWindows(base, mult)   …what it takes, what it returns, in which units…
 * Edge cases that matter, and why:
 * - …the gotchas that bit the legacy app…
 * Background: legacy/CLAUDE.md, "The model" …
 * Concepts:
 * - …links to MDN, Svelte, Dexie…
 * Check: npm run exercise E04 (tests/domain/windows.test.ts) …and what appears in the app…
 * Spoiler: `rebuildWindows()` in legacy/running-history.html.
 */
export function buildWindows(base: number, mult: number): Window[] {
  return todo('E04', base, mult);
}
```

- The **signature and doc comment** are the contract: keep them, replace only the body. The
  parameters are passed to `todo` just so the type checker doesn't call them unused.
- **Edge cases** are the part worth reading twice. Most of them are bugs the legacy app
  really had.
- **Background** points into `legacy/CLAUDE.md`, the long-form spec. Search it for the quoted
  heading.
- **Spoiler** names the legacy function that did the same job. It's a different design
  (plain JavaScript, no types), so reading it is a real hint, but not the answer.
- Stubbing removed the imports only the solution used. Your editor's auto-import (or the
  names in the TODO block) brings them back.
- Difficulty: ★☆☆ a few lines, ★★☆ needs some thought, ★★★ the interesting ones.

A few blocks say **checked in the app, no tests** (E32, E33): those are about how the page feels,
so you check them by using it.

---

## Phase 1: basics (the bars appear)

### Read first

- [`Date.UTC`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/UTC):
  calendar arithmetic with no time zone. It's how a date becomes a day number without the
  "runs after 22:00 land on the next day" bug.
- [Typed arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Typed_arrays):
  the series are `Float64Array`s, one number per day, fast and compact.
- [Floating-point basics](https://floating-point-gui.de/basic/): why a sliding sum can end up at
  −0.000000000000001 instead of 0, and why that printed "-0.0 km".
- [Vitest's test filtering](https://vitest.dev/guide/filtering): what `npm run exercise E04`
  does under the hood (`-t`, a test-name filter).
- `legacy/CLAUDE.md`, "The model": the four windows, the verdict, and why everything is
  divided by its full window.

### What you're building

The daily series: one entry per calendar day from your first run to today, each day's runs kept
apart. Then the rolling distance per week over four windows (1, 4, 16 and 64 weeks), and the
verdict: which window is highest that day. This is the heart of the app, the "is my training
trending up" question.

### Exercises

| | File | | |
|---|---|---|---|
| E01 | `domain/dates.ts` | parseIsoDate, dayNumber / fromDayNumber, localDateOf, fmtDate | ★☆☆ |
| E02 | `domain/rolling.ts` | rollingSum and perWeek, with the dust snap | ★☆☆ |
| E03 | `domain/daily.ts` | buildDaily, segmentTotals | ★★☆ |
| E04 | `domain/windows.ts` | buildWindows, windowSeries | ★★☆ |
| E05 | `domain/verdict.ts` | highestSlot, classify | ★☆☆ |

### How to check it

`npm run exercise E01` … `E05`. In the app:

- the page opens on a card saying **Exercise E03 not done yet**: your runs are loaded, but there
  is no daily series to chart;
- after **E03** the bar chart appears (one bar per day), with the tiles and the readout's date
  and distance;
- after **E04** the per-week panels draw their four lines and the readout fills in;
- after **E05**, set *Colour bars by* to **verdict** in the settings: the bars take the colour
  of the winning window, and the table shows verdicts. The default colouring, workout type,
  stays grey until E11.

The bar panel's axis is a plain one with a note until E30. That's expected.

### Hints

- **E01** Don't let `new Date("2026-10-14")` or local-time methods anywhere near this: a DST
  weekend would gain or lose a day. "Does this day exist?" has a neat answer: build the date with
  `Date.UTC` and see whether it comes back unchanged. `localDateOf` is shorter than you think.
- **E02** One pass, one running sum. Ask yourself what the sum is just before the window starts
  dropping old values, and when exactly the first value should leave. The dust snap goes right
  after the subtraction. A common mistake is dividing by the number of days *so far* at the start.
- **E03** Sort first, then everything is an index computation with `daysBetween`. The series runs
  to `today` even if your last run was a week ago. `runData` is provided: call it, don't rewrite
  it. For `segmentTotals`, accumulate three sums per segment and only turn the flat metres into a
  time at the end.
- **E04** Each output is one `map` over the windows. "Did I run that day" is a series of 1s and
  0s you can build from `km`. Watch which counts are rates (per week) and which are raw.
- **E05** A tie keeps the shorter window: think about which comparison operator does that for
  free.

---

## Phase 2: fitness maths

### Read first

- [The quadratic formula](https://en.wikipedia.org/wiki/Quadratic_formula): VDOT's speed-for-a-VO2
  is the inverse of a quadratic.
- [vdoto2.com's calculator](https://vdoto2.com/calculator): Jack Daniels' VDOT, to compare your
  numbers with. The tests use its worked example.
- [The min/max queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html):
  the trick behind a rolling maximum in O(N) rather than O(N × window).
- [`Array.prototype.reduce`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce):
  the scores and totals are sums over arrays.
- `legacy/CLAUDE.md`, "VDOT and pace zones", "Workout type", "Stress score" and "Running
  volume by pace zone": every number in this phase comes from there.

### What you're building

Everything that reads *how fast*, not just how far. VDOT is a fitness score from each run's pace
and duration, taken as a rolling peak. Pace zones are bands of speed relative to that VDOT. A
histogram of each run by zone. The workout type that colours the bars. A stress score. Distance
per week split by zone. And the Weekly target box. These all run in memory in the model store
(`state/model.svelte.ts`), recomputed only when something they read changes.

### Exercises

| | File | | |
|---|---|---|---|
| E06 | `domain/vdot.ts` | velocityFromVo2 (quadratic inverse), impliedVdot | ★☆☆ |
| E07 | `domain/vdot.ts` | dayVdots: per run and per lap, never per day | ★★☆ |
| E08 | `domain/vdot.ts` | rollingMax with a monotonic deque | ★★★ |
| E09 | `domain/paceZones.ts` | enduranceFloorPct, zoneEdgeVel, binEdges, binWithEdges | ★★★ |
| E10 | `domain/chunks.ts`, `domain/paceZones.ts` | chunkVelocity, paceHistogram | ★☆☆ |
| E11 | `domain/workoutType.ts` | zoneScores, workoutFromScores | ★★☆ |
| E12 | `domain/stress.ts` | dayStress (raw speed) | ★☆☆ |
| E13 | `domain/zoneVolume.ts` | dayBuckets, zoneArea | ★★☆ |
| E14 | `domain/weeklyTarget.ts` | targetSeed, targetFor | ★☆☆ |
| E15 | `domain/weeklyTarget.ts` | weekSlots, maxRunsFor, fitPlan, weekPlan | ★★★ |

### How to check it

`npm run exercise E06` … `E15`. In the app, as you go:

- after **E08**: the VDOT panel and the readout's VDOT row;
- after **E10**: the pace-zone card under the chart (hover a bar to change the day);
- after **E11**: the bars in workout-type colours (the default), and the table's workout column;
- after **E12**: the stress rows in the readout, and the stress panels (switch them on in the
  settings);
- after **E13**: the "by pace zone" panel and the readout's zone rows;
- after **E15**: the Weekly target box next to the tiles.

Until phase 3, each run counts as **one chunk at its average pace** and grade adjustment is
off, so an interval session reads as one steady run. That's the stand-in in `runData`, and it
sharpens on its own when you finish E17 and E19.

### Hints

- **E06** Write the quadratic out with `a`, `b`, `c` first, and only then the formula. Of the two
  roots, only one is a positive speed. Units are metres per minute and minutes, not seconds.
- **E07** Write a small helper that lists one run's efforts, then take the maximum. Two runs on
  the same day are never added together: that's the bug the test is named after. Mind when laps
  count at all (more than one segment) and the minimum lap length.
- **E08** First write the O(N × window) version and keep it as a check, then the deque. Store
  *indices* in the deque, not values, so you can tell when one has left the window. `shift()`
  on a big array is slow: keep a head pointer.
- **E09** Draw the speed axis on paper: the three fixed slow buckets, then five zones, each cut
  into `zoneBars` equal steps of speed. Off-by-one is the enemy here: `binEdges` has one fewer
  entry than there are bins, and edge `k` is the *start* of bin `k + 1`.
- **E10** Compute the edges once, outside the loop. The km you add are real km, even when the
  binning speed is grade-adjusted.
- **E11** Get the scoring right first (`npm run exercise E11` has a test for each half). Then the
  pooling: walk from repetition down, keep a running total, stop at the first that reaches the
  share. Recovery is what's left, not a pool.
- **E12** Three lines inside two loops. The temptation is to use the grade-adjusted metres; the
  TODO says why not.
- **E13** One flat array, index `i × N_BUCKETS + b`. For `zoneArea`, pull each bucket's column
  out into its own series, then reuse E02.
- **E14** Find the first and last index of the window, then it's three sums. Check the case
  where the window reaches back before day 0.
- **E15** The hardest bookkeeping in the app. Write `weekSlots` first and test it against the
  legacy table in the test file. Build `weekPlan` from runs per day, then add km. Check the
  long-run day separately.

---

## Phase 3: processing

### Read first

- [Minetti et al. (2002)](https://doi.org/10.1152/japplphysiol.01177.2001): the energy cost of
  running uphill and downhill. Grade-adjusted pace here is built on its curve.
- [Binary search](https://en.wikipedia.org/wiki/Binary_search_algorithm) and
  [linear interpolation](https://en.wikipedia.org/wiki/Linear_interpolation): finding the altitude
  at any distance along a run.
- [The FIT activity file](https://developer.garmin.com/fit/file-types/activity/): what a watch
  records (records, laps, the lap trigger, workout steps).
- `docs/intervals-api-findings.md`: how manual laps were told from autolaps, and how the 25 m
  gradient window and the GAP strength were measured on real runs.

### What you're building

The path from a watch recording to the numbers phase 2 reads. Laps become *segments* (only the
laps you pressed or a workout made). The altitude becomes a gradient, and the gradient a
grade-adjusted pace. The recording becomes per-second *samples* (what IndexedDB stores). The
samples become *chunks*: a few seconds each, never across a lap.

### Exercises

| | File | | |
|---|---|---|---|
| E16 | `domain/laps.ts` | detectSegments | ★★☆ |
| E17 | `domain/gap.ts` | minettiCost, flatMetresFactor, altitudeAt (binary search), sampleGrades | ★★☆ |
| E18 | `domain/samples.ts` | buildSamples, timerSeconds | ★★☆ |
| E19 | `domain/chunks.ts` | buildChunks (time-based, the remainder rule) | ★★★ |

### How to check it

`npm run exercise E16` … `E19`. In the app:

- after **E17**, grade-adjusted VDOT and pace differ from the raw ones (switch *Grade-adjusted
  pace for VDOT* on to see it), and laps start counting as VDOT efforts;
- after **E19**, the pace zones, workout types, stress and zone volume switch from one chunk per
  run to real chunks: an interval session's histogram now shows its fast reps, and the *Min
  chunk length* setting does something.

E16 and E18 run only when a FIT file is processed, inside the worker. You'll see them in the app
after E27, when **Reprocess all** rebuilds every run with your code. If you have a folder of FIT
files (never in the repo), `RH_FIT_DIR=/path npx vitest run tests/local` checks them all.

### Hints

- **E16** A loop over laps that looks one ahead. Two booleans remember which kind of boundary
  you saw, for the rule. Make sure the last lap never ends a segment.
- **E17** Clamp the gradient *before* the polynomial. In `altitudeAt`, deal with the two ends
  first, then binary-search for the pair of samples around `d`. Two samples at the same distance
  (standing still) must not divide by zero. In `sampleGrades`, clip the window at the start and
  end of the run.
- **E18** n samples make n − 1 intervals: interval k ends at sample k + 1. Most of the work is
  calling things that already exist (`detectSegments`, `fillAltitude`, `sampleGrades`,
  `lapOfIntervals`, `singleSample`). For `timerSeconds`, the overlap of two intervals is
  `max(0, min(ends) − max(starts))`.
- **E19** Keep one chunk "in progress" as an accumulator. Three moments matter: a sample with a
  different segment arrives, the chunk reaches `minSec`, and the input ends. The remainder rule
  is the subtle part: write it once, as a function, and call it at both segment ends. The tests
  have one case per rule.

---

## Phase 4: data and the asynchronous web

### Read first

- [Promises](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Promises)
  and [`async`/`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function):
  every request, every database call and every worker answer in this phase is a Promise.
- [IndexedDB transactions](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction) and
  [Dexie's `transaction()`](https://dexie.org/docs/Dexie/Dexie.transaction()): how three writes
  either all happen or none does.
- [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) and
  [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS): why the browser may
  talk to intervals.icu directly at all.
- [HTTP 429 and `Retry-After`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429)
  and [exponential backoff](https://en.wikipedia.org/wiki/Exponential_backoff): being polite to a
  free API.
- [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal): how the *Cancel*
  button stops a sync, including in the middle of a wait.
- [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html): turning
  an `unknown` JSON body into types you can trust.
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
  and [transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects):
  decoding FIT files off the main thread, and handing the result back without a copy.
- [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage): where the
  settings live.

### What you're building

Sync, end to end. It stores runs safely (one transaction each). It spends a request budget,
with pacing and retries. It validates what the API returns. It plans which dates to list from
the watermark. It downloads in parallel but commits in date order, so an interrupted sync is
always resumable. And it processes each file in a Web Worker behind a Promise. Plus the
settings, validated field by field when they're loaded.

### Exercises

| | File | | |
|---|---|---|---|
| E20 | `data/repositories/activities.ts`, `samples.ts` | latestLocalDate, saveRun (one transaction), staleSampleIds | ★★☆ |
| E21 | `data/http.ts` | pauseFor, RequestBudget.acquire | ★★☆ |
| E22 | `data/http.ts` | fetchWithRetry (backoff, Retry-After) | ★★★ |
| E23 | `data/sources/intervalsIcu.ts` | parseActivity, parseActivityList | ★☆☆ |
| E24 | `data/sync.ts` | planRanges, decide | ★★☆ |
| E25 | `data/sync.ts` | fetchInOrder (parallel downloads, ordered commits) | ★★★ |
| E26 | `state/prefs.ts` | parsePrefs, isDefault | ★★☆ |
| E27 | `workers/protocol.ts`, `data/processClient.ts` | handleRequest, process | ★★☆ |

### How to check it

`npm run exercise E20` … `E27`. The tests use an in-memory IndexedDB (fake-indexeddb), a fake
clock and a fake source, so they never touch the network and never wait. In the app:

- until the sync exercises are done, **Sync** stops at once with "Sync failed: Exercise E2x not
  done yet". That's the placeholder for this phase;
- after **E26** your settings are remembered across reloads;
- after **E27**, **Sync** works end to end. Press it twice: the second sync lists from the
  watermark minus three days and fetches nothing new (the request count is under the button).
  **Reprocess all** now rebuilds every run from its FIT file with *your* phase 3 code.

### Hints

- **E20** Use the `localDate` index for the watermark rather than loading every row. Inside the
  transaction, await only Dexie calls. The test makes the third write fail and then looks for
  the first two.
- **E21** Draw a timeline of request times and the two windows. "Strictly newer than" is the
  boundary that matters. Take all time from `this.clock`, never `Date.now()`, or the tests'
  fake clock can't help you.
- **E22** A `for` loop with an attempt counter, one branch per kind of answer. A network failure
  is a *rejected* `request()`, not a status code. Wrap just that call in `try`/`catch`. The
  delays are `base`, `2 × base`, `4 × base`… A common mistake: retrying a 404.
- **E23** Check, then read: each field through `str` or `num`, defaults for the optional ones.
  An entry that can't be used returns `null`, it doesn't throw.
- **E24** `planRanges` is a `while` loop over dates with `addDays`. Try the empty-database case,
  a watermark of today, and a watermark just after `earliest`. `decide` is three `if`s, in the
  right order.
- **E25** The idea in the TODO block is the whole trick: one Promise per item, created up front
  with its `resolve` saved, so the committing loop can wait for item k while the workers
  finish items in any order. Make sure a worker never lets a rejection escape.
- **E26** Long but regular: one line per field, each the same shape (check the type and the
  range, round, assign). Write the numbers as a table in your head first. The legacy fields
  (`useGap`, `colourVerdicts`) are what an old saved entry contains, so the order matters.
- **E27** The worker side must never throw. The page side is a `new Promise((resolve, reject)
  => …)` whose two functions you put in `this.waiting` before posting the message. The answer
  comes back through `settle()`, which is already written.

---

## Phase 5: the UI

### Read first

- [Svelte 5 runes](https://svelte.dev/docs/svelte/what-are-runes): `$state`, `$derived` and
  `$effect`. The stores and every component are written with them.
- [`<svelte:boundary>`](https://svelte.dev/docs/svelte/svelte-boundary): how the placeholders
  you've been seeing work (`ui/components/ExerciseBoundary.svelte`).
- [The canvas 2D API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial): the
  chart panels are drawn on canvases, and y grows *downwards*.
- [Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events): one code path
  for mouse, pen and touch. Also
  [`touch-action`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action), which keeps
  the page scrollable over a chart.
- [`KeyboardEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key).
- [Logarithmic scales](https://en.wikipedia.org/wiki/Logarithmic_scale), for the bar panel's log
  mode.
- `legacy/CLAUDE.md`, "The bar panel's axis", "The readout: pinning…" and the zoom bullets
  under "Gotchas that have bitten before".

### What you're building

The parts of the interface with a little thinking in them. Cursor-anchored zoom. Round-number
axis ticks. The bar panel's y-axis (cap, log scale, rest-day stubs). The keyboard shortcuts. A
small Svelte component built on `$derived`. And the pointer handling: pan, the click that must
not fire after a pan, and pinch.

### Exercises

| | File | | |
|---|---|---|---|
| E28 | `ui/charts/geometry.ts` | clampView, zoomAbout (cursor-anchored zoom) | ★★☆ |
| E29 | `ui/charts/ticks.ts` | niceTicks, logUp / logDown / logTicks | ★★☆ |
| E30 | `ui/charts/barsPanel.ts` | barYAxis: the cap, the log floor | ★★☆ |
| E31 | `ui/keys.ts` | keyAction | ★☆☆ |
| E32 | `ui/components/StatTiles.svelte` | the all-time tiles, with `$derived` (in the app) | ★☆☆ |
| E33 | `ui/charts/interaction.ts` | pan, tap, pinch, and the pan-isn't-a-click guard (in the app) | ★★★ |

### How to check it

`npm run exercise E28` … `E31`. E32 and E33 have no tests; check them in the app:

- **E28**: ⌘ (Ctrl on Windows/Linux) + scroll zooms, and the day under the cursor stays under it.
  Before this, zoom did nothing and a drag could pull the chart past its ends;
- **E29**: the line panels' axes land on round numbers (until now four plain, equal steps);
- **E30**: the bar panel's gridlines, the cap ("45+") and the log scale come back, and its note
  goes;
- **E31**: `1`–`4`, `r`, `t` and Esc work;
- **E32**: the four tiles appear where their placeholder is, and "Runs logged" changes after a
  sync;
- **E33**: drag the chart sideways and it follows the mouse; click a bar and the readout says
  "pinned"; a drag that ends over a bar doesn't pin it. Then try touch, on your phone or in
  Chrome DevTools' device mode: tap pins, one finger pans, two fingers zoom, and a vertical
  swipe still scrolls the page.

### Hints

- **E28** Work in "fractional day" coordinates. Find the day under the cursor before zooming,
  scale the span, then solve for the centre that puts that day back at the same fraction of the
  width. Clamp the span before the centre.
- **E29** Find the order of magnitude with `Math.log10`, then pick the mantissa. Compare with a
  tiny tolerance: `0.1 * 3 !== 0.3`.
- **E30** Collect the minimum and maximum over the days with a run, then two branches, linear
  and log. Apply the cap last. For log, `yOf` interpolates `Math.log(v)` between the two ends.
  The tests pin down every rule, including the empty view.
- **E31** A pure function: no `document`, no `window`. Lower-case the key once.
- **E32** One `$derived.by` returning the array. The `{#each}` in the markup is already there.
  Check that a sync updates the tiles without you doing anything: that's what `$derived` buys.
- **E33** Keep the state in the module variables that are there (`drag`, `pinch`, `touches`).
  Log `drag` on every move while you work. Most bugs here are a pin firing at the end of a
  drag, or a pinch that jumps because the anchor was taken from the wrong moment.

---

## Bonus: the offline app

The service worker and the web app manifest aren't exercises (stubbing build configuration
would break the build), but they're worth understanding. Read
[service workers](https://web.dev/learn/pwa/service-workers) and
[the web app manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest),
then try this:

1. `npm run build && npm run preview`, open the URL it prints in Chrome. DevTools →
   Application shows the manifest and the service worker, now "activated and running".
2. Tick *Offline* in DevTools → Network and reload: the app still opens, with your data.
3. Change something in the manifest in `vite.config.ts` (say `short_name`, or `theme_color`),
   build again and keep the preview running. Within a minute of returning to the tab (or
   on a reload) the **update banner** offers *Reload*: the new version waited instead of
   swapping code under a running page. `src/lib/ui/updates.svelte.ts` and
   `UpdateBanner.svelte` are how.

---

## Asking Claude for help without being handed the answer

Claude Code can see this whole repository, the solution branch included, so it can answer any
question about it. What decides whether you learn something is what you ask for. Some ways to
ask that keep the thinking yours:

- **Say what you want back.** "I'm on E08. Don't write code or show me the solution. Give me
  one hint about the deque."
- **Ask about the concept, not the exercise.** "How does a monotonic deque work, on a small
  example of my own?" "What does `Date.UTC` do with a month of 13?"
- **Ask it to review rather than write.** "Here's my `rollingSum`. Without fixing it, tell me
  which test case it will fail and why."
- **Ask for a failing case.** "Give me an input where my `classify` disagrees with the spec,
  but not the fix."
- **Ask for the next smallest step.** "I'm stuck on E25. What's the smallest piece I could get
  working first?"
- **Use the tests as the referee.** Paste the failing test's output and ask what it is telling
  you, not how to make it pass.

A line you can put at the start of a session, so you don't have to repeat it:

> I'm working through docs/GUIDE.md on the v2-exercises branch to learn. Don't write or edit
> code in the exercise functions, and don't quote v2-solution, unless I say "show me". Give me
> hints, questions and failing examples instead.

When you've finished an exercise, comparing with the solution is a good use of Claude too:
"Compare my `buildChunks` with the one on v2-solution: what does each handle that the other
doesn't?"
