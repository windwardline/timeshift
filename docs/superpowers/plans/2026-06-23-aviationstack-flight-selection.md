# AviationStack Flight Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let travelers search real flights by route + date, pick from a sorted list,
and have the leg autofilled with accurate scheduled times/zones — with a near-term
live-status badge and a manual-entry fallback.

**Architecture:** Mirror the AI boundary (§13). One server-only network module
(`lib/flights/client.ts`, coverage-excluded) is the only thing that touches the
network/API key. Everything else in `lib/flights/` is pure and TDD'd to 100%. A
session-gated search route validates params, checks a DB cache, calls the client,
parses + sorts, and caches. The builder gains a search panel; the trip view gains a
live-status badge for legs within 48h.

**Tech Stack:** Next.js App Router, Prisma 6, Vitest, Luxon (`toUtc` for local→UTC),
AviationStack REST (free tier: ~100 req/mo, HTTP-only).

## Global Constraints

- TDD law (§2): no production code before a failing test; Red→Green captures to
  `docs/logs/NN-name-{red,green}.txt`; commit per unit.
- §13 boundary: network/API key isolated to `lib/flights/client.ts` (server-only,
  coverage-excluded, never imported by a client component). All other `lib/flights/`
  modules pure. Tests never call the real API and never require a key.
- Cache TTL **6h**; live-status window **48h** (approved defaults).
- Persist UTC + IANA zone (§4); offsets/DST via Luxon. Prisma `^6`. Branch not master.
- No silent failures: upstream error → friendly message + manual fallback stays visible.

---

### Task 1: Shared types

**Files:** Create `lib/flights/types.ts`.

**Interfaces:**
- Produces: `FlightOption`, `SortKey`, `FlightStatus` exactly as in the spec §4.

- [ ] **Step 1:** Write `types.ts` with `FlightOption` (flightNumber, airlineName,
  departureIata, arrivalIata, departureLocal, arrivalLocal, departureTz, arrivalTz,
  departureTerminal, arrivalTerminal, durationMinutes), `type SortKey =
  'departure'|'arrival'|'duration'`, `FlightStatus { state; delayMinutes }`. Types-only,
  no test needed (no behavior).
- [ ] **Step 2: Commit** `feat: add lib/flights shared types`.

### Task 2: Param validation (pure)

**Files:** Create `lib/flights/validate.ts` + `lib/flights/validate.test.ts`.

**Interfaces:**
- Produces: `validateSearchParams(raw): {ok:true;data:{from;to;date}} | {ok:false;error}`.

- [ ] **Step 1: Failing test** — accepts `{from:'JFK',to:'LHR',date:'2026-07-02'}`;
  rejects bad IATA (`'jfk'`, `'JF'`, `'JFKX'`), bad date (`'2026-7-2'`, `'nope'`),
  same from/to, and a date absurdly far out (> 1y) or in the past.
- [ ] **Step 2: Run** `... > docs/logs/35-flight-validate-red.txt 2>&1` — FAIL (missing).
- [ ] **Step 3: Implement** with regex `^[A-Z]{3}$` and `^\d{4}-\d{2}-\d{2}$` + Luxon
  date parse for range/validity.
- [ ] **Step 4: Run** green capture `docs/logs/35-flight-validate-green.txt` — PASS.
- [ ] **Step 5: Commit** red then green.

### Task 3: Response parsing (pure)

**Files:** Create `lib/flights/parse.ts` + `lib/flights/parse.test.ts`.
Fixtures: inline a representative AviationStack `flightsFuture`/`flights` JSON sample.

**Interfaces:**
- Consumes: raw API JSON (`{ data: [...] }`).
- Produces: `parseFlights(raw): FlightOption[]` — skips entries missing required
  fields (number, both iatas, both times, both zones); derives `durationMinutes` via
  `toUtc(local, tz)` difference.

- [ ] **Step 1: Failing test** — a 2-entry payload → 2 `FlightOption`s with mapped
  fields + correct `durationMinutes`; an entry missing arrival time is dropped;
  malformed root (`null`, `{}`, `{data:'x'}`) → `[]` (never throws); IDL flight
  (negative naive local diff) still yields positive duration (uses UTC).
- [ ] **Step 2: Run** red capture `docs/logs/36-flight-parse-red.txt` — FAIL.
- [ ] **Step 3: Implement** mapping with defensive guards; duration via engine `toUtc`.
- [ ] **Step 4: Run** green capture `docs/logs/36-flight-parse-green.txt` — PASS.
- [ ] **Step 5: Commit** red then green.

### Task 4: Sorting (pure)

**Files:** Create `lib/flights/sort.ts` + `lib/flights/sort.test.ts`.

**Interfaces:**
- Produces: `sortFlights(list, key: SortKey): FlightOption[]` (stable; does not mutate).

- [ ] **Step 1: Failing test** — three options sort by `departure` (local instant),
  `arrival`, and `duration` ascending; stable on ties; input array not mutated.
