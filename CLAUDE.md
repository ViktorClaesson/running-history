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

Up to nine stacked panels sharing one x-axis, one bar/point per calendar day:

1. **Bars** — height is **that day's own distance**, on a **logarithmic** axis.
   Colour is a *verdict on where training stands that day* — not on that one run.
   It is literally **the colour of whichever window line in panel 2 is on top**,
   because that is what the verdict says; see "Verdict" below. Log, not linear, so equal
   *ratios* are equal heights: 5→10 km is the same step as 10→20. One 30 km day
   therefore can't squash every ordinary run onto the baseline, and the gap
   between a 4 and a 6 km day stays readable. See "The bar panel's log axis"
   below for how the floor and the rest-day stubs work.
2. **Lines** — rolling **distance per week**, one line per window (see "The four
   windows" below) plus their per-day max: the measure the bars used to carry,
   moved out into a panel of its own so the bars could become per-run distance.
3. **Lines** — average run days per week over each window, on a fixed 0–7 axis
   with a reference line per whole day. A day with two runs still counts as one
   day here, so 7 is a real ceiling.
4. **Lines** — average runs per week over each window: every run counts, so a
   double-run day shows as 2. Axis is not fixed at 0–7 like the panel above it,
   since it can run higher.
5. **Line** — highest VDOT achieved by any workout in the trailing *VDOT* window
   (default 50 weeks, set independently — see "VDOT and pace zones" below).
   Undefined (a gap, not a zero) before the first-ever logged run. Plus **dots**
   for the days that went after that ceiling — see "Near-max days" below.
6–9. **Stacked areas** — one panel *per window*, each showing what that window's
   running was made of zone by zone. Only the longest is up by default. See
   "Running volume by pace zone" below.

Panels 2–9 and the pace-zone histogram each have their own show/hide checkbox in
the settings sidebar — panels 2–5 in `visPanels` (persisted in `runviz.prefs.v1`
as `panels`), panels 6–9 in `visZonePanels` (persisted as `zonePanels`) —
panel 1 (the bars) always stays up as the anchor chart. The x-axis date labels
live on whichever panel is currently the lowest *visible* one (`bottomPanel()`,
walking `PANEL_ORDER` — the panels in DOM order, top to bottom — from the back),
not hard-wired to the last panel, so hiding panels never leaves the chart without
dates; that panel's bottom inset also widens to `XLAB_B` to fit them. The VDOT
panel used to be the bottom one by construction and so drew the labels
unconditionally; the stacked-zone panels sit below it, so it now asks like
everyone else.

## The bar panel's log axis

Zero has no place on a log axis, and a rest day drawn as no bar at all is also
nothing to aim a pointer at. So the panel is built with a floor *under* the
data rather than at zero:

- **`yHi`** is `logUp(max visible distance)` and **`yLo`** is
  `min(logDown(min visible distance), yHi / 10)` — both rounded out to the
  nearest 1/2/5-times-a-power-of-ten (`logUp`/`logDown`), with at least one full
  decade of range forced, so a stretch where every run is much the same length
  doesn't get that narrow range blown up across the whole panel.
- **Gridlines** are every 1/2/5×decade value in `[yLo, yHi]` (`logTicks`).
  Spacing is deliberately non-uniform — that's the scale, not a bug — so these
  don't go through `niceTicks`, which the four linear panels still use.
- **`yLo` maps to `MIN_RUN_H` (11px) above the plot floor**, not to the floor
  itself, so the shortest run in view still has a bar with height you can see
  and click. Anything below `yLo` clamps to that same 11px.
- **A rest day gets `REST_STUB` (5px)** in the pale `--rest` grey. Deliberately
  shorter than any real run's bar, and the reason the whole floor arrangement
  exists: a no-run day is now a thing you can hover and click rather than a gap.
- The line along the very bottom is `--baseline`, but it is the **stub floor,
  not a zero line** — there isn't one on this axis, so unlike the linear panels
  no gridline is drawn in `--baseline` and none is labelled 0.

Hovering a day fills the readout sidebar: exact distance, then one small table
per measure (distance/week, run days/week, runs/week) giving MAX first and then
each window from 1w to 64w, then — when a stacked-zone panel is up — that
window's distance split by pace zone (see "Running volume by pace zone") — the same order the panels are read in, since MAX is
the line drawn on top. Every line is listed whether or not it is currently
*drawn*: the per-line toggles declutter the chart, they don't filter the numbers.
Each row carries a dim note to the right of its value — the raw counts behind the
rate ("78 of 112 days", "87 runs in 112 days"), or for the distance table that
same rate restated as km/mo and km/yr. (The km/wk part is left out there, since
that is the value it sits next to.) That note is **10px, a step down from the
rest of the row** — it is the widest thing in the sidebar once a week goes over
99 km ("508 km/mo · 6,098 km/yr") and was wrapping on 16 days of a real
history at 11px; at 10px nothing wraps across all 1339. Sized against a 280px
sidebar, which is the width this is actually used at. Then the day's peak VDOT (plus what that day's own
reading is actually based on: full activity or best lap, with its distance, time
and pace, and how far that reading fell short of the peak — see
`vdotBasisText()`) and the verdict. **Clicking
a day pins it** there — see below.

The VDOT detail line **always breaks at the arrow**: what the reading is on line
1, what it came to on line 2 ("→ 45.4 grade-adj. · 10.2% off the peak"). A hard
`<br>`, not a wrap — flicking from day to day used to move that number between
line 1 and line 2 depending on how the width happened to run out. Two things had
to be checked to make the break safe, since a third line would nudge the
sidebar's height on every hover:

- **Both halves have to fit on one line.** Measured across a real 1339-day
  history with GAP on and off: line 1 tops out at **220px** and line 2 at
  **205px**, against **246px** of usable sidebar. Line 2 is a single `.seg` —
  it can't wrap, and at that width never needs to.
- **" grade-adj." moved from line 1 to line 2**, next to the figure it
  qualifies. On line 1 it is what pushed the line over: the widest day comes to
  **278px** there, and no shorter wording of it clears 246px with any room to
  spare (" adj." lands at 242px, which is 4px of margin and not worth trusting).
  Line 1 is now the same text whether or not GAP is on, so toggling it doesn't
  move the layout either.

The result is exactly two line boxes on every one of the 603 run days and one on
the 736 rest days ("no run"), so `.v2`'s two-line reserve holds by construction
rather than by luck.

The distance row's own sub-line used to spell out the day's target ("target 8.59
km · weekly ÷ 6.0 · no long runs"). It is gone: the verdict stopped being read
against that number, so it was a figure with nothing left to explain. All that
sub-line carries now, on a day with more than one run, is each run's distance in
the order they were run ("8.06 + 10.52 km"). The
target itself is still in the data table's Target column and behind the Today's
target tile.

The **Today's target** tile is a what-if calculator: both inputs (km/wk and days/wk)
are editable, so a change in volume or frequency can be tried out, and it shows the
resulting per-run target plus the 1.5× long-run floor and 2× long-run target. It is
seeded from the exact quantities behind today's real target (`weeklyPrev[N-1]`,
`rpwPrev[N-1]`) so the default figure matches the chart and the hover readout. Editing
it never changes the bars — those keep their own per-day targets from actual history —
and once touched it shows the real figure alongside and offers a reset.

## The readout: pinning, and why it lives in a sticky sidebar

**Pinning.** Clicking a day sets `selected`; clicking it again, or `t` or Esc,
releases it.
`shownDay()` is hover, else the pinned day, else `lastRunIdx` — the most recent
day with a run — so the readout (and the pace-zone histogram below, which also
reads off `shownDay()`) always has something to show rather than sitting idle
from page load until the first hover. Hover always wins over both. So moving
the pointer off a bar, off the chart, or onto another window leaves whichever
of pinned/most-recent was showing up and selectable instead of going idle. All
the "the model changed, redraw the readout" call sites go through
`refreshReadout()` rather than `setReadout(hover)`, or a window/band change
would blank a pinned day — this also means the boot sequence has to call
`refreshReadout()` itself (there is no hover yet to trigger it), unlike before
this fallback existed, when the static idle markup in the HTML was already
correct at load. `dayTag()` names *why* `shownDay()` is showing what it's
showing — `'pinned'`, `'most recent run'`, or `''` for a live hover — shared by
`setReadout(i, tag)`'s pill and the zone panel's title tag, so the two always
agree without each deciding for itself. The pinned day is drawn **dashed**
(bars) and as a **hollow ring** (frequency panel) against hover's solid
outline and filled dot, so both can be on screen at once and still read as two
different things. Like zoom, the pin itself is view state and deliberately not
persisted in `runviz.prefs.v1`.

A pan ends in a mouseup on the canvas, which the browser then reports as a click —
`draggedNotClicked` (set from `drag.moved`, threshold 3px) is what stops a pan from
pinning whatever it happened to finish over.

