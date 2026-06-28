# Acceptance Criteria — TimeShift

Written in **Given / When / Then** form and keyed to the user stories in
`USER_STORIES.md`. These criteria are the source of truth for the tests defined in
`TDD_PLAN.md`: a story is **Done** only when every criterion below has a passing test.

---

## US-A1 — Register

- **Given** a visitor on the registration page
  **When** they submit a unique email and a password of at least 8 characters
  **Then** an account is created, the password is stored only as a hash, and they
  are logged in.
- **Given** an email already in use
  **When** they submit registration
  **Then** registration is rejected with a clear "email already registered" error and
  no duplicate user is created.

## US-A2 — Log in / out

- **Given** a registered user
  **When** they submit correct credentials
  **Then** a session is established and they can access their trips.
- **Given** incorrect credentials
  **When** they submit
  **Then** access is denied with a generic "invalid credentials" message (no
  indication of which field was wrong).
- **Given** a logged-in user
  **When** they log out
  **Then** the session is destroyed and protected routes redirect to login.

## US-A3 — Home time zone

- **Given** a logged-in user on their profile
  **When** they select a valid IANA time zone (e.g. `America/New_York`)
  **Then** it is saved and used as the biological-clock baseline in later calculations.
- **Given** an invalid time-zone string
  **When** they save
  **Then** the value is rejected and the previous value is preserved.

---

## US-B1 — Create trip

- **Given** a logged-in user
  **When** they submit a trip name and a valid destination IANA time zone
  **Then** a trip is created, owned by that user, with zero segments.
- **Given** a missing name or invalid destination zone
  **When** they submit
  **Then** the trip is not created and a validation error is returned.

## US-B2 — List trips

- **Given** a user with trips
  **When** they open the trips list
  **Then** only their own trips are shown, ordered most-recent first.

## US-B3 — Rename / delete trip

- **Given** a trip the user owns
  **When** they rename it
  **Then** the new name persists.
- **Given** a trip the user owns
  **When** they delete it
  **Then** the trip and all of its flight segments are removed (cascade).

## US-B4 — Ownership isolation

- **Given** Trip X owned by User 1
  **When** User 2 requests, edits, or deletes Trip X
  **Then** the request is rejected with a not-found/forbidden response and the trip
  is unchanged.

---

## US-C1 — Add flight segment

- **Given** a trip the user owns
  **When** they add a segment with departure/arrival airports (IATA), departure and
  arrival timestamps, and valid departure/arrival IANA zones
  **Then** the segment is persisted with timestamps normalized to UTC and the original
  zones retained.
- **Given** an arrival timestamp earlier than the departure timestamp **in UTC**
  **When** they submit
  **Then** the segment is rejected as invalid (a flight cannot land before it takes
  off in absolute time).

## US-C2 — Segment ordering

- **Given** a trip with multiple segments
  **When** segments are retrieved
  **Then** they are returned in ascending sequence order reflecting real travel order.

## US-C3 — Edit / delete segment

- **Given** a segment in a trip the user owns
  **When** they edit a field with a valid value
  **Then** the change persists and the trip's timeline recomputes.
- **Given** a segment the user owns
  **When** they delete it
  **Then** it is removed and remaining segments keep a valid contiguous order.

---

## US-D1 — Horizontal timeline

- **Given** a trip with at least one segment
  **When** the timeline view loads
  **Then** the full journey renders left-to-right on one continuous time axis from
  first departure to final arrival.

## US-D2 — Day/night arcs

- **Given** a destination zone and the journey time span
  **When** the timeline renders
  **Then** daylight intervals at the destination are drawn as "day" arcs and the
  remainder as "night" arcs, color-coded and positioned on the same axis as the flights.

## US-D3 — Layover blocks

- **Given** two consecutive segments with a gap between arrival and next departure
  **When** the timeline renders
  **Then** the gap is shown as a distinct layover block with its duration.

---

## US-E1 — UTC offsets & DST

- **Given** `America/New_York`
  **When** the engine computes the offset for `2025-01-15` and `2025-07-15`
  **Then** it returns **-300** minutes (EST) and **-240** minutes (EDT) respectively.
- **Given** a "spring-forward" local time that does not exist (e.g. `2025-03-09 02:30`
  in `America/New_York`)
  **When** the engine normalizes it
  **Then** it resolves deterministically and does not throw or produce an invalid date.

## US-E2 — Leap year

- **Given** a duration that spans `2024-02-29`
  **When** the engine computes the arrival date from a departure plus elapsed time
  **Then** February 29 is counted exactly once and the result is correct.
- **Given** `2024-02-29` plus one calendar year
  **When** computed
  **Then** the result is `2025-02-28` (no phantom Feb 29 in a non-leap year).

## US-E3 — International Date Line

- **Given** a flight departing Tokyo (`Asia/Tokyo`, UTC+9) and arriving Los Angeles
  (`America/Los_Angeles`, UTC-8)
  **When** the engine computes local arrival
  **Then** the **local** arrival clock/date may be earlier than the local departure
  while UTC duration stays positive, and the engine flags the segment as date-line
  crossing rather than rejecting it.
- **Given** the reverse direction (LA → Sydney)
  **When** computed
  **Then** the local calendar advances by an extra day and the timeline reflects it.

## US-E4 — Sleep recommendation

- **Given** a journey and the destination zone
  **When** the engine recommends sleep windows
  **Then** it returns one or more in-flight windows aligned to destination nighttime,
  each with a start/end in UTC and a human-readable local label, and never recommends
  sleep outside an in-air segment.

## US-R — Grounded Jetlag Coach

- **AC-R1** — **Given** a question covered by the knowledge base
  **When** the coach answers
  **Then** it returns an answer plus a non-empty **Sources** list naming the KB doc(s) used.
- **AC-R2** — **Given** a question with no relevant KB chunk (retrieval below threshold)
  **When** the coach is asked
  **Then** it returns the refusal message and makes **no** generation call.
- **AC-R3** — **Given** an answered question
  **When** the Sources are shown
  **Then** they are exactly the docs of the chunks passed to the model — no fabricated citations.
- **AC-R4** — **Given** retrieval runs
  **When** an embedder is available it is semantic, and **When** none is configured it
  falls back to lexical (BM25) — both paths run keyless in tests.
- **AC-R5** — **Given** no API key is present
  **When** the unit suite and coverage run
  **Then** they pass.
