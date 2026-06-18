# TimeShift — Resume Plan & Monday Presentation Prep

This doc is the roadmap for picking the project back up and getting ready for the
Monday presentation. It assumes nothing — it tells you what exists, what doesn't,
what to build in what order, and exactly what to say.

---

## 1. Where the project stands right now

**Done — the temporal engine (pure, TDD'd, 100% covered):**

- `lib/engine/time.ts` — UTC offsets, DST (spring-forward + fall-back), duration,
  add-year clamping, International Date Line crossings.
- `lib/engine/arcs.ts` — day/night arcs (SunCalc sunrise/sunset tiling).
- `lib/engine/timeline.ts` — multi-segment trip assembly with layover gaps.
- Engine Phases 0–5 complete. Suite green, engine coverage 100%.
- All evidence (red/green logs + colored screenshots) committed and linked in the
  README. Git history shows test-first ordering throughout.

**Not built yet (this is the important part):**

- ❌ **The data layer in code.** Postgres is installed, the `timeshift` database
  exists, and `DATABASE_URL` is set — but there is **no Prisma schema migrated, no
  tables, and no queries** anywhere in the codebase. The schema only exists as text
  in `docs/SPECIFICATIONS.md`.
- ❌ The AI feature (spec'd in `docs/AI_ADVICE.md`, not yet implemented).
- ❌ Any UI / page that renders the timeline.
- ❌ Phase 6 — sleep windows (last engine unit).

---

## 2. ⚠️ Read this first: the data-layer gap vs. the Monday rubric

The instructor's presentation rubric leans **hard** on the database:

- Section 1 (~2 min, first and longest) is **the Data Layer**: your schema, how
  tables relate, what queries the app runs.
- **Three of the six questions** you must answer are database questions ("Why did
  you structure your schema this way?", "What relationships exist between your
  tables and why?", "What's the most complex query your app handles?").

Right now you **cannot answer those from running code** — the engine work, however
clean, is not a data layer. So the **#1 priority on resume is making the data layer
real**: write the Prisma schema, run the migration against your existing
`DATABASE_URL`, and add at least one real query the app runs. Everything else
(AI, UI polish, Phase 6) is secondary to that for Monday.

**Honest scheduling note:** your break should be short. Between now and Monday you
need the data layer, a minimal demoable path, the AI feature, and a rehearsed live
demo. That's a real amount of work — plan the break so the resume session has room.

---

## 3. Prioritized resume roadmap (do in this order; cut from the bottom if short)

| # | Work | Why it matters for Monday |
|---|------|---------------------------|
| **P1** | **Data layer real** — schema → migrate → query functions | Rubric Section 1 + 3 of 6 questions. Non-negotiable. |
| **P2** | **Minimal demoable path** — load a trip, run the engine, render the timeline | Rubric Section 2 ("show how it helps by demoing core features"). |
| **P3** | **AI feature** per `docs/AI_ADVICE.md` + a minimal "AI-generated" panel | Required pivot (real AI API key) + a strong demo beat. |
| **P4** | **Phase 6 — sleep windows** (or reserve a small unit for the live demo) | Completes the engine; optional for Monday. |
| **P5** | **Rehearse the live TDD feature** | Rubric Section 3. Practice the timing. |

If time runs out, **P1–P3 are the floor.** P4 can be skipped or used as the live
demo; P5 is rehearsal, not building.

### P1 — Data layer, step by step

1. Create `prisma/schema.prisma` from the schema in `docs/SPECIFICATIONS.md`
   (User, Trip, FlightSegment). Keep the time fields as **UTC `DateTime` + an IANA
   timezone string** alongside each (so offset/DST stays delegated to Luxon —
   CLAUDE.md §4), exactly as the engine's segment shape already expects.
2. Run `npx prisma migrate dev --name init` — this creates the real tables in the
   `timeshift` database (your `DATABASE_URL`). This is the first time the DB is
   actually exercised.
3. Run `npx prisma generate` (Prisma 6, per CLAUDE.md §3).
4. Add a thin repository module (e.g. `lib/db/trips.ts`) with the real queries:
   - `createTrip(input)` — insert a Trip with its FlightSegments.
   - `getTripWithSegments(id)` — `findUnique` with `include: { segments: { orderBy: { departureTime: 'asc' } } }`. **This ordered include is your "most complex query"** — it's the join that feeds the whole engine pipeline.
5. (Recommended) a small seed script that inserts one demo trip (e.g. JFK → LHR →
   onward, or Tokyo → LA) so the demo has data to render.
6. Commit each step with §7 confirmation (`chore:` for schema/migration scaffolding,
   `feat:` for the query module).

**TDD scope note (be honest about this in the demo):** schema and migrations are
configuration/DDL, not TDD'd. Query functions are integration territory — keep them
thin; the engine remains your TDD showcase. This mirrors the §4 philosophy: delegate
persistence to Prisma, test your own reasoning (the engine), don't hand-roll or
over-test the parts a library owns.

### P2 — Minimal demoable path

One page that loads the seeded trip via `getTripWithSegments`, runs the engine
(`assembleTimeline` + `dayNightArcs`), and renders the horizontal timeline with
color-coded day/night arcs. Minimal styling is fine — it just needs to visibly work
for the Story section.

### P3 — AI feature

Follow `docs/AI_ADVICE.md` exactly: TDD the deterministic glue (`buildAdvicePrompt`,
`parseAdviceResponse`, `generateAdvice` with a **mocked** client) → wire the API
route with the **real** key → add a minimal advice panel labeled "AI-generated" with
a visible loading state. The live call happens in the demo; tests never need a key.

---

## 4. Monday presentation script (aim 5–6 min)

Show your **CLAUDE.md** at some point — it's the "rules/context file you control"
the instructor explicitly wants to see. Point at the sections that prove control:
§2 (TDD law), §4 (time-handling/delegation), §7 (git workflow), §8 (real-evidence-
only), §13 (AI boundary).

### Section 1 — Data Layer (~2 min)
- Open `prisma/schema.prisma`. Walk User → Trip → FlightSegment.
- Explain the relationships (below).
- Show `getTripWithSegments` and say plainly: this ordered query is the input to the
  temporal engine — the DB hands the engine a clean, ordered list of legs, and the
  engine does the time math.

### Section 2 — The Story (~1.5 min)
- Problem: crossing time zones wrecks your sleep, and it's genuinely hard to know
  *when* to sleep — on the plane, and before/after — given real flight times.
- User: a traveler facing a multi-time-zone or multi-leg trip.
- Demo: render the timeline for the seeded trip (day/night arcs), and — if built —
  click "get my plan" for the live AI advice.

### Section 3 — Live TDD (~2 min)
- Show CLAUDE.md (the rules). Then code **one small, rehearsed feature** live with
  the CLI agent: prompt it to write a **failing test first**, run it red, then make
  it pass, run it green. The point is the *flow*, not the feature. See §6 below for
  candidates and the exact rehearsed steps.

---

## 5. Draft answers to the instructor's six questions

Tighten these into your own words; they're grounded in what you actually built.

**Why did you structure your schema this way?**
Three tables — User, Trip, FlightSegment — because a journey is naturally a user who
owns trips, and a trip that is an ordered sequence of flight legs. Every timestamp is
stored in UTC with the original IANA timezone string kept alongside it, so all
offset/DST reasoning is delegated to a library (Luxon) and never hand-rolled — the
schema is built so the hard time-math is correct by construction.

**What relationships exist between your tables and why?**
User 1→many Trip (ownership), Trip 1→many FlightSegment (a journey is an ordered list
of legs). Layovers aren't stored — they're *derived* as the gaps between consecutive
segments, so the data stays normalized and there's no redundant state to keep in sync.

**What's the most complex query your app handles?**
Fetching a trip with all its flight segments ordered by departure time — a
`findUnique` with an ordered `include`. It's the query that feeds the entire engine
pipeline: the ordered legs go in, and the timeline (segments + derived layovers),
date-line crossings, and sleep windows come out. The complexity is less the SQL than
that it's the single input the whole computation depends on.

**Who is your user and what's the one problem you're solving for them?**
A traveler on a multi-time-zone trip. The one problem: "when should I sleep — on the
plane, and before and after — to minimize jetlag, given my actual flight times?" The
engine answers it precisely; the AI turns that answer into a personalized plan.

**Why write the test before the code?**
A failing test that fails *for the right reason* proves the test actually exercises
the behavior — that it would catch the bug if the code were wrong. Writing it first
forces me to define correct behavior before implementing, and the red→green git
history is evidence the code was driven by requirements, not retrofitted to pass.
(Concrete example: the date-line negative test forced the function to truly
discriminate instead of always returning true.)

**How does your CLI coding agent fit into the workflow?**
I direct it through CLAUDE.md — the rules file. It writes the failing test, captures
the real red run, implements the minimal green, captures the green, and commits with
exact messages. The control shows up where it *stops and asks* rather than taking a
shortcut: e.g. it refused to fabricate a red when behavior was already correct, and
it flagged a coverage gap the plan had missed instead of silently papering over it.
The rules file plus a confirm-before-every-commit gate is how I stay in control.

---

## 6. Live TDD demo — candidates and the exact rehearsed flow

Pick a **small, pure** feature so nothing flaky (DB/network) happens live. Two safe
candidates:

- **Candidate A (recommended): a tiny pure engine helper.** e.g. `isDaytimeFlight(seg)`
  — true when the segment's midpoint falls in a day arc — or a small formatting helper
  like `localClock(utc, tz)`. One assertion, fast red→green, fully in your engine's
  established style.
- **Candidate B: the first AI-glue unit** (`buildAdvicePrompt` asserting the prompt
  contains a fact). Shows the AI integration *and* TDD together — only pick this if the
  AI scaffolding is already in place and you've rehearsed it.

**Rehearsed flow (practice until it fits ~2 min):**
1. State the one behavior in a sentence.
2. Give the agent the prompt: *"Write a single failing test for `<fn>` that asserts
   `<behavior>`. Do not write the implementation yet."*
3. Run the test → show it **red**, fail for the right reason (function not defined).
4. Prompt: *"Now implement the minimal code to make it pass."*
5. Run the test → show it **green**.
6. One sentence: "test first, red for the right reason, minimal green — that's the loop
   for every unit in this project."

Rehearse the actual keystrokes and the agent's latency so the timing is real.

---

## 7. Include / exclude for the presentation

**Include:** the Prisma schema, the one ordered query, the timeline rendering, your
CLAUDE.md rules, one clean live TDD cycle, and (if built) the live AI call with the
"AI-generated" label.

**Exclude / don't get pulled into:** the screenshot-rendering tooling internals, every
engine edge case, the full commit history, deep Luxon/SunCalc details. Mention the
edge-case rigor (DST, leap year, date line) as a *strength in one sentence* — don't
spend the clock walking through each one.

---

## 8. Quick-reference facts (so you can answer cold)

- **Stack:** Next.js (App Router + API routes), PostgreSQL + Prisma (pinned to v6),
  Luxon (offsets/DST), SunCalc (sunrise/sunset), Vitest (TDD).
- **Why UTC + IANA tz:** store the absolute instant, keep the zone, delegate all
  offset/DST math to Luxon — never hand-roll it.
- **Honest-evidence decisions you can cite as talking points:** the fall-back unit
  was green-on-arrival (no fabricated red), and the date-line coverage gap was flagged
  and closed with a negative test. Both show real TDD discipline, not a performance of
  it.

---

## 9. The resume prompt (paste into the CLI agent when you come back)

> You are resuming the TimeShift TDD sprint after a short break. Re-establish context, then continue toward the Monday presentation in the priority order below.
>
> STEP 1 — Read in full before touching anything: `CLAUDE.md` (note the new **§13 — AI integration boundary**), `docs/SPECIFICATIONS.md`, `docs/USER_STORIES.md`, `docs/ACCEPTANCE_CRITERIA.md`, `docs/TDD_PLAN.md`, `docs/AI_ADVICE.md`, and `docs/RESUME_AND_PRESENT.md` (the roadmap + presentation plan).
>
> STEP 2 — Orient: run `git log --oneline -12` and `git status`; run `npm run test:run` and confirm the suite is green and `npm run test:coverage` shows the engine at 100%. If anything is not green/clean, STOP and report before doing anything else.
>
> STEP 3 — Confirm back in a few lines: (a) the engine is Phases 0–5 complete; (b) the top priority is now the **data layer** (Prisma schema → `migrate dev` against `DATABASE_URL` → an ordered query that feeds the engine), per `docs/RESUME_AND_PRESENT.md` §3; (c) after that, the AI feature per `docs/AI_ADVICE.md`, then a minimal demoable timeline page; (d) you'll keep every guardrail — TDD law (§2), time-handling (§4), git workflow with per-commit confirmation (§7), real-evidence-only (§8), AI boundary (§13). Do not proceed until I reply "go".
>
> ON "go" — begin **P1, the data layer**, in small committed steps, pausing per §7 before each commit: (1) write `prisma/schema.prisma` (User/Trip/FlightSegment, UTC `DateTime` + IANA tz string per field, matching the engine's segment shape); (2) `npx prisma migrate dev --name init`; (3) `npx prisma generate`; (4) add `lib/db/trips.ts` with `createTrip` and `getTripWithSegments` (ordered `include`); (5) a small seed script for one demo trip. Flag any schema/scope decision up front the way you did for the IDL rule rather than deciding it silently. Note that schema/migrations are config (not TDD'd) and query functions are integration territory — keep them thin; the engine stays the TDD showcase. After P1, stop and check in before starting the AI feature (P3).
>
> NON-NEGOTIABLES: real run output only (never fabricated); state exact git commands + Conventional Commit messages and pause before each commit; one logical change per commit; do not push unless I ask.