- [ ] **Step 2: Run** red capture `docs/logs/37-flight-sort-red.txt` — FAIL.
- [ ] **Step 3: Implement** with a copied array + comparator per key (departure/arrival
  compare the UTC instant via `toUtc`).
- [ ] **Step 4: Run** green capture `docs/logs/37-flight-sort-green.txt` — PASS.
- [ ] **Step 5: Commit** red then green.

### Task 5: Status parsing (pure)

**Files:** Create `lib/flights/status.ts` + `lib/flights/status.test.ts`.

**Interfaces:**
- Produces: `parseFlightStatus(raw): FlightStatus` — maps AviationStack
  `flight_status` (`scheduled|active|landed|cancelled|incident|diverted`) + delay
  minutes; unknown/malformed → `{state:'unknown', delayMinutes:null}`.

- [ ] **Step 1: Failing test** — each known status maps; a delayed entry surfaces
  `delayMinutes`; malformed → `unknown`/null.
- [ ] **Step 2: Run** red capture `docs/logs/38-flight-status-red.txt` — FAIL.
- [ ] **Step 3: Implement** mapping.
- [ ] **Step 4: Run** green capture `docs/logs/38-flight-status-green.txt` — PASS.
- [ ] **Step 5: Commit** red then green.

### Task 6: Coord resolution (pure)

**Files:** Create `lib/flights/coords.ts` + `lib/flights/coords.test.ts`.

**Interfaces:**
- Consumes: `lib/airports.ts` `findAirport`.
- Produces: `resolveCoords(iata): {lat,lng} | null` — curated list hit → coords;
  miss → null (arcs degrade).

- [ ] **Step 1: Failing test** — `'JFK'` → its curated coords; `'XXX'` → null.
- [ ] **Step 2: Run** red capture `docs/logs/39-flight-coords-red.txt` — FAIL.
- [ ] **Step 3: Implement** via `findAirport`.
- [ ] **Step 4: Run** green capture `docs/logs/39-flight-coords-green.txt` — PASS.
- [ ] **Step 5: Commit** red then green.

### Task 7: Network client (thin, coverage-excluded)

**Files:** Create `lib/flights/client.ts`. Modify `vitest.config.ts` coverage
`exclude` to add `lib/flights/client.ts` (alongside `lib/ai/client.ts`).

**Interfaces:**
- Produces: `searchFlights({from,to,date}): Promise<unknown>` and
  `flightStatus({flight,date}): Promise<unknown>` — build URL from
  `AVIATIONSTACK_API_KEY`, `fetch`, return raw JSON. Throws on non-200/no-key (caller
  maps to 502/503). **Never unit-tested.**

- [ ] **Step 1: Implement** the two functions (URL-encode params; read key from
  `process.env`; `http://api.aviationstack.com/v1/...`). Add the coverage exclusion.
- [ ] **Step 2:** Confirm `npm run test:coverage` still 100% on covered files (client
  excluded). Capture nothing new; this is infra.
- [ ] **Step 3: Commit** `feat: add AviationStack network client (server-only, coverage-excluded)`.

### Task 8: DB cache + migration

**Files:** Modify `prisma/schema.prisma` (add `FlightQueryCache`). Create
`lib/flights/cache.ts`. Run `npx prisma migrate dev --name flight_query_cache`.

**Interfaces:**
- Produces: `readCache(key): Promise<FlightOption[] | null>` (null if absent or older
  than 6h), `writeCache(key, FlightOption[]): Promise<void>` (upsert).

- [ ] **Step 1:** Add model (per spec §5), migrate, `prisma generate`.
- [ ] **Step 2: Failing test** (`lib/flights/cache.test.ts`, prisma mocked) — read
  returns null when row absent or `fetchedAt` older than 6h; returns payload when
  fresh; write upserts by `queryKey`.
- [ ] **Step 3: Run** red capture `docs/logs/40-flight-cache-red.txt` — FAIL.
- [ ] **Step 4: Implement** `cache.ts` (mock prisma in test like other repo tests).
- [ ] **Step 5: Run** green capture `docs/logs/40-flight-cache-green.txt` — PASS.
- [ ] **Step 6: Commit** schema+migration, then red, then green.

### Task 9: Search route

**Files:** Create `app/api/flights/search/route.ts` + `route.test.ts`.

**Interfaces:**
- Consumes: `getCurrentUser`, `validateSearchParams`, `readCache/writeCache`,
  `client.searchFlights`, `parseFlights`, `sortFlights`.
- Produces: `GET ?from&to&date&sort=` → `200 {flights}`; `401` anon; `400` bad params;
  `502` upstream throw; `503` no key (`AVIATIONSTACK_API_KEY` unset).

