# TDD Plan — Prompts for Writing Tests

This is the ordered set of prompts that drive the Test-Driven Development cycle.
Each unit follows **Red → Green → Refactor**:

1. **Red** — write a failing test that pins one behavior. Run it; confirm it fails for
   the *right* reason.
2. **Green** — write the minimum code to make it pass. Run the suite; confirm green.
3. **Refactor** — clean up while the suite stays green.

Commit on every Red and every Green (see `CLAUDE.md` for the exact commit format).
Capture the terminal output of each Red and Green run for the README test-evidence
section.

The temporal engine (`lib/engine/`) is built first and to 100% coverage, because the
brief identifies time math as the highest-risk surface.

---

## Phase 0 — Harness

**P0 (Setup):** "Install and configure Vitest with coverage. Add a trivial
`sanity.test.ts` asserting `1 + 1 === 2`. Add npm scripts `test` (watch),
`test:run` (single run), and `test:coverage`. Run `test:run` and confirm it passes —
this proves the harness before any real test."

---

## Phase 1 — UTC offsets & DST  (US-E1)

**P1.1 (Red):** "Write a failing Vitest test for `offsetMinutes(utc, tz)` in
`lib/engine/time.ts`. Assert that for `America/New_York` it returns `-300` at
`2025-01-15T12:00:00Z` (EST) and `-240` at `2025-07-15T12:00:00Z` (EDT). Do not
implement the function yet; the test must fail because the function does not exist."

**P1.2 (Green):** "Implement `offsetMinutes` minimally using Luxon's zone offset so
P1.1 passes. Run the full suite and confirm green."

**P1.3 (Red):** "Add a failing test asserting that `toUtc('2025-03-09T02:30',
'America/New_York')` — a local time inside the spring-forward gap that does not exist
— resolves to a valid UTC `Date` deterministically and does not throw."

**P1.4 (Green):** "Implement/adjust `toUtc` so the spring-forward case resolves
deterministically (document the chosen resolution). Keep the suite green."

**P1.5 (Red):** "Add a failing test for the fall-back ambiguous hour
(`2025-11-02T01:30` in `America/New_York`) asserting `toUtc` resolves to a single
documented instant rather than throwing."

**P1.6 (Green + Refactor):** "Make P1.5 pass, then refactor `time.ts` for clarity
while keeping the suite green."

---

## Phase 2 — Leap year  (US-E2)

**P2.1 (Red):** "Write a failing test asserting `durationMinutes` for a segment whose
UTC span crosses `2024-02-29` counts February 29 exactly once (i.e. the duration is
the true elapsed minutes, not off by 1440)."

**P2.2 (Green):** "Implement `durationMinutes` so P2.1 passes."

**P2.3 (Red):** "Write a failing test asserting that adding one calendar year to
`2024-02-29` yields `2025-02-28` (no phantom Feb 29 in a non-leap year). Put this in
the engine's date-add helper."

**P2.4 (Green + Refactor):** "Make P2.3 pass and refactor; suite stays green."

---

## Phase 3 — International Date Line  (US-E3)

**P3.1 (Red):** "Write a failing test for `crossesDateLine(segment)` using a
Tokyo→Los Angeles flight (`Asia/Tokyo` UTC+9 → `America/Los_Angeles` UTC-8). Assert
it returns `true` and that `durationMinutes` is still positive even though the local
arrival clock/date is earlier than local departure."

**P3.2 (Green):** "Implement `crossesDateLine` so P3.1 passes without breaking
`durationMinutes`."

**P3.3 (Red):** "Write a failing test for the reverse case (LA→Sydney,
`America/Los_Angeles` → `Australia/Sydney`) asserting the local arrival calendar
advances by an extra day and `crossesDateLine` returns `true`."

**P3.4 (Green + Refactor):** "Make P3.3 pass; refactor IDL logic; suite stays green."

---

## Phase 4 — Day/night arcs  (US-D2)

**P4.1 (Red):** "Write a failing test for `dayNightArcs(spanStart, spanEnd, tz, lat,
lng)` asserting that for a known location/date it returns alternating day and night
arcs whose boundaries match SunCalc's sunrise/sunset for that day, and that the arcs
fully tile the span with no gaps or overlaps."

**P4.2 (Green):** "Implement `dayNightArcs` wrapping SunCalc so P4.1 passes."

**P4.3 (Refactor):** "Refactor arc assembly for readability; suite stays green."

---

## Phase 5 — Timeline assembly  (US-D1, US-D3)

**P5.1 (Red):** "Write a failing test for `assembleTimeline(trip)` with a 2-segment
trip and a layover. Assert the output places both segments and a distinct layover
block on one continuous UTC axis in the correct order with correct widths."

**P5.2 (Green + Refactor):** "Implement `assembleTimeline` to pass P5.1, then refactor."

---

## Phase 6 — Sleep recommendation  (US-E4)

**P6.1 (Red):** "Write a failing test for `recommendSleepWindows(timeline, homeTz,
destTz)` on a long-haul red-eye. Assert it returns at least one window, that every
window lies entirely within an in-air segment (never during a layover or on the
ground), and that each window overlaps destination nighttime."

**P6.2 (Green):** "Implement `recommendSleepWindows` minimally to pass P6.1."

**P6.3 (Red):** "Add a failing test for a short daytime hop asserting it returns
**zero** sleep windows (no recommendation when sleeping wouldn't help)."

**P6.4 (Green + Refactor):** "Make P6.3 pass; refactor; confirm engine coverage is 100%."

---

## Phase 7 — API routes (integration, test-first)  (US-A*, US-B*, US-C*)

For each route, write the failing test first against a test database, then implement:

**P7.1:** "Write a failing integration test that registering a new email creates one
hashed-password user, and registering a duplicate email is rejected."

**P7.2:** "Write a failing test that `POST /api/trips` creates a trip owned by the
session user, and that `GET /api/trips` returns only that user's trips."

**P7.3:** "Write a failing **ownership-isolation** test: User 2 requesting/editing/
deleting User 1's trip receives 403/404 and the trip is unchanged. (US-B4)"

**P7.4:** "Write a failing test that `POST /api/trips/[id]/segments` rejects a segment
whose UTC arrival precedes its UTC departure, and accepts a valid one with timestamps
normalized to UTC. (US-C1)"

**P7.5:** "Write a failing test that `GET /api/trips/[id]/timeline` returns the engine's
assembled timeline payload for the owner."

Implement each minimally to green; refactor handlers behind a thin service layer.

---

## Phase 8 — Component (timeline geometry)  (US-D1, US-D2)

**P8.1 (Red):** "Write a failing component test asserting the timeline renders one bar
per segment, a layover block for each gap, and day/night arcs positioned by the same
time-to-x scale used for segments."

**P8.2 (Green + Refactor):** "Implement rendering to pass P8.1; refactor the scale
helper into a shared, tested function."

---

## Discipline summary

- No production code is written before its failing test exists.
- The suite is run after every step; screenshots of Red and Green runs are saved to
  `docs/screenshots/` and embedded in the README.
- Engine coverage is held at 100%; the suite must be green before any commit that is
  not itself a documented Red commit.
