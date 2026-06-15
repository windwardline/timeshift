# Specifications — TimeShift

## 1. Overview

TimeShift converts a flight itinerary into a single horizontal time axis and overlays
destination day/night arcs plus recommended in-flight sleep windows. The hard part is
**time correctness** — UTC offsets, daylight saving, leap days, and International Date
Line crossings — which is why the temporal engine is built test-first.

## 2. Scope

**In scope (this sprint):** auth + profile, trip CRUD, flight-segment CRUD with
ordering, the temporal engine, the timeline visualization with day/night arcs and
layover blocks, and sleep-window recommendations.

**Out of scope:** live flight data, multi-user sharing, notifications, native mobile.
(See `USER_STORIES.md` → "Out of scope".)

## 3. Architecture

```text
┌─────────────────────────────────────────────────────────┐
│  Next.js (App Router)                                     │
│                                                           │
│  Client components ──▶ Timeline visualization (SVG/Canvas)│
│        │                                                  │
│        ▼                                                  │
│  /app/api/* route handlers ──▶ Temporal Engine (pure fns) │
│        │                              │                   │
│        ▼                              ▼                   │
│  Prisma Client ──▶ PostgreSQL    Luxon + SunCalc          │
└─────────────────────────────────────────────────────────┘
```

- **Temporal engine** is a set of **pure functions** in `lib/engine/` with no database
  or framework dependencies, so it is trivially unit-testable. This is the TDD core.
- **API routes** validate input, call the engine, and persist via Prisma.
- **Client** fetches a computed timeline payload and renders arcs/blocks.

## 4. Time-handling architecture (non-negotiable)

- **All timestamps are persisted in UTC.** Original IANA zone strings
  (e.g. `Europe/London`) are stored alongside for rendering.
- **Offset and DST resolution is delegated to Luxon**, which ships the IANA tz
  database. We do **not** hand-roll offset tables — reimplementing the tz database is
  a defect factory.
- **Hand-written, test-driven logic** is the project's own reasoning *on top of* Luxon:
  date-line crossing detection, timeline assembly, layover detection, sleep-window
  recommendation, and arc positioning. These are what the TDD suite proves correct.
- **Sunrise/sunset** comes from **SunCalc** given a date + latitude/longitude; the
  engine wraps it to produce day/night arc boundaries.

## 5. Data Model (Prisma)

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  homeTimeZone String   // IANA tz, e.g. "America/New_York"
  createdAt    DateTime @default(now())
  trips        Trip[]
}

model Trip {
  id          String          @id @default(cuid())
  name        String
  destination String          // IANA tz of the destination
  userId      String
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  segments    FlightSegment[]
  createdAt   DateTime        @default(now())
}

