# Design — Real flight selection via AviationStack

**Date:** 2026-06-23
**Status:** Proposed (awaiting review)
**Scope:** One new subsystem — let travelers select *real* flights for a trip leg
instead of hand-typing airports and times, so timelines use accurate scheduled
times/zones and input errors disappear.

> This spec covers **only** the AviationStack flight-selection feature. The
> separately-tracked TDD-plan/story items (P7.4, P7.5, P8.1/P8.2, US-B3, US-C3,
> US-C4) are executed against their existing acceptance criteria and are not
> re-designed here. US-C4 (per-segment geo) is referenced where it intersects.

---

## 1. Goal & decisions

A traveler building a trip picks **From + To airports + a date**, sees a **sorted,
navigable list of real flights**, and selects one — which becomes a leg with exact
scheduled times, IANA time zones, terminals, and (when known) coordinates.
Connections repeat the flow; layovers are computed from the real arrival → next
departure gap by the existing engine.

Decisions taken in brainstorming:

1. **Lookup mode:** route + date → pick from a sortable list (primary path).
2. **Manual entry:** kept as a fallback (existing builder unchanged), so airports/
   flights the API doesn't cover still work and the seeded showcase + E2E regression
   are untouched.
3. **Live status:** scheduled times drive planning; a leg whose departure is within
   ~48h additionally shows a live status badge (on-time/delayed/actual). Future-dated
   legs show scheduled-only — a planned trip has no delay data yet.

### Reality-check baked into the design

- **Scheduled ≠ delays.** Future trips have only scheduled data; delays exist only for
  near-term/past flights. Hence decision #3's 48h threshold.
- **Free tier limits:** ~100 requests/month, **HTTP-only (no HTTPS)**. Mitigations:
  key stays strictly server-side (§13), responses are cached (see §5), and the HTTP
  limitation is documented with a recommendation to use a paid HTTPS plan in
  production. The key is low-value and never reaches the browser.

---

## 2. Architecture — mirrors the AI boundary (§13)

```
components/FlightSearch.tsx (client)         <- route+date form, sortable result list
        │  fetch
        ▼
app/api/flights/search/route.ts (server)     <- session-gated; validates params; cache→client→parse→sort
        │
        ├─ lib/flights/validate.ts   (pure)  <- IATA + date param validation
        ├─ lib/flights/cache.ts      (db)    <- TTL cache keyed by dep:arr:date
        ├─ lib/flights/client.ts     (NET)   <- ONLY network module; reads API key; excluded from coverage
        ├─ lib/flights/parse.ts      (pure)  <- AviationStack JSON → FlightOption[]
        └─ lib/flights/sort.ts       (pure)  <- sort by departure | arrival | duration

app/api/flights/status/route.ts (server)     <- near-term live status; same client; pure status parser
        └─ lib/flights/status.ts     (pure)  <- AviationStack JSON → FlightStatus
components/LiveStatusBadge.tsx (client)       <- shown only when leg departs within 48h
```

**Boundary rule (from §4/§13):** `lib/flights/client.ts` is the single module that
touches the network and reads `AVIATIONSTACK_API_KEY`. It is server-only, never
imported by a client component, and is the **only** `lib/flights/` module excluded
from coverage. Everything else in `lib/flights/` is pure and TDD'd to 100%.

---

## 3. Data flow

**Search:** form → `GET /api/flights/search?from=JFK&to=LHR&date=2026-07-02` →
validate params → cache lookup (hit: return) → `client.searchFlights()` →
`parse()` → `sort()` → cache store → JSON `{ flights: FlightOption[] }` → list.

**Select:** user clicks a row → the existing builder leg is populated with the
flight's `flightNumber`, airports, **UTC** times (converted from the API's local +
zone via the engine's `toUtc`), zones, and coords-if-known → existing
`POST /api/trips` (or P7.4 add-segment) persists it. **No new persistence path** —
selection feeds the builder that already exists.

**Live status:** for a persisted leg departing within 48h, `LiveStatusBadge` calls
`GET /api/flights/status?flight=BA178&date=…` → `client.flightStatus()` →
`status()` parse → badge. Outside 48h the component renders nothing and makes no call.

---

## 4. Types (the contract)

