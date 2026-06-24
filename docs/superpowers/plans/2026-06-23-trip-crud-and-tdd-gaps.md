# Trip CRUD + TDD-Plan Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the already-specified TDD-plan/story gaps — standalone add-segment and
timeline routes, a timeline component render test, trip rename/delete, segment
edit/delete, and per-segment geo-coordinates.

**Architecture:** Follow the established patterns exactly. Pure validation in
`lib/`, thin DB wrappers in `lib/db/`, route handlers that mock `getCurrentUser` +
repo in tests (see `app/api/trips/route.test.ts`). Ownership is enforced by
DB-scoped queries (`where: { id, userId }`), never client-supplied ids.

**Tech Stack:** Next.js App Router, Prisma 6, Vitest, Luxon, React Testing Library
(`@testing-library/react` if not present — verify before P8 task).

## Global Constraints

- TDD law (§2): no production code before a failing test; Red→Green captures to
  `docs/logs/NN-name-{red,green}.txt`; commit per unit (`test:` then `feat:`/`fix:`).
- Prisma pinned to `^6` (§3). Migrations via `npx prisma migrate dev` (§5).
- All timestamps persisted UTC + IANA zone alongside (§4). Offsets/DST via Luxon only.
- Ownership isolation (US-B4): non-owner edit/read/delete → 404/403, row unchanged.
- Conventional Commits; one logical change per commit; no force-push; branch not master.

---

### Task A: P7.4 — POST /api/trips/[id]/segments

**Files:**
- Create: `app/api/trips/[id]/segments/route.ts`
- Create: `app/api/trips/[id]/segments/route.test.ts`
- Modify: `lib/db/trips.ts` (add `appendSegment`)
- Reuse: `lib/trips/normalize.ts` (segment schema), `lib/engine/time.ts` (`toUtc`)

**Interfaces:**
- Consumes: `getCurrentUser()`, `getTripWithSegments(id, userId)`.
- Produces: `appendSegment(tripId, NewSegmentInput): Promise<segment>`; `POST` handler
  returning `201 {id}` on success, `400` on impossible/invalid leg, `401` anon,
  `404` non-owner.

- [ ] **Step 1: Failing test** — owner appends a valid leg → 201 and `appendSegment`
  called with `sequence` = current segment count; arrival≤departure → 400 and no write;
  anon → 401; non-owner (trip not found for user) → 404. Mock `getCurrentUser`,
  `getTripWithSegments`, `appendSegment`; run real normalize on a single-leg payload.
- [ ] **Step 2: Run** `npm run test:run -- app/api/trips/[id]/segments/route.test.ts > docs/logs/29-add-segment-red.txt 2>&1` — expect FAIL (module missing).
- [ ] **Step 3: Implement** `appendSegment` (nested create with computed sequence) +
  the route: load owned trip (404 if absent), normalize a `{name:'_', segments:[leg]}`
  shape or a dedicated single-segment validator, reject impossible leg (400), append.
- [ ] **Step 4: Run** green capture to `docs/logs/29-add-segment-green.txt` — expect PASS.
- [ ] **Step 5: Commit** `test:` (red) then `feat:` (green) per §7.

### Task B: P7.5 — GET /api/trips/[id]/timeline

**Files:**
- Create: `app/api/trips/[id]/timeline/route.ts`
- Create: `app/api/trips/[id]/timeline/route.test.ts`
- Reuse: `lib/engine/timeline.ts` (`assembleTimeline`), `getTripWithSegments`.

**Interfaces:**
- Produces: `GET` returning `200 { timeline }` (engine payload) for the owner;
  `401` anon; `404` non-owner or empty trip.

- [ ] **Step 1: Failing test** — owner → 200 with `assembleTimeline` output for the
  trip's segments; anon → 401; non-owner → 404. Mock `getCurrentUser`,
  `getTripWithSegments`; assert payload shape (`items`, `start`, `end`).
- [ ] **Step 2: Run** red capture `docs/logs/30-timeline-route-red.txt` — FAIL.
- [ ] **Step 3: Implement** the route: load owned trip (404 if absent/empty), return
  `assembleTimeline(trip)`.
- [ ] **Step 4: Run** green capture `docs/logs/30-timeline-route-green.txt` — PASS.
- [ ] **Step 5: Commit** red then green.

### Task C: P8.1/P8.2 — Timeline component render test

**Files:**
- Create: `components/Timeline.test.tsx`
- Verify dep: `@testing-library/react` + `@testing-library/jest-dom` present; if not,
  add as devDeps and configure `vitest.config.ts` `environment: 'jsdom'` (check first).

**Interfaces:**
- Consumes: `Timeline` props (`axisStart/End`, `flights[]`, `layovers[]`, `arcs[]`,
  `sleep[]`, `destTz`).

- [ ] **Step 1: Failing test** — render `Timeline` with 2 flights, 1 layover, 2 arcs;
  assert one flight `rect` (or label) per segment, one layover block, and arc rects
  present; assert a flight and an arc that share an instant resolve to the same x
  (same scale). Use the existing `intervalToRect` expectation as the oracle.