**Window-start marks.** Every line on every panel is an average over a window
*ending* on the marked day, and where that window starts used to be a number in
the legend and nothing on the chart. `markWindowStarts()` marks the first day
inside each window — a dot in that window's own colour, plus a faint dashed line
down through the plot — so each line's reach is something you can see against the
bars it covers. Every panel gets them: the bars and the three window panels mark
the four windows (`winMarks()`), and the VDOT panel marks its own `WINDOW_VDOT`
in `--vdot`, since that window is its own thing.

The dot sits **on its own line**, at that line's value on the start day — each
caller passes its own y mapping in as `yAt`, so the dot reads as a point of that
line rather than a tick floating above it, and which colour means which line
needs no working out. Panels with no line for it to sit on fall back to a row
just under the top inset (`MARK_Y`): the bars, where a window isn't a series at
all, and any day the VDOT line is undefined for.

**Both** marked days get a set, the same way both already get a bar outline and
a line dot: hover's dots are filled and its dashed lines the stronger of the
two, the pin's are a hollow ring and fainter — the same solid/dashed, filled/ring
language as the day markers themselves. For any one window the two sets can
never land on the same day: a window start is one fixed distance back from its
day, so two different days have two different starts. That is what makes drawing
both readable rather than eight dashed lines in a heap, and it is why the marks
key off `hover` and `selected` directly rather than through `shownDay()` — which
also falls back to the most recent run, and would leave marks on screen
permanently with no marked day under them.

A window reaching back past the left edge of the plot has no start to mark
there, so it gets a **chevron** at that edge instead, in its own colour: the
window is still in play, its beginning is just out of view — or, for the long
windows early in the history, before the first day there is (which is the honest
reading, since everything is divided by its full window either way). The
chevrons stack rightwards, one slot per window — `m.slot` is the window's own
index, so a window that is hidden or whose start is on screen leaves a gap rather
than shifting the rest — which keeps several off-screen windows countable. When both days have the same window
off-screen the hover chevron takes the slot, since "off to the left" is the whole
message and both would be saying it; the pin's own chevron is drawn thinner and
at half alpha, matching its dots.

The marks follow `visLines`, unlike the readout: those toggles exist to declutter
exactly these lines, and a mark for a line that isn't drawn is clutter of the
same kind — which is also why hiding `1w` takes its dot off the *bars* panel too,
where there is no line to hide.

**The default view** is the two longest windows' worth of days added together
(`defaultSpan()` = `WINDOWS[3].days + WINDOWS[2].days`, 448 + 112 = 560 at the
defaults; 1/4/16/32 would give 48 weeks) ending on the most recent day, not the
whole history: zoomed all the way out, years of bars are a few pixels each and
the short windows are a solid band of noise. The longest window alone is exactly
the span the longest line is computed over; the next one down on top of it
leaves room to see where that line came from. Scrolling out to
the full history still works — the clamp is unchanged. `resetView()` is that
same view, shared by the double-click, the `r` key and the settings Reset so
"reset the zoom" means one thing everywhere. Changing `windowBase`/`windowMult` moves what
`defaultSpan()` returns but deliberately does not re-fit the current view.

**Sidebar, not inline.** The readout used to sit directly above the chart, so
scrolling down past a tall chart lost sight of it — no good once there were five
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

- **The four windows** — `WINDOWS`. There are always exactly **four**
  (`N_WINDOWS`): four is what the colour scheme and the readout tables are built
  for, and a fifth would mean finding a fifth hue that separates from the other
  four. *Which* four is set by two numbers in the sidebar, and
  `rebuildWindows()` derives the rest — each slot is the one before it times the
  multiple:
  - `windowBase` — weeks in the shortest window, **1–8**, default **1**
  - `windowMult` — the multiple between one window and the next, **2–8**,
    default **4**

  The defaults give the 1 / 4 / 16 / 64 weeks this was designed around
  (week-ish, month-ish, quarter-ish, year-ish), stored internally in days
  (7 / 28 / 112 / 448). A slot's **key is its index** (`s0`…`s3`), not its week
  count, so it keeps its colour and its show/hide setting when the numbers behind
  it change. Nothing stops the long end running past the length of the history
  (8 × 8 gives 4096 weeks); those lines just sit near zero, which is the honest
  reading given everything is divided by its full window.

  Three sets of series are derived, one value per
  window per day, all expressed as rates so windows of very different lengths
  share an axis: `volSeries` (km/week), `freqSeries` (run days/week) and
  `runSeries` (runs/week).
- **MAX** — an extra series appended to each set at index `MAXI`, the per-day
  **max across the four windows** — the upper envelope, not a running all-time
  best. It answers "at whatever timescale flatters me most, where am I".
  Drawn last, in plain ink (`--wmax`) at full strength, over the four windows at
  `WIN_ALPHA` 0.55 — **`fadeWindows`** turns that transparency off, which is
  what you want when comparing two windows against *each other* rather than
  against the max: every crossing is legible at full strength, at the cost of a
  busier panel. It's what makes the max read as the primary line without being
  any thicker. It was on by default and is now **off** (as is the MAX line
  itself, `visLines.max`), since with MAX hidden there is nothing for the fade
  to defer to. No area fill either — the single-line panels this grew
  out of each had one, and the VDOT panel still does, but with five lines
  crossing each other a shaded region under the max only reads as the max line
  having a shadow. **`maxBehind`** flips the z-order: MAX is the upper envelope,
  so wherever it equals a window line the two sit exactly on top of each other
  and whichever is drawn second wins. Last by default, which is what makes it
  the line read first; behind instead, the shortest window stays visible along
  the stretches where it *is* the max and MAX shows only where it pulls away.
  Purely a draw order — nothing computed changes, so the toggle only redraws.
  **All five are the same weight** (`LINE_WIDTH`) — the max
  was briefly drawn thicker as well as darker, which read as heavy-handed and
  wasn't carrying any of the work: full-strength ink against four
  semi-transparent hues separates it at any width. Hiding a window line (below)
  does **not** take it out of MAX — MAX is always the max of all four. In practice it tracks the 1-week line most of the
  time and pulls away from it exactly when a short window collapses (a taper, an
  injury, a holiday) while a longer one is still high — which is the case worth
  seeing.
- **Per-line show/hide** — `visLines`, five booleans (`max` plus each window's
  key), persisted in `runviz.prefs.v1` as `lines`. The control is the legend's
  own "Windows" row, whose swatches are checkboxes; an unticked one dims via
  `.legend .item.off`. This is a view filter and nothing more: a hidden line is
  still in the hover readout and still counts towards MAX. Three things do
  follow it, because all three exist to make the remaining lines readable — the
  y-axis scales to the highest line actually **drawn** rather than to MAX
  (except the fixed 0–7 run-days axis), the hover/pin marker moves to MAX, or to
  the shortest window still drawn when MAX is off, and a window's start mark
  goes with its line (see "Window-start marks" above).
- **The two windows the target maths needs** — a *target* can only be a single
  number, so it keeps exactly one volume window and one frequency window:
  `IV`/`IF`, **slots 1 and 2**, i.e. `WINDOW_VOL` and `WINDOW_FREQ`, which at
  the defaults are the 4 and 16 weeks that used to be settings of their own.
  Slots rather than free numbers, so the target is always read against a line
  that is actually on screen. `avg`, `perWeekAt()` and `perWeekRunsAt()` are the
  single-window views the tiles, the table and the target maths read.
  **`windowBase`/`windowMult` therefore move the targets — and, for a separate
  reason, the bar colours too**, since the verdict compares neighbouring windows
  directly. Deliberate, but worth knowing before wondering why a whole history
  changed colour.
