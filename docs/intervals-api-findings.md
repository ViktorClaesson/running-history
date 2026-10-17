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