- [ ] **Step 2: Run** red capture `docs/logs/31-timeline-component-red.txt` — FAIL
  (assertion or missing test-deps; install deps if needed, then it fails on assertion).
- [ ] **Step 3: Make green** — the component already renders these; adjust the test to
  query stable hooks (e.g. `getAllByText(/→/)`, `aria-label` on the svg). No prod
  change expected unless a stable selector is missing (then add a `data-testid`).
- [ ] **Step 4: Run** green capture `docs/logs/31-timeline-component-green.txt` — PASS.
- [ ] **Step 5: Commit** red then green.

### Task D: US-C4 — Per-segment geo-coords end to end

**Files:**
- Modify: `lib/trips/normalize.ts` (already carries optional lat/lng — verify pass-through)
- Modify: `app/api/trips/[id]/segments/route.ts` (Task A) to accept + persist coords
- Test: extend Task A test + `lib/trips/normalize.test.ts`

**Interfaces:** coords flow `builder → normalize → appendSegment/createTrip → arcs`.

- [ ] **Step 1: Failing test** — `normalizeTripInput` preserves `departureLat/Lng` and
  `arrivalLat/Lng` on the normalized segment; add-segment persists them. (Likely
  already true for normalize — assert it; the gap is the add-segment path from Task A.)
- [ ] **Step 2: Run** red capture `docs/logs/32-segment-geo-red.txt`.
- [ ] **Step 3: Implement** coord pass-through in the add-segment validator/persist.
- [ ] **Step 4: Run** green capture `docs/logs/32-segment-geo-green.txt`.
- [ ] **Step 5: Commit** red then green.

### Task E: US-B3 — Rename / delete trip

**Files:**
- Create: `app/api/trips/[id]/route.ts` (PATCH rename, DELETE)
- Create: `app/api/trips/[id]/route.test.ts`
- Modify: `lib/db/trips.ts` (`renameTrip`, `deleteTrip` — both ownership-scoped)
- Modify: `components/TripView.tsx` or a small `TripActions` client component (UI)

**Interfaces:**
- Produces: `renameTrip(id, userId, name)`, `deleteTrip(id, userId)` using
  `updateMany`/`deleteMany` with `where:{id,userId}` (count 0 → 404). `PATCH` →
  `200 {id,name}`; `DELETE` → `200 {ok:true}`; non-owner → 404; anon → 401.

- [ ] **Step 1: Failing test** — owner renames → 200 + repo called; owner deletes →
  200; **non-owner rename/delete → 404 and repo reports 0 rows (unchanged)**; anon →
  401; empty name → 400.
- [ ] **Step 2: Run** red capture `docs/logs/33-trip-crud-red.txt`.
- [ ] **Step 3: Implement** repo (`updateMany`/`deleteMany` scoped) + route + minimal
  UI (rename inline + delete with confirm) in a `TripActions` client component.
- [ ] **Step 4: Run** green capture `docs/logs/33-trip-crud-green.txt`.
- [ ] **Step 5: Commit** red then green (UI folded into green commit).

### Task F: US-C3 — Edit / delete flight segment

**Files:**
- Create: `app/api/trips/[id]/segments/[segId]/route.ts` (PATCH, DELETE)
- Create: `app/api/trips/[id]/segments/[segId]/route.test.ts`
- Modify: `lib/db/trips.ts` (`updateSegment`, `deleteSegment`, `resequence`)

**Interfaces:**
- Produces: `updateSegment(tripId,userId,segId,patch)` (re-validate UTC, reject
  arrival≤departure), `deleteSegment(tripId,userId,segId)` then `resequence(tripId)`
  to keep 0-based contiguous order. Ownership via the parent trip's userId.

- [ ] **Step 1: Failing test** — owner edits times → 200, normalized UTC; arrival≤
  departure → 400; owner deletes a middle segment → 200 and remaining segments
  resequenced 0..n-1; non-owner → 404; anon → 401.
- [ ] **Step 2: Run** red capture `docs/logs/34-segment-edit-red.txt`.
- [ ] **Step 3: Implement** repo + route (ownership via parent trip), resequence on
  delete; minimal edit/delete affordance in the trip view (can reuse builder inputs).
- [ ] **Step 4: Run** green capture `docs/logs/34-segment-edit-green.txt`.
- [ ] **Step 5: Commit** red then green.

---

## Self-Review

- **Coverage:** P7.4→A, P7.5→B, P8.1/P8.2→C, US-C4→D, US-B3→E, US-C3→F. ✓
- **Ordering:** A before D/F (segment routes), B/C independent. A is also the
  AviationStack select-target. ✓
- **Placeholders:** none — each task names exact files, repo fns, status codes, logs.
- **Type consistency:** repo fns ownership-scoped (`where:{id,userId}` / parent trip);
  `appendSegment` sequence = count; resequence keeps 0-based. ✓
- **Risk:** Task C may need test-deps; the task says verify first and install if absent.