```ts
// lib/flights/types.ts  (pure, shared)
interface FlightOption {
  flightNumber: string;        // "BA 178"
  airlineName: string | null;
  departureIata: string;       // "JFK"
  arrivalIata: string;         // "LHR"
  departureLocal: string;      // "YYYY-MM-DDTHH:mm" at departure airport
  arrivalLocal: string;        // "YYYY-MM-DDTHH:mm" at arrival airport
  departureTz: string;         // IANA, from API
  arrivalTz: string;           // IANA, from API
  departureTerminal: string | null;
  arrivalTerminal: string | null;
  durationMinutes: number;     // derived for sort/display
}
type SortKey = 'departure' | 'arrival' | 'duration';
interface FlightStatus { state: 'scheduled'|'active'|'landed'|'delayed'|'cancelled'|'unknown'; delayMinutes: number | null; }
```

Coordinates: resolved from the curated `lib/airports.ts` list when the IATA is known;
otherwise `null` → the timeline's day/night arcs degrade cleanly (TripView already
guards `arrivalLat == null`). This is the US-C4 intersection: segments persist
whatever coords we have, per-segment.

---

## 5. Caching & quota (DB-backed)

Vercel is serverless, so in-memory caching won't survive between invocations. A small
model protects the ~100/mo quota:

```prisma
model FlightQueryCache {
  id        String   @id @default(cuid())
  queryKey  String   @unique   // "JFK:LHR:2026-07-02"
  payload   Json                // FlightOption[] as returned
  fetchedAt DateTime @default(now())
}
```

Search reads cache when `fetchedAt` is within TTL (proposed **6h**); otherwise fetches
and upserts. Status responses are **not** cached (they change minute-to-minute).

---

## 6. Error handling (no silent failures — global standard)

- Invalid params (bad IATA, missing/of-range date) → `400` with a clear message;
  client shows it inline. Never forwarded upstream.
- Upstream error / non-200 / network failure → `502` with a friendly message; the UI
  keeps the **manual-entry fallback** visible so the user is never blocked.
- Empty result set → `200 { flights: [] }` → "No flights found — try another date or
  enter the flight manually."
- Missing API key (CI/grading) → search route returns `503 { error: 'flight lookup
  unavailable' }`; the UI falls back to manual entry. **The suite never needs a key.**

---

## 7. Security

- Key server-side only; never imported into a client component; never logged.
  `.env.example` documents `AVIATIONSTACK_API_KEY` (no value).
- Param validation before building the upstream URL: `from`/`to` match `^[A-Z]{3}$`,
  `date` matches `^\d{4}-\d{2}-\d{2}$` within a sane window → prevents query injection
  into the upstream request. Params are URL-encoded.
- Search + status routes are **session-gated** (only signed-in trip builders),
  protecting both the key and the quota.
- HTTP-only free tier is a documented limitation; recommend paid HTTPS for production.

---

## 8. Testing (§2 + §8 + §13 pattern)

- **Pure units, 100% coverage, Red→Green logs:** `validate`, `parse` (incl. malformed
  JSON, empty, missing fields, alt date formats), `sort` (each key, ties), `status`
  parse (each state + null delay), coord resolution.
- **Route tests:** mock `client` + `getCurrentUser` + `cache`; assert `401` anon,
  `400` bad params, `200` sorted parsed list, cache-hit (client not called), `502`
  upstream error, `503` no key. Real API never called; no key required.
- **`client.ts`:** excluded from coverage, never unit-tested or snapshot-asserted
  (non-deterministic). Marked excluded explicitly, like `lib/ai/client.ts`.
- **E2E (§8.B):** the committed regression stays on the deterministic seeded showcase
  (unchanged). Flight search is exercised **demo-only** with a real key; evidence is a
  redacted server-side request log (request id / quota, key redacted), like the AI call.
  The README states plainly which parts are mocked-and-tested vs live-and-demo-only.

---

## 9. Scope / non-goals

**In:** route+date search, sortable selectable list, select→builder autofill, manual
fallback, near-term live-status badge, DB cache, server-side key, US-C4 coord capture.

**Out (this spec):** booking/payment, seat maps, multi-passenger, price data, airline
loyalty, push alerts on delay, historical analytics, replacing manual entry. Per §9
these stay out unless re-scoped.

---

## 10. Build order (TDD)

1. `types.ts` (shared contract) → `validate` (R/G) → `parse` (R/G) → `sort` (R/G) →
   `status` parse (R/G) → coord resolution (R/G).
2. `client.ts` (thin, coverage-excluded) + `cache.ts` + Prisma model/migration.
3. `app/api/flights/search` route (R/G) → `app/api/flights/status` route (R/G).
4. `FlightSearch` + `LiveStatusBadge` components; wire into the builder/trip view.
5. `.env.example` + README evidence section; demo-only redacted request log.
