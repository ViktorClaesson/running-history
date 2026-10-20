# Intervals.icu API findings (Phase 0 spike, 17 Oct 2026)

Everything below was measured against my real account (athlete `i2…`, 1,267 activities)
with throwaway scripts outside the repo. Nothing here is from the docs alone unless it
says so.

## TL;DR

| Question | Answer |
|---|---|
| 1. Browser `fetch` + `Authorization` (CORS) | **Works, no proxy needed.** Preflight returns `access-control-allow-origin: <your origin>` and allows `authorization`. Verified from a `http://localhost:5173` page in headless Chrome (list, original file and streams all 200), and the preflight echoes `https://viktorclaesson.github.io` too. |
| 2. Summary fields | All there: `start_date_local` (no `Z`, local wall clock), `type`, `distance`, `moving_time`, `elapsed_time`, `icu_recording_time`, `average_heartrate`, `total_elevation_gain`, `gap`, `icu_lap_count`, `recording_stops`. Change markers: `analyzed` / `icu_sync_date` (timestamps, bumped on re-analysis/edit), plus `icu_intervals_edited`. |
| 3. Streams | Yes, for all 670 runs with samples. Always `time, distance, altitude, fixed_altitude, latlng, velocity_smooth, heartrate, cadence`; newer runs also power, respiration, running dynamics. **1 Hz** on 663 runs; 6 old Venu 2S runs use "smart recording" (1–11 s gaps). |
| 4. Laps + manual vs auto | **Only in the original FIT** (`/activity/{id}/file`): each `lap` message has `lapTrigger` and, for structured workouts, `wktStepIndex`. Intervals' own intervals and its regenerated `/fit-file` drop both. See "Laps" below. |
| 5. GAP | **No per-sample GAP** (`types=gap` → 422 "Invalid stream type"). Available: per activity (`gap`, m/s, Strava model), per Intervals interval (`gap`), per FIT lap (`avgGradeAdjustedSpeed`, Garmin's model, on 133/135 sampled files), and a `grade_smooth` stream (%). |
| 6. Rate limits | Short burst limit, no rate headers on success. Concurrency 3 → 135 FIT files in 11.3 s (~12 req/s), all 200. Concurrency 8 → 11/40 got `429` with `Retry-After: 1`. Use 3 workers and honour `Retry-After`. |
| 7. Original file for Garmin runs | **Works** (135/135 sampled, all 671 runs are `file_type: fit`, `source: GARMIN_CONNECT`). Avg 240 KB per file (115 KB gzipped on the wire) → ~160 MB for the whole history. |

## The activity list

`GET /api/v1/athlete/{id}/activities?oldest=…&newest=…` returns the whole history
(1,267 entries) in one 130 ms request — no paging needed at this size.

Types in my account: `Run` 671 (first 30 Jan 2023, 6,440 km), `Ride` 307,
`VirtualRide` 133, `RockClimbing` 42, `NordicSki` 13, `OpenWaterSwim` 11, `Swim` 7,
`Walk` 6, and singles/pairs of `Hike`, `Kayaking`, `Padel`, `Transition`,
`StandUpPaddling`, `IceSkate`, `Workout`, `Badminton`, `Tennis`, `Rowing`,
**`VirtualRun` 1** (excluded: indoor). No `TrailRun` appears. Default included
types: **`Run`** (and `TrailRun` if it ever shows up).

**62 entries have no `type`**: `source: STRAVA`, body is only
`{"_note": "STRAVA activities are not available via the API"}`. None of them is
within 5 minutes of a Garmin activity, so they are things that exist only on
Strava. The legacy Runalyze export had 665 runs against Intervals' 671, so they
are very unlikely to be runs, but Intervals cannot tell us. They are skipped.

One run has no samples at all: `i109960377` "Carrera 6km (no watch)", a manual entry
(318-byte FIT, empty `stream_types`, `gap: null`). It still counts as a run with its
summary distance and time; it just has no laps, no GAP and one chunk.

**Day attribution:** `start_date_local` is the local wall clock as text
(`2023-07-20T23:36:46`, while `start_date` is `…21:36:46Z`). Its first ten characters
are the day. `timezone` is `null` on every run, so there is nothing to convert with
anyway. 25 runs start at or after 22:00 local — the same 25 the legacy app got
wrong before Sep 2026.

## Laps: manual vs automatic

Lap triggers seen in a 135-file sample (every 5th run): `distance` 252, `time` 181,
`manual` 153, `sessionEnd` 137. By year, the share of runs that have *some* manual
press: 2023 1/17, 2024 2/21, 2025 8/47, 2026 13/50. Recent easy runs have autolap
off, so they are a single `sessionEnd` lap.

What each kind of run looks like:

| Run | Laps |
|---|---|
| Easy "Base", 5 Oct 2026 (`i193915097`) | 1 lap, `sessionEnd` |
| Old run, 1 Feb 2023, Venu 2S (`i37928003`) | 9× `distance` 1000 m + `sessionEnd`; no `wktStepIndex` |
| Interval session "TTRC 20×1′", 14 Oct 2026 (`i197306134`) | 40× `manual` + `sessionEnd` (lap button) |
| "5×5′", 6 Oct 2026 (`i194107986`) | 10× `manual` + `sessionEnd` |
| Long run, 19 Sep 2026 (`i188151716`) | 1× `manual` at 10.4 km + `sessionEnd` |
| Garmin workout "20×90″", 13 Jan 2026 (`i117682564`) | 1× `manual` (end warm-up) then 40× **`time`**, every lap with `wktStepIndex` 0/1/2, `intensity` warmup/active/recovery/cooldown |
| Garmin workout "12×400m", 30 Sep 2026 (`i191962533`) | 1× `manual`, then 23× **`distance`** with `wktStepIndex` |
| Workout with autolap on, 18 Jul 2023 (`i37928175`) | 3× `distance` 1000 m **all `wktStepIndex` 0** (autolaps inside the warm-up step), `manual`, then steps 1/2 alternating |

So **`lapTrigger` alone is not enough**: a structured workout ends its steps with
`time`/`distance` triggers, exactly like autolap. What separates them is
`wktStepIndex`: workout laps have one, plain autolaps don't. And autolaps *inside*
one workout step share the same index.

### Proposed "has manual laps" rule

A boundary is placed at the end of lap *i* (not the last lap) when **either**:

1. lap *i* has `lapTrigger === 'manual'` (lap button), **or**
2. laps *i* and *i + 1* have different `wktStepIndex` (a workout step changed).

Segments are the stretches between boundaries; autolaps inside a segment are ignored.
The run "has manual laps" iff there is at least one boundary. The function returns
which rule fired (`'button' | 'workout' | 'button+workout' | 'none'`), so it can be
shown per run. On the 135-run sample: `button` 17, `workout` 7, `button+workout` 6,
`none` 105, so 30 runs are cut into segments and the rest are one segment.

## Pauses

The streams contain only samples taken while the timer ran: on the 20×1′ run the
`time` stream jumps 800 → 1006 s and 3103 → 3237 s, exactly at `recording_stops`
`[800, 3103]`, with 0 m between. The FIT has matching `timer start` / `stopAll`
events. So paused time is detectable, and a chunk's duration is the sum of sample
deltas *excluding the delta across a timer stop*. That matches Garmin's
`totalTimerTime` (3405 s vs `elapsed_time` 3745 s). Standing still with the timer
running (a red light) still counts, as it does on the watch.

## GAP

Ratio flat-equivalent speed ÷ raw speed, per activity, over the 135-run sample:

| Source | p5 | median | p95 | max |
|---|---|---|---|---|
| Garmin, from FIT lap `avgGradeAdjustedSpeed` | 0.999 | 1.007 | 1.038 | 1.085 |
| Intervals `gap` (Strava model) | 0.995 | 1.008 | 1.082 | 1.166 |
| Minetti (2002) on 100 m chunks of the barometric altitude, my own | 0.985 | 0.998 | 1.003 | 1.106 |

Garmin and Intervals agree closely (median difference 0.005). Plain Minetti on raw
chunks lands about 1% lower: it gives full credit for downhills, which the
Garmin/Strava models deliberately don't. A per-chunk GAP therefore needs a decision
(see the options in the report).

## Sizes and timings

- List: 130 ms for the whole history. Activity detail: ~200 ms. FIT file: ~200 ms.
- A full backfill is ~1 list request + 671 FIT downloads ≈ **1 minute** at 3 workers.
- A routine re-sync is 1 list request + one FIT per new/changed run.

## Strava, for comparison (from Strava's docs, not tried)

- **OAuth only**, with no personal key: register an API app, then a redirect flow.
  Access tokens last 6 h, and both the token exchange and refresh need the
  **client secret** (no PKCE mentioned), so a pure static app would have to store
  the secret in the browser.
- **Rate limits:** 100 read requests per 15 min and 1,000 per day. A backfill is
  ~7 list pages + 2 requests per run (streams + laps) ≈ 1,350 requests, so it would
  take **more than a day**, against ~1 minute here.
- **Laps:** `lap_index`, `split`, times and distances, but **no trigger and no
  workout step**, so manual laps cannot be told from autolaps. **No original file
  download** via the API.
- Streams include `moving` and `grade_smooth`; no GAP field is documented.
- Plus: it would see the 62 Strava-only activities. Minus: everything above.

Conclusion: Intervals.icu is clearly better for this app. Strava's only real
advantage is those 62 entries.

## Found while building the processing (Milestone 3)

- **One multisport file.** The Jönköping triathlon (7 Jul 2024) is a single FIT holding
  five sessions (swim, transition, bike, transition, run). Intervals.icu splits it into
  activities and marks the run with `file_sport_index: 4`, but `/file` returns the whole
  recording. Processing therefore reads only that session's time window, laps and events.
  It is the only run in the history with `file_sport_index` ≠ 0.
- **Samples can end before the timer.** On one of 140 sampled runs the records stop 41 s
  before the watch's timer total (3,338 s of samples, 3,379 s of timer, no pause). Chunk
  durations sum to the *samples*; the other 139 agree with the watch within 6 s.
- **Real numbers:** full backfill of 671 runs = 676 requests in 150 s, 0 failures; a second
  sync straight after = 1 request. Decoding + chunking averages 14 ms per run; reprocessing
  all 671 from raw with the network off takes 9 s in the browser.

## Revisited: samples, time chunks and the GAP model (20 Oct 2026)

- **No gradient field per sample**, only barometric altitude in 0.2 m steps with samples
  3.2 m apart (median while moving), so the slope between neighbours jumps in ~7% steps.
  On a hill session (22 Jul 2026, 5 × 90″ at a real 5.0%) and Lidingöloppet (26 Sep 2026):
  neighbouring samples jitter 3.4–4.1%; a centred 25 m window (about 8 samples) brings that
  to 0.4–0.6% while keeping the reps' shape; 100 m and Intervals' `grade_smooth` flatten them.
- **The watch's own speed** (`enhanced_speed`, on 141/141 sampled runs) varies 4.4% second to
  second on a steady easy run, against 11.3% for distance ÷ time. Speed is read from it.
- **Combining GAP:** Minetti gives energy per metre, so flat-equivalent *metres* are summed.
  Summing flat-equivalent *time* instead rewards downhills too much and made rolling courses
  read as easier than flat. Combined by energy, pure Minetti puts the whole hill session at
  1.034 and Lidingöloppet at 1.044 (Garmin 1.037 / 1.030), with much bigger swings on single
  climbs and descents than Garmin (+36% / −26% against +13.5% / −3%).
- **Size:** 2.08 M samples for 671 runs, reprocessed from raw in 9.6 s in the browser,
  loaded in 56 ms; rebuilding everything after a chunk-length change takes 240 ms at 10 s and
  661 ms at 0 s on desktop. Phone startup under 4× CPU throttling: chart drawn in 1.5 s.

## GAP model, settled (20 Oct 2026)

Pure Minetti was far too aggressive: a 6% climb counts +36%, so every hill rep read as
Repetition. What the others do:

- **Runalyze** (open-source 4.3 code, `GradeAdjustedPace/Algorithm/Minetti.php`): Minetti's
  cost ratio raised to **0.83**, a 20-point moving average on the elevation before the
  gradient, applied to each point's pace from the speed stream.
- **Intervals.icu**: `gap_model: STRAVA_RUN` (Strava's model, which Strava's patent describes
  as fitted to athletes' heart-rate data) on its own heavily smoothed `grade_smooth`.
- Both read speed from smoothed streams, which lag several seconds behind an acceleration: on
  the 22 Jul 30 s sprints (raw 3:32/km on a 6% climb) they report GAP of only 3:14–3:43, and
  Garmin even reports 3:46, slower than the raw pace.

Fitting the same construction as Runalyze, (C(g)/C(0))^k, to Garmin's per-lap GAP over 399
laps of ≥ 400 m and ≥ 90 s: k = 1 median error 1.41% (p90 6.1%), 0.83: 1.03%, 0.5: **0.76%**
(p90 3.3%), 0.4: 0.72% (but worse on hilly laps), 0.3: 0.83%. The app uses k = 0.5 by default
as a setting ("GAP strength"); 1 is pure Minetti, 0.83 Runalyze. Speed is metres ÷ time over a
chunk (default 30 s), not the watch's smoothed speed.

On the 22 Jul hill session the app now puts the 90 s reps at 3:40–3:56 (Intervals 3:48–3:58,
Runalyze 3:37–3:57), the 60 s reps at 3:31–3:42 (3:26–3:36 / 3:34–3:44) and the 30 s sprints
at 3:00–3:07, where both sites under-read them. History-wide at the defaults: workout types
8/189/325/81/42/29 (legacy 25/260/269/60/40/21), 6.1% of kilometres at Interval + Repetition
(legacy 5.1%).