model FlightSegment {
  id               String   @id @default(cuid())
  tripId           String
  trip             Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  sequence         Int      // order within the trip (0-based)
  departureAirport String   // IATA code, e.g. "JFK"
  arrivalAirport   String   // IATA code, e.g. "LHR"
  departureTime    DateTime // stored in UTC
  arrivalTime      DateTime // stored in UTC
  departureTz      String   // IANA tz
  arrivalTz        String   // IANA tz
  departureLat     Float?
  departureLng     Float?
  arrivalLat       Float?
  arrivalLng       Float?

  @@unique([tripId, sequence])
}
```

Three entities (Users, Trips, Flight Segments) demonstrate the relational model:
`User 1—* Trip 1—* FlightSegment`, with cascade deletes.

## 6. API Contract

| Method | Path                          | Purpose                                   |
|--------|-------------------------------|-------------------------------------------|
| POST   | `/api/auth/register`          | Create account, return session            |
| POST   | `/api/auth/login`             | Authenticate, return session              |
| POST   | `/api/auth/logout`            | Destroy session                           |
| GET    | `/api/profile`                | Read profile (incl. homeTimeZone)         |
| PUT    | `/api/profile`                | Update homeTimeZone                       |
| GET    | `/api/trips`                  | List current user's trips                 |
| POST   | `/api/trips`                  | Create a trip                             |
| GET    | `/api/trips/[id]`             | Read one trip (owner only)                |
| PUT    | `/api/trips/[id]`             | Rename a trip (owner only)                |
| DELETE | `/api/trips/[id]`             | Delete a trip + cascade segments          |
| POST   | `/api/trips/[id]/segments`    | Add a flight segment                      |
| PUT    | `/api/segments/[id]`          | Edit a segment (owner only)               |
| DELETE | `/api/segments/[id]`          | Delete a segment (owner only)             |
| GET    | `/api/trips/[id]/timeline`    | Computed timeline payload (engine output) |

Every trip/segment route enforces ownership; non-owners receive 403/404 and no data.

## 7. Temporal Engine Spec (`lib/engine/`)

Pure functions, each unit-tested before implementation:

| Function | Signature (conceptual) | Responsibility |
| --- | --- | --- |
| `offsetMinutes` | `(utc: Date, tz: string) → number` | DST-aware UTC offset for a zone at an instant |
| `toUtc` | `(localISO: string, tz: string) → Date` | Normalize a local wall-time to UTC |
| `localParts` | `(utc: Date, tz: string) → {date, time, offset}` | Render a UTC instant in a zone |
| `crossesDateLine` | `(seg: Segment) → boolean` | True when local arrival calendar precedes/leaps the departure across the IDL |
| `durationMinutes` | `(seg: Segment) → number` | Positive UTC duration; leap-day safe |
| `dayNightArcs` | `(spanStart, spanEnd, tz, lat, lng) → Arc[]` | Sunrise/sunset arcs (via SunCalc) on the journey span |
| `assembleTimeline` | `(trip: Trip) → TimelineModel` | Segments + layovers + arcs positioned on one axis |
| `recommendSleepWindows` | `(timeline, homeTz, destTz) → SleepWindow[]` | In-flight windows aligned to destination night |

**Required correctness cases** (these become tests — see `TDD_PLAN.md`):
UTC offset EST vs EDT, spring-forward non-existent local time, fall-back ambiguous
hour, leap-day spanning durations, `Feb 29 + 1yr → Feb 28`, Tokyo→LA and LA→Sydney
IDL crossings, sleep windows confined to in-air segments and aligned to destination night.

## 8. Visualization Spec

- Single horizontal axis spanning **first departure (UTC)** to **final arrival (UTC)**.
- Flight segments render as solid bars; layovers as distinct hatched/lighter blocks
  with duration labels.
- **Day arcs** (destination daylight) and **night arcs** drawn on the same axis,
  color-coded (warm = day, dark = night), so sleep windows can be read against them.
- Recommended sleep windows highlighted over the in-flight bars.
- Rendering target: SVG (deterministic, testable geometry) with React state for
  zoom/pan if time allows.

## 9. Non-Functional

- **Performance:** timeline payload computed server-side; client render < 100 ms for a
  typical 1–4 segment trip.
- **Security:** passwords hashed (bcrypt/argon2); session-protected routes; strict
  ownership checks; secrets in `.env` (gitignored).
- **Validation:** all API input validated (e.g. Zod) before persistence.

## 10. Testing Strategy

- **Framework:** Vitest, TDD throughout. Red → Green → Refactor documented per unit.
- **Coverage target:** **100% of `lib/engine/`** (the temporal core); meaningful
  coverage of API route handlers; component tests for timeline geometry.
- **Layers:** unit (engine), integration (API routes against a test DB), component
  (timeline rendering math).
- See `TDD_PLAN.md` for the ordered test-writing prompts.

## 11. 5-Day Sprint Plan

| Day | Focus |
| --- | --- |
| 1 | Specs, user stories, acceptance criteria, TDD plan, context file (this set) |
| 2 | Scaffold (Next.js + Prisma + Vitest), DB schema/migration, **TDD engine: offsets/DST + leap year** |
| 3 | **TDD engine: IDL crossings + timeline assembly + sleep windows**; auth |
| 4 | API routes (trips, segments, timeline) test-first; ownership isolation |
| 5 | Timeline visualization + arcs, polish, README test-evidence, final coverage |

## 12. Definition of Done (per story)

A story is Done when: every acceptance criterion has a passing test; the engine
coverage target holds; the Red-Green-Refactor history is captured in the README; the
feature is committed following the conventions in `CLAUDE.md`.