- **Verdict** (`classify`) — the **bar colours**. One sentence: it is
  **the shortest window slot that is at least as high as every longer one**,
  read off the day's **distance per week** (the same `volSeries` panel 2 draws).

  | | | |
  |---|---|---|
  | `w0 ≥ w1, w2, w3` | **highly productive** | this week tops everything |
  | else `w1 ≥ w2, w3` | **productive** | the block tops the quarter and the year |
  | else `w2 ≥ w3` | **steady** | the quarter tops the year |
  | else | **unproductive** | only the year is on top |

  Each rung has to beat **every** longer window, not just the next one along.
  `w0 ≥ w1` on its own would call a week highly productive while it sat below the
  quarter *and* the year, which is not a claim worth making.

  Three things fall out of that and are worth holding onto:

  - **`c.at` is a window slot, not a rung index**, and it is the slot whose
    colour the bar is painted in — so a purple bar says "the purple line is the
    highest one", with no legend lookup in between. `verdictWhy()` spells the
    same thing out in words under the verdict ("4w ≥ 16w, 64w", or "64w
    highest" for the longest window, which has nothing longer to beat). The
    readout's verdict pill is **always two lines**: the verdict, then that
    `.why` at 10px under it — a rest day gets an empty second line, so the pill
    is the same height either way.
  - **Unproductive is the same rule, not a fallback.** Slot 3's rung is
    vacuously true — there is nothing longer for it to beat — so the chain always
    terminates at it, and "unproductive" is just `at = 3`. It is also an honest
    reading: failing every earlier rung forces `w3` strictly above all three
    others, so the longest window really is on top whenever it gets there.
  - **Highly productive ⟺ the 1-week line *is* the MAX line.** `w0` topping
    every longer window is exactly `volSeries[0][i] === volSeries[MAXI][i]`. The
    headless probe asserts the equivalence in both directions.

  Flat colours, no ramp: a rung either holds or it doesn't. A **rest day has no
  verdict at all** (`classify` returns `null`) and keeps its pale `--rest` stub,
  so every colour on the chart belongs to a run.

  **Why not judge the run.** The old verdict was the day's distance over a target
  for that day, ramped by how far past it landed. It never really worked: a
  deliberately easy day, a long run and an interval session are all the "wrong"
  length on purpose, so the colour said more about which *kind* of day it was
  than about whether training was going anywhere. Comparing the windows instead
  asks the question the chart is actually for. What went with it: the long-run
  scheme (its 1.5×/2× centres and `longNeedsSingleRun` setting), the `stableBand`
  setting, and the OKLab ramps — see "Colour system" for the hatch that went with
  the long-run scheme.

  **The skew, and why it is fine.** On a day you ran, the 1-week window *contains*
  that run, so slot 0's rung is the easy one to clear: on a real 1339-day export
  the verdicts come out **393 highly productive / 137 productive / 67 steady / 6
  unproductive** across 603 run days. That is not a bug and it is not (only) the
  rule flattering itself — this history is a volume ramp from late 2024 onwards,
  so short windows genuinely do sit above long ones most of the time, and the days
  that actually work against the ramp are the rest days, which are grey by design.
  The first cut of this rule compared each window only against the next one along
  and gave 423/137/42/**1**; requiring every longer window is what moved 30 days
  out of the top verdict and 5 more into the bottom one.
- **Target** — still computed and still shown (the readout's distance line and the
  data table's Target column), it just no longer colours anything. What a run that
  day had to be to hold the average steady:
  **weekly volume ÷ (run days per week + 1)** when long runs are active, otherwise
  ÷ run days per week (which is just mean km per *running* day). Weekly volume comes
  from `WINDOW_VOL`; run days per week comes from `WINDOW_FREQ` — the target blends
  both windows on purpose, one for "how much" and one for "how often". The `+1` is
  because one run per week is expected to be the long one, so a 3-days/week week is
  1+1+2 = 4 target-sized efforts.
  Computed **only from the window ending yesterday**, never including the day being
  judged (comparing a run to an average it is part of is circular; and the raw
  average also moves when an old run drops out of the window).
  A median-run mode existed briefly and was removed — once the long run is counted
  as an extra day the mean is no longer skewed the way that was meant to fix.
  **This is the one place the long-run idea survives**, because it is the maths the
  Today's target what-if box is built on and that box was kept as it was;
  `LONG_MIN_RUNS_PER_WEEK` and `longOn` live on for it alone. Keeping the per-day
  target and the what-if box on the same formula is what stops today's tile
  disagreeing with today's readout.
- **Everything is divided by its full window, always** — every one of the four
  windows' series, and the target's two. Each window's own first stretch of days
  therefore ramps in from zero rather than being extrapolated: one run on day one
  is 0.11 run days/week over the 64-week window, not "7 a week" off a single
  elapsed day. This is also why the four lines fan out from zero at different
  rates over the first year or so of history, and why MAX there is essentially
  always the 1-week line. A "days elapsed"
  ramp-in mode existed and was removed: it made the readout say "1 of 1 days" while
  the rate was computed against a 7-day floor, which was both inconsistent and not
  what the chart is for.

## Workout type (the other bar colouring)

`barColour` (the "Colour bars by" select) picks what a run's bar colour says:
`'verdict'` (everything above), `'workout'` (**the default**), or `'none'`. Workout type
paints each run day in the **pace-zone histogram's own strong colours** —
repetition/interval/threshold/marathon/easy — plus Recovery in the histogram's
own `leadRamps.recovery` grey-blue. Rest days keep the `--rest` stub either way.
The readout pill and a new table column name the type and the pooled share
that decided it ("71% threshold+", "57% interval+").

**Scoring, then pooling from the hard end.** Every lap of a run scores
**speed (km/h)^`wtExp` × distance (km)** towards the zone it was run in
(`zoneScoresOf()`). Then `workoutFromScores()` walks from the hardest zone
down, pooling each zone's score with every faster zone's, and the **first pool
to reach `wtShare`% of the run's total** is the type:

| pool | type |
|---|---|
| repetition | repetition |
| interval + repetition | interval |
| threshold + faster | threshold |
| marathon + faster | marathon |
| easy + faster | easy |
| none reached it | recovery |

Two settings, in the sidebar: "Speed weight" `wtExp` (0–4 in halves, default
**2**; 0 is plain distance in each zone. It used to be × *duration*, which
at the same exponent is one power of speed weaker: the old default, speed² ×
minutes, is exactly the new exponent **1**, and gives identical counts) and "Wins at"
`wtShare` (1–100%, default **35**; 50 would be a strict majority, and 35 was
picked by use as the point where hard sessions read as hard). Standing and Walking
laps score nothing. Recovery is what's left when no pool reaches the share.

How this got here, because each step fixed a real run:

1. **A ladder of minute thresholds** (5 min repetition, 10 min interval+, …).
   It turned on whether a few minutes of strides happened to clear a cut-off
   rather than on what most of the run was.
2. **Highest single zone score wins.** It fixed that, but then **30 Sep 2026**
   (43% easy, 28% interval, 29% repetition under the old × duration score) came out Easy, because the hard
   work was split across two zones and neither beat the easy running on its own.
3. **Pooling from the hard end** (now). 30 Sep is Interval at 57% interval+,
   and **16 Sep 2026** (3 × 8 min threshold, then strides) is Threshold.
   With × distance at exponent 2 they read 32/0/0/32/36 (Interval) and 22/0/65/0/13
   (Threshold) across easy/marathon/threshold/interval/repetition.

Stale `wtRepMin`…`wtEasyPct` prefs from the ladder are ignored and dropped on
the next save. A probe re-deriving every run's scores straight from its laps agrees on all
665 runs of a real export. Counts by `wtExp` at `wtShare` 50, before `gapPace` became the default
(recovery/easy/marathon/threshold/interval/repetition). At the current defaults
(`wtExp` 2, `wtShare` 35, `gapPace` on) they are 4 / 322 / 237 / 52 / 30 / 20.

| `wtExp` | counts |
|---|---|
| 0 | 5 / 373 / 226 / 44 / 10 / 7 |
| 1 | 5 / 364 / 223 / 49 / 16 / 8 |
| 2 | 5 / 360 / 219 / 52 / 18 / 11 |
| 3 | 5 / 359 / 214 / 52 / 19 / 16 |

Marathon stays high at every setting. That's this runner's training style (a
lot of running right at the easy/marathon boundary), not a quirk of the rule.

It reuses the histogram's own lap binning, `binLap()` (split out of
`paceHistogramFor()` along with `lapsOfAct()`/`lapsOfDay()`), so the bar colour
and the histogram can't disagree about which zone a lap was in, and it follows
`gapPace`, the VDOT window, `minLapM` and `gapVdot` exactly as the histogram
does. `ZONE_BARS` doesn't affect it. **Per run, not per day** (`workoutsOf(i)`,
one entry per activity): a day with an interval session and an easy jog is both,
not a blend of them. Scores are cached in `zoneScoresOf()` (one array per
activity), keyed on those four settings plus `wtExp` (`wtShare` is applied after, so
it isn't in the key), so handlers don't have
to invalidate anything.

## Days with more than one run

58 days of a real export have two or more runs (54 with two, 4 with three), and
37 of those mix workout types. Three places show them apart:

- **Stacked bars.** The day's bar is split into one segment per run, earliest at
  the bottom, with a 1px `--surface-1` seam at each join. The axis is log, so
  heights don't add: the bar keeps **the day's total height** and each segment
  gets its share of the distance as a share of that height (linear inside the
  bar). The alternative, drawing the bottom run at its own log height, crushes
  whatever sits on top of it into a sliver. `barSegments(i)` gives the
  segments. In verdict mode they all share the day's verdict colour (a verdict
  is about the day), so only the seam shows the split. In workout mode each
  segment has its own type's colour.
- **The readout.** Its distance sub-line lists each run, and in workout mode the
  pill names each run's type in order ("Marathon + Easy") with the figures
  behind them, the border taking the hardest one.
- **One pace-zone histogram per run**, stacked in the zone card under a
  "Run 1 of 2 · 12:12 · 8.06 km · 37:22 · Marathon" heading (on a single-run
  day, just "Run · 18:05 · …", so the time, distance and type are always there).
  The heading ends with each type's share of that run's workout score,
  recovery / easy / marathon / threshold / interval / repetition, each in its
  own colour ("0% / 29% / 0% / 62% / 0% / 9%"). Recovery stands in for the
  "misc" end, since Standing and Walking score nothing. They share one
  y-scale so their bars compare directly. `paceHistogramFor(i, a)` takes an
  optional activity index. The per-run histograms sum to the day's one to
  1.4e-14. `mountZoneHist()` is the
  per-canvas half of `renderZonePanel()`, split out so it can run once per run.

Run order comes from each activity's start time `t`, which is now stored on
every `acts` entry, with a day's `acts` sorted by it. The CSV isn't in time
order, so file order says nothing about which run came first.

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

A day's own VDOT is the **max implied VDOT over every effort that day**: each
**activity treated whole**, plus each of its **laps that are at least `MIN_LAP_M`
long** (default 1500m, adjustable 100–5000m).

**An effort is an activity, never a day.** This used to treat the whole day as
one effort, which on a day with two runs glued them into a single continuous
one — and that *inflates* VDOT, because `pctVo2max()` falls with duration, so
the same pace held for twice as long implies a much higher ceiling. On a real
export it hit **33 of 57 multi-run days, by up to 2.05 VDOT**. It barely touched
the rolling-max *line* (2 days of 1339, at most 0.44 — the all-time peaks were
set by single-run days anyway), but the day readings in the readout and the
height of the near-max dots were wrong on every one of those days. `acts` in the
data pipeline exists for this: the day's runs are kept apart rather than summed.

The length floor exists because `pctVo2max()` is
calibrated against race durations — roughly 3.5 minutes and up — and a very short,
very fast lap (a sprint, the last few strides of a rep) computes a VO2 cost far
beyond what's actually reached in that time, wildly overstating VDOT: a real
export surfaced a day reading VDOT 70+ against a true ceiling around 52, traced to
a short fast lap. No *tag* filtering beyond the length floor — a slow warmup or
rest lap that happens to clear it still never wins the search on its own. Checking
each activity whole too (not just as a fallback for ones with no lap data) is
what makes an evenly-paced tempo run or race its own best evidence when it beats
every individual lap. The **VDOT panel** is the rolling max of that across the trailing *VDOT*
window (`WINDOW_VDOT`, default 50 weeks — the only window still adjustable, and
the only one that wants years rather than weeks, because "what's my fitness
ceiling" and "how often am I running" are different-timescale questions). It's a plain sliding-window max
(monotonic deque, O(N)), not a target, so — unlike the volume/frequency target math
— there's no circularity to avoid in including the day itself.

**Near-max days.** The panel's line is a rolling *max*, so a session that came
close to the ceiling without beating it leaves no mark on it at all: the line
carries on flat, and a day worth noticing looks exactly like a rest week. The
dots put those days back. One per run day whose own reading (`dayVdot[i]`) is
within `vdotNearPct` (default 5%) of the peak in force *that day* (`vdot[i]`),
drawn at **the day's own value**, not on the line — so a near miss sits just
under the line and a day that set, or re-equalled, the peak sits on it.

**Both ends of the range are real modes**, which is why it runs 0–100 rather than
around the default. **0%** is exactly `dayVdot[i] === vdot[i]` — only the days
that actually set the peak, which on a real export is 12 dots sitting on the
line's own step-ups (no epsilon needed: the day that set the peak *is* where the
rolling max read it from, so the ratio is exactly 1). **100%** is every run day
with a reading, which turns the panel into a scatter of every run's own VDOT
under the ceiling line. The counts on a real 1339-day export, over 603 run days:
0% → 12, 10% → 63, 25% → 460, and 50% upwards is saturated at ~all of them.

Two things the wide range forces:

- **The dot radius follows the crowding**, not the zoom: 2.75px down to 1.2px,
  from the mean spacing between the dots *actually drawn* (`plotW() / n * 0.3`,
  clamped). At the 5% default a few dozen dots want to look aimable; at 100%
  a fat dot would be a solid band. The surface-coloured ring is dropped below
  r 2.2, where there is no room for it inside the dot and it only reads as a
  paler dot.
- **The y-axis opens up to fit the slowest day in view**, which squashes the
  line towards the top — at 25% the floor drops from 40 to 20 on a real export.
  That is the honest range of the data, not a bug, and it is the cost of asking
  for the wide view; the floor is deliberately not capped, since clamping the
  dots would make them lie about their value.

**The cut-off itself is drawn**, as a dashed line at `vdot[i] * (1 -
vdotNearPct/100)` — the peak line scaled down by the threshold, so "within 10%"
is a place on the panel rather than a number in the title, and every dot is
visibly above it. Not drawn at 0%, where it would land exactly on the peak line
and have nothing to say. Deliberately **not** folded into the y-extent the way
the dots are: at 100% the cut-off is zero, and letting that set the floor would
flatten the panel. It clips instead, which reads correctly — a cut-off below the
panel is one nothing can fail.

`vdotVsPeak(i)` is that ratio (1 = it is the peak; it can never exceed 1, since
the window includes the day itself) and `isNearMax(i)` is the threshold on it.
The readout says the same thing in words on the VDOT line — "· at the peak" or
"· 5.3% off the peak" — appended by `vdotBasisText()`.

Three things worth knowing:

- **Peak-setting days get no second marker.** Landing on the line is the
  distinction, and the gap under it is the whole point of every other dot. On a
  real 1339-day export, 63 of 603 run days clear 10%, of which 12 *are* the peak.
- **The dots move the y-floor.** They sit up to `vdotNearPct` below the line, so
  `drawVdot()` folds the qualifying `dayVdot` values into `yMin` or the panel
  clips them. Only the floor can move — no reading is ever above the peak that
  contains it.
- **Draw-time only.** Nothing computed depends on either setting, so both
  handlers just `drawAll()` — no recompute, and not even `syncLabels()`.
- **The panel title carries what the dots mean** (`.vdotNearNote`: "— dots: days
  within 10% of it, above the dashed line"), so the panel needs no legend of its
  own, and the note goes away when the dots are off. `drawVdot()` owns that
  string rather than `syncLabels()`, because only the draw knows whether the
  dashed line ended up on screen — past roughly 25% it is below the panel floor,
  and the ", above the dashed line" clause drops itself when it isn't there. At
  0% the note reads "dots: the days that set it", since "within 0% of it" says
  the same thing worse.

**Laps** come from Runalyze's `splits` column: `<tag><km>|<time>` pieces joined by
`-`, e.g. `I1.012|3:54`. The tag (`W`arm-up, `I`nterval, `R`est/`P`ause, `C`ooldown,
`U`ntagged autolap) is read from real exports but not used for anything — see above.
They hang off their own activity in `acts`, not off the day. An activity with no
parsed splits (an older one, or one Runalyze didn't lap) falls back to being
treated as a single lap — **per activity**, so one run of a day having splits
never drops the other run's minutes, nor averages the two into one pace.

**Grade-adjusted pace** is **two separate toggles** — `gapPace` **on** by
default, `gapVdot` **off** — each
swapping the *time* its half of the pace maths reads for the equivalent flat one:

- **`gapVdot`** ("Grade-adjusted pace for VDOT", under VDOT panel) — the VDOT
  search, so a hilly run stops reading as an easy day. Moves the day VDOTs, the
  VDOT panel, **and the pace-zone boundaries**, since those are read off the
  day's VDOT.
- **`gapPace`** ("Grade-adjusted pace", under Pace zones) — where the histogram
  puts each lap, so its minutes stop landing in Recovery when they were a
  climb. Moves the laps only, **never the zones**: VDOT doesn't see it, so the
  handler only re-renders the histogram. (Probe on a real export: toggling it
  changes the histogram on 580 days and `vdot` on 0.)

They used to be one `useGap` that did both; a stored entry still carrying it
turns both on, and is dropped on the next save. Neither moves anything else:
distances, volume, frequency, targets and
verdicts are all untouched, because kilometres run are kilometres run.
`gapVdot` stays off by default because the raw pace is what was actually run and
the fitness ceiling should be read off that. `gapPace` is on by default because
for the histogram and the workout type, how hard a climb was matters more than
how slow its raw pace looked.

Runalyze's `gap` column is grade-adjusted **speed in km/h**, not a pace and not a
factor (checked against real activities' own distance/time: a flat run's `gap`
sits within a fraction of a percent of its raw speed, a 34 m/km day about 7%
above it). `gapRatioOf()` turns it into `gap ÷ raw speed`, clamped to 0.5–2, and
the pipeline stores the result as *time*: `gsec` next to `sec` on every activity and
every lap. On a real export the ratio's median is 1.005 and
its max 1.118.

Two things are worth knowing about that ratio. Runalyze reports GAP **once per
activity**, which is also the level `acts` stores a time at, so the same ratio
is spread over every lap of that activity — the only honest
option available, since it says "this run was worth this much more than its raw
pace" without pretending to know which kilometre the hills were in. And **not
every activity has one** (661 of 664 runs in a real export; the missing ones are
old). `effortSec()` — one function, since an activity and a lap are
the same shape — falls back to the raw time whenever there is no adjusted one,
so the toggle can only ever re-time a day, never blank it. It takes the toggle
that applies as its second argument (`effortSec(lap, gapPace)`).

`gapUsable` (`DATA.gapCount > 0`) is the real gate on both: an export without a
usable `gap` column disables both checkboxes and shows them unticked, but leaves
the remembered `gapVdot`/`gapPace` alone, so loading such a file and going back
to one with GAP doesn't silently forget the settings.

A bin's height is the adjusted minutes too, not the real ones — the time implied
by the pace the bar is drawn at, so a day's bars still sum to one coherent
duration (checked: they sum to exactly `gsec ÷ 60`). `vdotBasisText()` labels
the figure "grade-adj." when the time behind it has been adjusted, rather than
quietly disagreeing with what Runalyze and the watch say — on its second line,
next to the VDOT figure, for the width reason in the readout section above.

**Pace zones** (easy/marathon/threshold/interval/repetition) are five %VDOT bands,
anchored at 65.7/81.8/88.0/97.6/106.2% (back-solved from the vdoto2.com example
above) with the boundary between two neighbours at their midpoint, so the bands
tile the %VDOT axis with no gap or overlap. The fast end (above repetition) is
still closed off at a practical 120% ceiling purely so the top zone has something
finite to split into sub-bands — not a physiological limit, just where the binning
stops mattering. The sub-band count per zone is `ZONE_BARS`, a setting (default 3,
adjustable 1–20 — "Pace-zone bars" in the settings sidebar). `zoneBandFor()` maps
a %VDOT to one of the `5 * ZONE_BARS` bins (`zone*ZONE_BARS + subBand`, continuous
easy0.. , marathon0.., ...).

Easy's slow end used to be closed off the same way, at a practical 40% floor —
which meant a genuinely slow recovery jog, actual walking, and standing still at
a red light all landed in the same bin. They no longer do. Three fixed or
per-day thresholds sort a lap out **before** it ever reaches `zoneBandFor()`:

- **Standing** — slower than `STANDING_MAX_VEL` (20:00/km), fixed in absolute
  pace rather than %VDOT, because "am I moving at all" doesn't scale with
  fitness the way effort zones do.
- **Walking** — between `STANDING_MAX_VEL` and `WALKING_MAX_VEL` (10:00/km),
  also fixed in absolute pace for the same reason: walking speed doesn't scale
  with running fitness.
- **Recovery** — between `WALKING_MAX_VEL` and easy's real floor (below): a
  genuine jog, just too slow relative to *this* runner's fitness to call
  properly "easy".

Easy's own floor, `EASY_FLOOR_PCT` (45% VDOT, picked so a mid-50s VDOT lands it
around 7:00/km rather than back-solved from anything), is what separates
Recovery from real Easy training. `easyFloorPct()` also clamps that floor to
never sit below what `WALKING_MAX_VEL` works out to in %VDOT terms for that
runner's VDOT — otherwise Recovery would have to cover paces faster than
walking, which makes no sense — nor above the marathon boundary. For a low
enough VDOT this collapses Recovery to nothing: if walking pace is already real
aerobic effort for that runner, there's no slower-than-easy jog left to call
recovery. Only repetition's fast edge is still reported open-ended; every other
edge, including easy's floor, is now a real two-sided range.

Standing, Walking and Recovery are each a single, undivided bar — `ZONE_BARS`
only ever splits the five real Daniels zones — drawn leftmost (slowest first),
in that order, separated from the five zones by a bar width of empty space
rather than a divider line. They're flat neutral greys rather than a zone hue
(`--nocolour` for Standing, then two steps of an OKLab fade from `--nocolour`
towards easy's own weak blue for Walking and Recovery — see `leadRamps` in
`buildRamps()`), so the transition visually previews "getting closer to real
training" without implying they're graded pace zones themselves.

**The pace-zone histogram** (below the five main panels) is always up rather than
hidden until something is pinned, and follows `shownDay()` exactly like the
readout: hover, else the pin, else `lastRunIdx` (the most recent day with a
run), tagged with the same `dayTag()` pill the readout uses ("pinned" /
"most recent run" / nothing while actively hovering) so it's always clear
*why* that day is showing. It used to be deliberately pinned-day-only and NOT
follow hover — a lap walk plus a full-canvas redraw on every mouse-move looked
like the wrong trade — but that traded away too much: the panel is far more
useful when it tracks whatever you're actually looking at, and in practice a
single day's lap walk is cheap enough that following hover doesn't cost
anything noticeable. It judges its day's laps against **that day's own rolling
VDOT** (the fitness level at the time), not today's — a hard rep from years ago
is read against years-ago fitness.

A day with no run, or one that predates the very first logged run (VDOT isn't
a meaningful zero, so there's nothing to bin against — `paceHistogramFor()`
returns `null` for both), still renders the full legend, axes, grid and zone
dividers exactly as usual — just with an all-zero stand-in in place of real
`bins`, and "No run that day." (or the VDOT-not-yet-available wording) centred
over the empty canvas via `.zone-empty-overlay`. It used to swap in a small
"nothing here" block instead of the canvas, which shrank the whole card on
every rest day and grew it back on every run day — a distracting flicker when
scanning quickly through a run of days while following hover (see above). The
card is only ever hidden completely (`zonecard.hidden`) when there is no day to
show at all — panel toggled off, or no run anywhere in history yet. An empty
day also skips the bin-hover interaction entirely (there's nothing behind the
zero-height bars to report, and `vdotHere` may not even exist) rather than
wiring up a `mousemove` listener that would have nothing real to say.

Hovering a bin (this redraws the whole bar canvas — cheap, unlike the lap walk
above it, which only runs once per triggering event) shows its pace range in
that histogram's own `.zone-hover` line:
the two %VDOT bounds either side of the bin, converted back to pace via
`velocityFromVo2()`. Higher %VDOT is faster (lower min/km), so the bin's *slow*
edge comes from its *lower* bound and vice versa. Repetition's fastest bin reads
its open ceiling off `ZONE_BOUND_PCT`'s practical 120% bound (see the comment on
that constant) rather than a real boundary, so it's reported as open-ended
instead of a two-sided range: "faster than" **its slow edge**, the one real
boundary it has. It used to quote the fake 120% edge, so the ranges read
"3:27–3:18", then "faster than 3:10", with a gap between them. Standing, Walking and Recovery
aren't %VDOT bins at all, so their hover text reports their own fixed or per-day
pace bounds directly rather than going through `paceRangeFor()`. Every bin's
hover text ends with **both** measures, "3.2 min · 0.60 km", whichever one the
bars are drawn at.

**Bar height** (`zoneAxis`, "Bar height" under Pace zones, `'dist'` by default)
picks whether the bars are the minutes or the kilometres spent in each bin.
`paceHistogramFor()` returns both — `{ mins, km }`, two arrays of the same
shape — so the setting is draw-time only and its handler just re-renders the
panel. The km are raw lap distances, never grade-adjusted (kilometres run are
kilometres run); a day's km bins sum to its lap distances exactly (probe on a
real export: max error 1.4e-14 over 604 run days). The y-axis ticks keep one
decimal when `niceTicks` lands on a 2.5 step, which short distances can.

**Colour**: five hues (blue/green/yellow/orange/red) validated with the `dataviz`
skill's palette checker using **adjacent** pairs, not all-pairs — this is an
ordered bar histogram where neighbours are what matters, the same basis the
checker itself uses for stacks/bars/lines. Light mode's worst adjacent CVD ΔE
was 20.0, dark mode's 12.5, both comfortably above the 8.0 target — **for the
four zones other than Threshold**; Threshold in both modes is now a deliberate,
documented exception to that check (below), not an oversight.

Threshold's own weak→strong pair is picked to share nearly the same OKLab
*hue* at both ends in a given mode, not just any hex that independently passes
lightness/chroma. The zone histogram interpolates weak→strong per sub-band
(`zoneRamps` in `buildRamps()`), so a colour that's fine on its own but drifts
hue partway to a different colour still breaks visually: an early light-mode
strong (`#923c00`) drifted ~38° toward red, so a zone meant to read as "gold
throughout, just deeper" visibly turned red-brown at its fastest sub-bands —
which is what "Threshold 4 looks like dark red" was. When picking a zone's
"strong" colour, check that it stays close in hue to its own "weak" partner,
independent of whether CVD is even in scope for that zone.

**Threshold trades colourblind-safety for brightness and a true yellow, in
both modes — this is a private, single-user page, and that trade was made
explicitly, twice.** Two real problems, found with the validator and a gamut
search rather than by eye:

1. Gold/mustard hues (OKLCH H ≈ 70–100°) are gamut-starved in sRGB — max
   achievable chroma is only ~0.10–0.14 across the whole lightness range
   (confirmed by bisecting the sRGB gamut boundary per hue/lightness, not by
   eyeballing it), which is *why* the original palette landed on a muddy,
   barely-above-the-chroma-floor gold to begin with: nothing more saturated
   passing CVD is achievable in this hue family at any lightness.
2. Dark mode's original `--z-threshold-weak` (`#3d2d00`, OKLCH L 0.307) had a
   WCAG contrast of only 1.3 against the dark card surface (`#1a1a19`) —
   every sibling zone's weak swatch sits at 2.0–2.4 — so "Threshold 0" read as
   nearly invisible. That bug, not the muddiness, was the dominant complaint.

This went through two wrong attempts before landing — both worth recording
because each broke a different thing the validator can't see:

1. **First attempt** pushed dark mode's pair to a genuinely bright true yellow
   (L 0.85/0.75) — which then stood out as far *brighter* than all four other
   zones (whose strongs sit at L 0.51–0.66), an inconsistency the CVD checker
   doesn't catch because it only compares Threshold's neighbours, not its
   absolute brightness against the rest of the palette. **Brightness parity
   with sibling zones has to be checked by eye, not by re-running the
   validator.**
2. **Second attempt** matched light mode's lightness to its siblings (L 0.60
   strong / L 0.78 weak) but kept chroma roughly flat across the ramp (0.121 /
   0.13) while lightness dropped from weak to strong. The result went the
   *opposite direction* from every other zone: Marathon and Interval get
   visibly *more vivid* left→right (pale swatch → saturated swatch); this
   Threshold got visibly *muddier* left→right, because a dark, moderately-
   desaturated yellow reads to the eye as olive-brown, not "a deep yellow" —
   there is no perceptually "deep vivid yellow" the way there is a deep vivid
   blue or red. **A weak→strong ramp has to be checked for which *direction*
   it appears to move in, not just its endpoint lightness/chroma numbers** —
   this is also not something the categorical validator checks, since it only
   ever looks at the "strong" endpoints of each zone in isolation.

The fix for #2 (confirmed against the user with rendered swatches before
committing, given two wrong guesses already) was letting go of light-mode
brightness parity with siblings in favour of ramp *direction* parity: keep
both ends bright/pale rather than pulling strong down to match Easy/
Repetition's darker L≈0.51 cluster, so chroma still climbs from weak to
strong the same way Marathon/Interval's does.

- **Dark** (unaffected by the direction bug — its weak end is already the
  *lower*-lightness one, so chroma naturally climbs weak→strong just like
  every other zone): `--z-threshold` `#b18904` (L 0.65, C 0.132, H 88° — L
  matches Interval's 0.657 almost exactly), `--z-threshold-weak` `#8d6d05` (L
  0.55, C 0.111 — contrast 3.58 against the dark surface, now *better* than
  Interval weak's 2.36, not the worst of the five).
- **Light**: `--z-threshold` `#cfaa0a` (L 0.75, C at the gamut ceiling for
  that L/hue, H 93° — L sits with the Marathon/Interval cluster at L≈0.70–0.72,
  not the darker Easy/Repetition one), `--z-threshold-weak` `#ebdeb1` (L 0.90,
  a pale cream — deliberately much paler than strong so the ramp still reads
  as "gaining colour" left→right, at the cost of low contrast against the
  near-white surface, ~1.3, which the user has explicitly accepted here).

Hue differs slightly between modes now (88° dark, 93° light) since light's fix
came from a fresh search seeded at H 93; each mode's pair still shares one hue
end-to-end (avoiding the original hue-drift bug), which is the part that
actually matters for the ramp reading as one coherent colour. Neither pair is
CVD-validated against Marathon/Interval and neither should be — that check was
deliberately dropped for this zone. If colourblind-safety ever matters here
again, don't re-run the CVD search expecting a better answer: the gamut math
above already shows no more-saturated CVD-safe gold exists in this hue family,
so the honest fallback is the old muddy gold (`#7c5000` / `#b48b2e` light,
`#855e00` / `#3d2d00` dark) with the weak-end contrast bug fixed — not a hunt
for a yellow that passes, because none does.

## Running volume by pace zone

The pace-zone histogram answers "what did *this day* look like". These four
panels answer "what have the last N weeks been made of": the same lap binning,
rolled over each window and drawn as a **stacked area** — part-to-whole over
time, which is what the question is. `drawZoneArea(k)`, one call per window.

- **Whole zones only.** The histogram's `ZONE_BARS` sub-bands are collapsed away
  (`zoneBucketOf`, which maps a histogram bin to its zone by integer-dividing
  the sub-band out). "How much threshold have I been running" is not a question
  about threshold 2 — and it means `ZONE_BARS` doesn't move these panels at all.
  A probe confirms it: re-deriving the per-day buckets at `ZONE_BARS` 1, 2, 7 and
  20 gives bit-identical arrays.
- **Eight buckets, slowest at the bottom** — Standing, Walking, Recovery, then
  the five Daniels zones, exactly the order the histogram reads left to right.
  Standing and Walking are in the stack rather than dropped, so the bands add up
  to the kilometres actually binned instead of quietly losing the walking. Hard
  running is therefore the band on **top**, where a block of threshold work reads
  as a band thickening rather than as a line moving.
- **The total is the distance-per-week line.** Each band is a rolling sum over
  that window, divided by the full window and expressed per week, the same as
  every other panel (and with the same float-dust snap — see the gotcha). So the
  top of the stack *is* `volSeries[k]`, decomposed: on a real export the largest
  gap between `zoneAreaTot[k]` and `volSeries[k]` is **0.019 km/wk** at 1w and
  **0.002** at 64w, which is lap-distance rounding and nothing else. Every one of
  604 run days has something binned, and the worst single day is 10 m out.
  The top of the stack is also drawn as a faint plain-ink line, because the top
  band is usually a sliver and the total shouldn't be read off wherever that
  happens to end.
- **One panel per window, not four windows in one panel.** The stack is already
  eight deep; there is no version of this that puts four windows in one plot.
  **Only the longest is shown by default** (`PREF_DEFAULTS.zonePanels` =
  `{s0: false, s1: false, s2: false, s3: true}`): four of them at once is a lot
  of chart, and the long window is the one whose zone mix is a training decision
  rather than this week's weather. Each has its own checkbox, keyed by slot so it
  survives a change to `windowBase`/`windowMult`.
- **`zoneAreaMode`** — one select, four values, because both halves of the
  question are real: `'km'`/`'min'` stack the kilometres or the minutes per week,
  `'pctKm'`/`'pctMin'` stack each zone's **share** of the week on a fixed 0–100
  axis. The two share modes are derived from the same sums as their absolute
  twins, so only the km↔min half actually needs `recomputeZoneWindows()`; the
  handler does it either way rather than working out which half moved. In a
  share mode a day with nothing binned goes to zero rather than inventing a
  split. The panel titles name the measure (`.zaN`, set by `syncLabels()`).
- **Hover/pin marks** are the same language as every other panel — solid dot for
  hover, hollow ring for the pin, both riding the top of the stack, in that
  window's own colour. One window-start mark, in that window's colour, the way
  the VDOT panel marks only its own window.
- **Costs nothing.** `recomputeDayZones()` (the lap walk) plus
  `recomputeZoneWindows()` (the rolling sums) is **0.4 ms** over a 1339-day
  export, so every call site just does both via `recomputeZones()` rather than
  reasoning about which half its setting moved. It is wired to everything that
  moves where a lap lands: the VDOT window, `minLapM`, `gapVdot`, `gapPace`, and
  — rolling sums only, via `applyWindow()` — `windowBase`/`windowMult`.

**In the readout**, the shown day gets a `zoneGrid` block: one row per bucket,
**hardest first**, mirroring the panel read top-down. Both readings are always
there — the amount in whichever measure the panels are stacked at, and the share
as the dim note — so the share modes don't hide the kilometres and vice versa.
It reports the **longest zone-area panel actually on screen** (`zaReadoutSlot()`,
which returns -1 when none is), because a block quoting figures nothing is
drawing is worse than no block. Always all eight rows, so like the `winGrid`
tables it can't change the sidebar's height from day to day. Its swatches are
`.sw.fill` — a block rather than the line-shaped `.sw`, since these rows stand
for filled bands.

## Remembered settings

`runviz.prefs.v1` holds everything the settings sidebar and the what-if box can be
set to, so the page opens the way it was left: `windowBase`, `windowMult`,
`windowVdot`, `minLapM`, `gapVdot`, `gapPace`, `vdotNearDots`, `vdotNearPct`,
`barColour` (`'verdict'`/`'workout'`/`'none'`; a legacy `colourVerdicts: false` reads as `'none'`), `wtExp` (0–4, halves), `wtShare` (1–100), `zoneBars`, `zoneAxis`, `maxBehind`, `fadeWindows`, `panels` (`{vol, freq, runs, vdot, zone}`, each independently
show/hide — see below), `lines` (`{max, s0, s1, s2, s3}` — slot keys, which of
the five lines the three window panels draw), `zonePanels` (`{s0, s1, s2, s3}` —
slot keys again, which of the four stacked-zone panels are up; only `s3` by
default), `zoneAreaMode` (`'km'`/`'min'`/`'pctKm'`/`'pctMin'`), and `plan` (`null` = the what-if box follows real
history, `{km, days}` = edited). Three rules:

- **Read at the very top of the `if (DATA)` block**, above `WINDOWS` and
  `let WINDOW_VDOT`, because `recompute()` runs at load and reads `WINDOWS` — the
  declaration-order gotcha below. (`WINDOW_VDOT` isn't read by `recompute()`, but
  is declared alongside for the same reason. `MIN_LAP_M`, `gapVdot` and `gapPace` are declared further down, right next to
  `recomputeDayVdot()` — nothing earlier touches them, so they don't need to
  move. `ZONE_BARS` is declared
  right next to the `ZONES` constant, for the same reason.)
- **Validated field by field on load** (`loadPrefs`), against the same limits as the
  inputs, so a stale or hand-edited entry can only produce a state the UI can reach.
  `windowBase` (1–8) and `windowMult` (2–8) are rounded to whole numbers, and
  `windowVdot` to the nearest whole week, since those are the only units their
  controls can produce; `windowVdot`'s range is 1–260 weeks — it wants years
  rather than weeks. (`windowVol`/`windowFreq` used to live here as day counts;
  the four windows are derived from base and multiple now. A stale entry still
  carrying the old fields is simply ignored and dropped on the next save, as is
  one carrying the old week-count `lines` keys.)
  `minLapM` is rounded to the nearest 100m, range 100–5000. `vdotNearPct` is
  rounded to a whole percent, range 0–100 — 0 is a real setting (only the days
  that set the peak), so "off" is `vdotNearDots`, not 0. `gapVdot`/`gapPace` are plain
  booleans (a legacy `useGap` seeds both), and are kept even when the loaded export has no `gap` column to use it
  on — see "Grade-adjusted pace" above. `zoneBars` is rounded
  to the nearest whole number, range 1–20. `zoneAxis` must be `'time'` or
  `'dist'`, and `zoneAreaMode` one of `'km'`/`'min'`/`'pctKm'`/`'pctMin'`.
  `lines` and `zonePanels` take only real booleans, key by key. Anything that
  fails falls back to `PREF_DEFAULTS` for that field alone.
- **Written only when something is off-default** (`savePrefs`), and the entry is
  *removed* the moment everything is back to default. A page whose settings have
  never been touched leaves nothing behind.

`syncControls()` (with `syncPanelVisibility()`, `syncLineVisibility()` and
`syncZonePanelVisibility()` under it) is the one place state is pushed *into* the DOM — the markup carries
the defaults, and a remembered setting has to overwrite them at boot.
`syncLabels()` owns the text that *spells out* which four windows are in play:
`.winsN` (the three panel titles and the legend note), `.winLabel0`–`.winLabel3`
(each legend item's own "4w") and `.winVolN` (the data table's column header).

**There are two resets, and each owns only what sits next to it.**

- **Reset** in the settings sidebar: the window base and multiple, the VDOT
  window, the min-lap distance, both grade-adjusted-pace toggles, the near-max dots
  and their percentage, the pace-zone bar
  count and bar height, the MAX draw order, the window-line fade, the bar-colour mode and the two workout-type settings, the
  five panel show/hide toggles, the five line show/hide toggles and the four
  stacked-zone panels' toggles back to their defaults (all shown except MAX, and
  only the longest window's stacked-zone panel), plus the view back to its
  default span. It does *not*
  touch the what-if.
- **reset** in the Today's target tile: clears the what-if back to following real
  history, and nothing else.

Neither has to know what the other owns, because both just mutate their own state
and call `savePrefs()` — which rewrites the whole entry from current state, keeping
it if anything is still off-default and dropping it if nothing is. So a chart reset
with an edited what-if leaves an entry holding only the plan, and vice versa.

**Two keys**, for the two things worth doing without aiming at anything: `r`
resets the view, `t` releases the pin (Esc still does too — `t` is next door to
`r`, which is what makes the pair usable one-handed with the other hand on the
mouse). Both ignore modified presses, so ⌘R still reloads, and both ignore
anything typed into a settings input, where a plain `r` is a keystroke and not a
shortcut.

Double-clicking a panel still resets only the view (`resetView()` — the default
span, see "Window-start marks" above), which is view state and deliberately
*not* remembered — persisting it would fight the Reset button and open the page
mid-history.

**The settings sidebar** is the third sidebar-shaped thing on the page, on the
opposite side from the readout — `<aside id="settingsSidebar">`, always visible
rather than following `selected`/`hover` like the other two (a gear-button
toggle for it was tried and dropped — always-on won). Being a vertical list
rather than the horizontal chartcard header row it replaced meant `.ctrls` lost
its `margin-left: auto` (nothing to push right against in a column) and gained
`flex-direction: column; align-items: stretch` instead.

It is split into five `.setgroup` sections, **grouped by what each setting
moves** rather than by what kind of control it is — "which panel is this about"
is the question being asked when someone comes looking for a setting. A 1px
rule separates them rather than more whitespace, so the grouping doesn't cost
much height:

| Group | Holds |
|---|---|
| Volume & frequency panels | the five line show/hide swatches, the three panel show/hide boxes, `windowBase`/`windowMult`, `fadeWindows`, `maxBehind` |
| VDOT panel | its show/hide, `windowVdot`, `minLapM`, `gapVdot`, `vdotNearDots`/`vdotNearPct` |
| Pace zones | its show/hide, `zoneBars`, `zoneAxis`, `gapPace` |
| Pace-zone volume | the eight-bucket zone legend, the four stacked-area panels' show/hide, `zoneAreaMode` |
| Bar colour | the `barColour` select, then whichever of its two legends is in use: the four-verdict/rest legend, or the workout-type legend plus its five thresholds |

Two placements are worth naming. **The legend is split across two groups**, not
kept as one block — even though both halves are now literally the same four
colours: the window-line swatches are the show/hide control for those lines, so
they belong beside the panels they colour, while the verdict swatches belong
beside the toggle that switches them off. Each half says so in its own note, so
the repetition reads as the point rather than as an oversight. And **`minLapM` and `gapVdot` sit under
VDOT** even though both also move the pace-zone histogram — they are VDOT
inputs, and the histogram's zones are read against the day's VDOT, so that is
where they come from. `gapPace` is the one that only moves the histogram, so it
sits with it. Reset sits outside all four, since it owns the lot.

## Colour system

**One** four-colour scheme does two jobs, because they are the same job: the four
rolling **window lines** (slot 0 → slot 3) and the four **verdicts**. A verdict is
"which window slot is on top from here out", so slot *k*'s line and verdict *k*
share a colour, and a purple bar means the purple line is the highest one. Hexes
live in the CSS custom properties at the top of the file (light and dark, each
declared under three scopes — see the comment there).

| slot | verdict | colour | light | dark |
|---|---|---|---|---|
| 0 (1w) | highly productive | purple `--v-hp` | `#6b3fa0` | `#7f41b7` |
| 1 (4w) | productive | green `--v-pr` | `#2c8a52` | `#007440` |
| 2 (16w) | steady | blue `--v-st` | `#2880b0` | `#3e96ea` |
| 3 (64w) | unproductive | orange `--v-un` | `#e08a1e` | `#d97900` |

Plus `--wmax` for the MAX line — plain ink (`#0b0b0b` light, `#ffffff` dark)
rather than a hue, because it is the line meant to be read first and should not
compete as a fifth category. The VDOT panel keeps its own `--vdot` violet; it is
a single-series panel and not part of this scheme.

Rest days are a pale neutral `--rest` (this is also what the bar panel's rest-day
stubs are drawn in); with `barColour` set to `'none'` every run falls back to a
mid neutral `--nocolour`.

The earlier per-slot hues (`--w1` `#0060a6` blue, `--w4` `#00ab86` green, `--w16`
`#d57700` orange, `--w64` `#a3215a` crimson, and dark's equivalents) are gone.
They were a fine four-colour set but they made the bar/line correspondence a
legend lookup rather than something you can just see. Before them, one hue per
*panel* (`--vol` rose, `--freq` grey, `--freq2` teal), which encoded what the
panel title already says.

Validated on the **all-pairs** basis, not the adjacent one, which both uses need
for their own reason: four series crossing each other constantly in one plot, and
any two verdicts able to end up as neighbouring bars. Light clears it at worst ΔE
**9.3** (protan) / 15.6 normal-vision, dark at **10.9** / 21.5.

**Contrast.** Light's blue started as a much paler `#5fa4e6` (2.58:1 against the
near-white surface). That was fine as a *bar* and too faint as a *line*, which
these colours now also have to be — visibly so in a render, not just on paper. It
was pulled down to OKLCH L 0.57 for **4.26:1**, which costs nothing on CVD (9.3
either way; the binding pair is green↔orange, not purple↔blue), and the panels got
readable. Light's orange is the one WARN left, at 2.61:1, and it stays: a sweep of
that whole hue family found nothing darker that isn't a brown. Dark's purple and
green measure 2.77 and 2.96:1, which reads far stronger than the number suggests
for a saturated hue on near-black. The legend, the hover readout and the table all
label every line and name every verdict in words, which is the relief those
warnings ask for.

**The lightness pattern is load-bearing, not an accident.** Purple↔blue and
green↔orange are both hard pairs under red-green CVD (a naive purple/green/blue/
orange set lands at ΔE 2–6), and hue alone cannot fix either. So each mode splits
the four across two lightness rows — light: purple and green dark-ish, blue mid,
orange light; dark: purple and green dark, blue and orange light — which leaves
each *within-row* pair separated by hue, where those pairs are CVD-safe anyway,
and each *cross-row* pair separated by lightness as well. Pulling any one of the
four back towards the others' brightness collapses the pair it was split from.
Measured, not guessed: a gamut search over OKLCH lightness/chroma/hue with the
`dataviz` validator as the scorer, then a per-slot sweep to buy back contrast
without spending CVD.

The 45° hatch that used to mark long runs, and the `--hatch` variable behind it,
are gone with the long-run scheme — four hues on one channel is within what
colour can carry, so there is nothing left for a second channel to encode.

**The important constraint:** six mutually distinguishable hues do not exist
within one chart, which is why this set had to buy its separation with lightness
rather than a fifth and sixth hue — and, in the other direction, why collapsing
the window and verdict schemes into one was a real gain and not just tidiness:
it is four hues on the page doing the work of eight. The
earlier two-scheme design (normal blue↔orange, long violet↔olive, marked apart by
a hatch because *across* schemes colour could not separate at all — violet's
complement lands in the yellow-green that collides with orange, ΔE ~2) is the
measured record of that limit. Do not try to add hues; it has been measured and
it does not work.

Ramps are interpolated in OKLab (`hexToOklab` / `oklabToCss`) so mid-ramp steps stay
clean, precomputed once per frame. Only the pace-zone histogram needs them now —
the verdict colours are flat.

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
- Each activity is filed under that day. The day gets `values` (total km),
  `maxRun` (longest single run) and `nRuns` (count) — and then **`acts`, one row
  per activity**, each `{t, km, sec, gsec, laps}` (sorted by start time `t`) with its own parsed `splits` (each
  lap `{km, sec, gsec}` in turn). 57 of my days have more than one run, which is
  why the times are **not** summed into a day total: everything that reads a
  *pace* has to read one continuous effort. See "VDOT and pace zones" above.
- **Sport IDs are per-account**, so there is no way to detect "running" generically.
  `summariseSports` shows every sport with count / total km / median speed and
  pre-ticks a guess: the busiest sport with median speed 7.5–17 km/h, plus anything
  comparable in volume. Speed alone over-selects — cross-country skiing at 8.2 km/h
  sits squarely in running range.
- Parsed data is cached in `localStorage` under `runviz.data.v2` (`SCHEMA = 7`).
  `SCHEMA` guards what the cached numbers *mean*, not only their shape — the day
  attribution fix bumped it to 3 with the shape unchanged, because the cached values
  were wrong and can only be rebuilt from the CSV. It was bumped again to 4 when
  `sec`/`laps` were added for VDOT, to 5 when the grade-adjusted times
  (`gsec` per day, `gsec` per lap, `gapCount`) joined them, and to 6 when the
  day-level `sec`/`gsec`/`laps` were replaced by per-activity `acts`, and to 7 when each activity gained its start time `t` —
  every time because the shape itself changed: an older cached copy simply doesn't
  have those arrays. A stale schema opens the gate
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

Roughly: `recompute` (the four windows' series + their max + `computeTargets`) →
`classify` (verdict per day, off the windows) → `buildRamps`/`barColour` → `drawBars` /
`drawWindowPanel` (shared by `drawVol`/`drawFreq`/`drawRuns`) / `drawVdot` /
`drawZoneArea` / `drawAll` → `setReadout`/`winGrid`/`zoneGrid`/`renderTable`/
`renderTiles`/`syncLabels`.

## Gotchas that have bitten before

- **Declaration order.** `recompute()` runs at load. Anything it touches
  (`WINDOWS`, `IV`/`IF`, `MAXI`, `LONG_MIN_RUNS_PER_WEEK`, the series
  arrays) must be declared
  *above* that call or the whole script dies on a `const`/`let` TDZ error, which
  surfaces confusingly as "Cannot access 'C' before initialization". `loadPrefs()`
  therefore sits above `WINDOWS`; `savePrefs()` may
  *reference* things declared later (`barColourMode`, `wt`, `plan`) because it is only ever
  *called* later.
- **`[hidden]` vs `display`.** An author `display:` rule beats the UA stylesheet
  behind the `hidden` attribute. `.gate[hidden] { display: none }` exists for that
  reason.
- **Never a dual axis.** Two measures = two stacked panels sharing the x mapping.
- **The bar panel has no zero.** It is logarithmic; `Math.log(0)` is `-Infinity`.
  Every read of a day's height must go through `topOf(i)`, which sends a rest day
  to the stub rather than through `yOf`.
- **Bars must never gap.** Each bar runs from its own day boundary to the next, both
  edges pixel-snapped, so neighbours share an edge exactly at any zoom.
- **Zoom is cursor-anchored** — the fractional day under the pointer keeps its screen
  x; it must not re-centre or pin the left edge.
- **The readout must not change height** between idle, hovered and pinned. The idle
  state carries an invisible label/value spacer, and `.v2` reserves two line boxes,
  so all three match by construction. The VDOT detail line now *fills* exactly
  two by construction too (a hard `<br>` at the arrow, both halves measured to
  fit) — so any new wording on either half has to be re-measured against the
  246px the sidebar actually gives it, not eyeballed. See the readout section above before touching
  its flex properties.
- Floating point: `1.05 - 1 > 0.05`, so band edges need the epsilon in `classify`.
- **Negative zero.** A sliding-window sum adds and subtracts the same distances
  in a different order, so it doesn't land back on exactly 0 over a stretch with
  no runs — it lands on dust, often *negative* dust, which `toFixed`/`Intl`
  render as "-0.0 km". On a real export that was 171 dusty values showing up as
  a minus zero on 158 days of the readout. `recompute()` and `computeTargets()`
  therefore snap their running sums to 0 below `1e-9` (distances are rounded to
  1e-3 km when the data is built, so anything smaller is dust by definition).
  Snapped at the source, not at each format call, so every reader of the series
  gets a clean zero.

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

Two things the probe needs that aren't obvious:

- **`window.RUNVIZ` has to be seeded**, because headless Chrome has none of the
  `localStorage` the real page reads. The bootstrap script already exposes
  `parseCsv`/`summariseSports`/`buildData`, so a script inserted immediately
  *before* `<script>\nconst DATA = window.RUNVIZ;` can do
  `window.RUNVIZ = buildData(parseCsv(csvText), ids, name)` with the CSV baked in
  (`JSON.stringify` it from node) and `ids` taken from the `g.guess` sports. Hide
  the gate too, or it covers the page in a screenshot.
- **The app's `const`/`let` are invisible from the probe**, because the whole body
  sits inside `if (DATA) { … }`. Its *function declarations* are visible (sloppy
  mode hoists them out of the block) but nothing else is. Plant
  `window.__eval = s => eval(s);` just before that block's closing brace — a
  direct eval there sees every binding — and the probe can read and set anything.
  Anchor that replacement on the *last* `renderZonePanel();\n}`, not the first;
  the first is inside a function and its `eval` has the wrong scope.

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