- [ ] **Step 1: Failing test** — anon→401; bad params→400 (client not called); cache
  hit→200 and client NOT called; cache miss→client+parse+sort+writeCache→200 sorted;
  client throws→502; no key→503. Mock all boundaries; **no key set in tests**.
- [ ] **Step 2: Run** red capture `docs/logs/41-flight-search-route-red.txt` — FAIL.
- [ ] **Step 3: Implement** the handler per the data flow (spec §3/§6).
- [ ] **Step 4: Run** green capture `docs/logs/41-flight-search-route-green.txt` — PASS.
- [ ] **Step 5: Commit** red then green.

### Task 10: Status route

**Files:** Create `app/api/flights/status/route.ts` + `route.test.ts`.

**Interfaces:**
- Produces: `GET ?flight&date` → `200 {status}`; `401` anon; `400` bad params;
  `502` upstream; `503` no key.

- [ ] **Step 1: Failing test** — anon→401; bad flight/date→400; ok→200 parsed status;
  throw→502; no key→503.
- [ ] **Step 2: Run** red capture `docs/logs/42-flight-status-route-red.txt` — FAIL.
- [ ] **Step 3: Implement** handler (no cache; uses `parseFlightStatus`).
- [ ] **Step 4: Run** green capture `docs/logs/42-flight-status-route-green.txt` — PASS.
- [ ] **Step 5: Commit** red then green.

### Task 11: FlightSearch component + builder wiring

**Files:** Create `components/FlightSearch.tsx`. Modify `components/TripBuilder.tsx`
to host search and, on select, populate a leg (flightNumber, airports, locals, zones,
coords via the leg shape the builder already submits).

**Interfaces:** Consumes `GET /api/flights/search`. On row click → `onSelect(option)`
→ builder fills the leg's dep/arr/depLocal/arrLocal (+ stores tz/coords for submit).

- [ ] **Step 1:** Build `FlightSearch` (From/To selects reusing `AIRPORTS`, date input,
  Search button, result list with a sort dropdown by `SortKey`, row → onSelect). Keep
  the manual inputs as the fallback path (decision #2).
- [ ] **Step 2:** Wire into `TripBuilder`: a "Search real flights" toggle above each
  leg; selecting fills that leg. Manual inputs remain editable.
- [ ] **Step 3:** Manual verification via `/run` (dev server) — search renders, sort
  works, select fills a leg, manual still works. Screenshot to `docs/screenshots/`.
- [ ] **Step 4: Commit** `feat: flight search panel + builder autofill (AviationStack)`.

### Task 12: LiveStatusBadge + trip-view wiring

**Files:** Create `components/LiveStatusBadge.tsx`. Modify `components/TripView.tsx`
(or `Timeline` label area) to render it per segment.

**Interfaces:** Consumes `GET /api/flights/status`. Renders nothing unless the
segment departs within 48h and has a `flightNumber`.

- [ ] **Step 1:** Build the badge: client component, on mount checks
  `departureTime` within 48h → fetch status → render colored badge (on-time/delayed/
  cancelled); else render null.
- [ ] **Step 2:** Wire per segment in the trip view.
- [ ] **Step 3:** Manual verification (a near-term seeded/manual flight shows a badge;
  a far-future one doesn't). Screenshot.
- [ ] **Step 4: Commit** `feat: near-term live flight-status badge (AviationStack)`.

### Task 13: Env + README evidence

**Files:** Modify `.env.example` (document `AVIATIONSTACK_API_KEY=`), `README.md`
(section: what's mocked-and-tested vs live-and-demo-only; HTTP-only caveat).

- [ ] **Step 1:** Add the env var (no value) + README paragraph.
- [ ] **Step 2:** Capture a redacted server-side request log as demo evidence (key
  redacted, request id / quota shown) into `docs/logs/` if a real key is available;
  otherwise note demo-only in README.
- [ ] **Step 3: Commit** `docs: document AVIATIONSTACK_API_KEY + flight-data evidence`.

---

## Self-Review

- **Spec coverage:** types→1, validate→2/§7, parse→3, sort→4, status→5, coords→6/US-C4,
  client→7/§2-§13, cache→8/§5, search route→9/§3-§6, status route→10, search UI→11/§1,
  badge→12/§1-#3, env+README→13/§8. ✓ Every spec section maps to a task.
- **Placeholders:** none — exact files, fn signatures, status codes, log paths given.
- **Type consistency:** `FlightOption`/`SortKey`/`FlightStatus` defined in Task 1 and
  used unchanged in 3/4/5/9/10/11; `readCache/writeCache` (8) consumed by 9;
  `searchFlights/flightStatus` (7) consumed by 9/10. ✓
- **Boundary check:** only Task 7 touches network/key and is the only coverage
  exclusion; all tested modules mock it. Tests need no key. ✓
- **Risk:** AviationStack `flightsFuture` field names verified against a real response
  during Task 3 (adjust the fixture/mapping if the live shape differs — pure parser, so
  cheap to correct).
