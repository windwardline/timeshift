# TimeShift — Jetlag & Layover Visualizer

**▶ Live demo: [timeshift.windwardline.com](https://timeshift.windwardline.com)** — passwordless
magic-link sign-in (Resend), Postgres on Supabase, hosted on Vercel behind Cloudflare DNS.

A high-performance itinerary visualization tool that helps international travelers
mitigate jetlag by mapping their biological clock against their destination's time
zone. Instead of a standard itinerary list, TimeShift renders a dynamic horizontal
timeline with color-coded day/night arcs at the destination, showing exactly when
to sleep on the plane.

**Sprint scope:** 5-day deployment · solo build · Test-Driven Development (Vitest)
throughout, with a documented Red → Green → Refactor cycle on the temporal engine.

---

## Stack

| Layer        | Choice                                            |
|--------------|---------------------------------------------------|
| Frontend     | Next.js (App Router), client-side visualization   |
| Backend      | Next.js API routes                                |
| Database     | PostgreSQL                                         |
| ORM          | Prisma (type-safe relational queries)             |
| Testing      | Vitest (TDD: Red-Green-Refactor)                  |
| Time/zones   | Luxon (IANA tz database) + SunCalc (sunrise/sunset)|

---

## Day 1 Deliverables (for review before build)

These are the specs due before any code is written. Each instructor requirement
maps to its own document:

| Instructor requirement              | Document                              |
|-------------------------------------|---------------------------------------|
| User Stories                        | [`docs/USER_STORIES.md`](docs/USER_STORIES.md) |
| Acceptance Criteria                 | [`docs/ACCEPTANCE_CRITERIA.md`](docs/ACCEPTANCE_CRITERIA.md) |
| Specifications                      | [`docs/SPECIFICATIONS.md`](docs/SPECIFICATIONS.md) |
| Prompts for writing Tests (TDD plan)| [`docs/TDD_PLAN.md`](docs/TDD_PLAN.md) |
| Context file (guardrails & rules)   | [`CLAUDE.md`](CLAUDE.md)              |

Build kickoff prompt for Claude Code: [`docs/KICKOFF_PROMPT.md`](docs/KICKOFF_PROMPT.md)

---

## Test Evidence (TDD)

> Populated during the sprint from real runs. Captures are numbered **per unit** in
> `docs/TDD_PLAN.md` order (`NN-name`), so the numbering tracks the units built rather
> than one entry per phase. Only links to committed files appear below; unbuilt phases
> are listed as pending.

### TDD cycle logs (Red → Green → Refactor)

Each unit's failing and passing runs are piped to `docs/logs/` and committed
alongside the code that produced them.

**Phase 0 — Harness**

- Sanity check — [`00-sanity-green.txt`](docs/logs/00-sanity-green.txt) (green only; trivial `1 + 1` harness proof)

**Phase 1 — UTC offsets & DST (US-E1)**

- Offsets (EST/EDT) — [`01-offsets-red.txt`](docs/logs/01-offsets-red.txt) → [`01-offsets-green.txt`](docs/logs/01-offsets-green.txt)
- Spring-forward gap — [`02-springforward-red.txt`](docs/logs/02-springforward-red.txt) → [`02-springforward-green.txt`](docs/logs/02-springforward-green.txt)
- Fall-back ambiguous hour — [`03-fallback-green.txt`](docs/logs/03-fallback-green.txt) (green only — see note)

> **No Red phase for the fall-back unit.** The first-occurrence resolution is inherited
> from Luxon (which resolves an ambiguous local time to the earlier instant), and `toUtc`
> already existed from the spring-forward unit — so this test characterizes
> existing-correct behavior rather than driving new code. No Red was fabricated; a single
> green run was captured.

**Phase 2 — Leap year (US-E2)**

- Duration across leap day — [`04-leapyear-red.txt`](docs/logs/04-leapyear-red.txt) → [`04-leapyear-green.txt`](docs/logs/04-leapyear-green.txt)
- Add-year clamping — [`05-addyear-red.txt`](docs/logs/05-addyear-red.txt) → [`05-addyear-green.txt`](docs/logs/05-addyear-green.txt)

**Phase 3 — International Date Line (US-E3)**

- West crossing (Tokyo → LA) — [`06-idl-tokyo-red.txt`](docs/logs/06-idl-tokyo-red.txt) → [`06-idl-green.txt`](docs/logs/06-idl-green.txt)
- Non-crossing guard (JFK → LHR) — [`06-idl-noncrossing-red.txt`](docs/logs/06-idl-noncrossing-red.txt) → [`06-idl-green.txt`](docs/logs/06-idl-green.txt)
- East crossing leap (LA → Sydney) — [`07-idl-sydney-red.txt`](docs/logs/07-idl-sydney-red.txt) → [`07-idl-sydney-green.txt`](docs/logs/07-idl-sydney-green.txt)

> **One Green for two unit-06 Reds.** The west-crossing and non-crossing tests were both
> driven Red first, then satisfied by a single precede-check implementation captured as
> `06-idl-green`. The LA → Sydney Red (`07`) then forced the eastward calendar-leap branch.

**Phase 4 — Day/night arcs (US-D2)**

- Sunrise/sunset tiling — [`08-arcs-red.txt`](docs/logs/08-arcs-red.txt) → [`08-arcs-green.txt`](docs/logs/08-arcs-green.txt)

**Phase 5 — Timeline assembly (US-D1/D3)**

- Segments + layover axis — [`09-timeline-red.txt`](docs/logs/09-timeline-red.txt) → [`09-timeline-green.txt`](docs/logs/09-timeline-green.txt)

**Phase 6 — Sleep windows (US-E4)**

- Red-eye in-air window — [`16-sleep-redeye-red.txt`](docs/logs/16-sleep-redeye-red.txt) → [`16-sleep-redeye-green.txt`](docs/logs/16-sleep-redeye-green.txt)
- Short daytime hop → zero windows — [`17-sleep-daytime-green.txt`](docs/logs/17-sleep-daytime-green.txt) (green only — see note)
- Never during a layover (covers in-air guard) — [`18-sleep-layover-green.txt`](docs/logs/18-sleep-layover-green.txt) (green only — see note)

> **Green-on-arrival for the daytime + layover cases.** The red-eye Red drove the general
> night-clipping implementation; the daytime-hop and layover cases were already handled
> correctly by it (zero windows when nothing overlaps destination night; layovers skipped
> as ground time), so they characterize existing behavior and close the branch-coverage
> gap rather than driving new code. No Red was fabricated.

**Timeline geometry (US-D1)**

- Scale helper (time → x) — [`20-scale-red.txt`](docs/logs/20-scale-red.txt) → [`20-scale-green.txt`](docs/logs/20-scale-green.txt)

**AI advice feature (US-F1)** — the deterministic glue, driven Red → Green against a **mocked** model client (no key required):

- Prompt carries the facts — [`10-ai-prompt-red.txt`](docs/logs/10-ai-prompt-red.txt) → [`10-ai-prompt-green.txt`](docs/logs/10-ai-prompt-green.txt)
- Prompt branch coverage — [`15-ai-prompt-branches-green.txt`](docs/logs/15-ai-prompt-branches-green.txt) (green only — pins westward/IDL/no-sleep branches)
- Well-formed response parses — [`11-ai-parse-ok-red.txt`](docs/logs/11-ai-parse-ok-red.txt) → [`11-ai-parse-ok-green.txt`](docs/logs/11-ai-parse-ok-green.txt)
- Malformed response fails safely — [`12-ai-parse-bad-red.txt`](docs/logs/12-ai-parse-bad-red.txt) → [`12-ai-parse-bad-green.txt`](docs/logs/12-ai-parse-bad-green.txt)
- Orchestration calls client + returns plan — [`13-ai-generate-ok-red.txt`](docs/logs/13-ai-generate-ok-red.txt) → [`13-ai-generate-ok-green.txt`](docs/logs/13-ai-generate-ok-green.txt)
- Orchestration degrades on client failure — [`14-ai-generate-fail-red.txt`](docs/logs/14-ai-generate-fail-red.txt) → [`14-ai-generate-fail-green.txt`](docs/logs/14-ai-generate-fail-green.txt)
- Engine → facts adapter — [`19-ai-facts-red.txt`](docs/logs/19-ai-facts-red.txt) → [`19-ai-facts-green.txt`](docs/logs/19-ai-facts-green.txt)

**Jetlag Coach — grounded RAG (US-R)** — pure retrieval/grounding + AI glue, driven Red → Green, keyless:

- Chunk markdown by heading — [`30-chunk-red.txt`](docs/logs/30-chunk-red.txt) → [`30-chunk-green.txt`](docs/logs/30-chunk-green.txt)
- Cosine vector search (top-k) — [`31-search-red.txt`](docs/logs/31-search-red.txt) → [`31-search-green.txt`](docs/logs/31-search-green.txt)
- Lexical fallback (TF-IDF cosine) — [`32-lexical-red.txt`](docs/logs/32-lexical-red.txt) → [`32-lexical-green.txt`](docs/logs/32-lexical-green.txt); bounded-score refactor [`32b-lexical-tfidf-red.txt`](docs/logs/32b-lexical-tfidf-red.txt) → [`32b-lexical-tfidf-green.txt`](docs/logs/32b-lexical-tfidf-green.txt)
- Refusal gate — [`33-ground-red.txt`](docs/logs/33-ground-red.txt) → [`33-ground-green.txt`](docs/logs/33-ground-green.txt)
- Grounded prompt assembly — [`34-grounded-prompt-red.txt`](docs/logs/34-grounded-prompt-red.txt) → [`34-grounded-prompt-green.txt`](docs/logs/34-grounded-prompt-green.txt)
- Grounded response parse (incl. malformed) — [`35-grounded-parse-red.txt`](docs/logs/35-grounded-parse-red.txt) → [`35-grounded-parse-green.txt`](docs/logs/35-grounded-parse-green.txt)
- Orchestrator (both paths + refusal + failure) — [`36-coach-red.txt`](docs/logs/36-coach-red.txt) → [`36-coach-green.txt`](docs/logs/36-coach-green.txt); no-vectors fallback [`36b-coach-novectors-red.txt`](docs/logs/36b-coach-novectors-red.txt) → [`36b-coach-novectors-green.txt`](docs/logs/36b-coach-novectors-green.txt)
- POST /api/coach route — [`37-coach-route-red.txt`](docs/logs/37-coach-route-red.txt) → [`37-coach-route-green.txt`](docs/logs/37-coach-route-green.txt)

**Trip input (US-B1/C1)**

- Validate + UTC-normalize builder input — [`23-normalize-red.txt`](docs/logs/23-normalize-red.txt) → [`23-normalize-green.txt`](docs/logs/23-normalize-green.txt)

**Accounts (US-A1)**

- Validate credentials (email + 8-char password) — [`24-credentials-red.txt`](docs/logs/24-credentials-red.txt) → [`24-credentials-green.txt`](docs/logs/24-credentials-green.txt)

The auth/ownership wiring is integration, exercised by route tests (not unit-gated): register
hashes with **real bcrypt** and rejects duplicates; login is generic on failure; and the
**ownership-isolation** test proves a non-owner gets a bare 404 on another user's trip (US-B4).

**Sprint-end full run.** The complete passing suite and the 100%-coverage report are
captured from real runs: [`21-full-suite-green.txt`](docs/logs/21-full-suite-green.txt)
(48/48 passing) and [`22-coverage-green.txt`](docs/logs/22-coverage-green.txt)
(statements/branches/functions/lines all 100% across `lib/engine/` + `lib/ai/`, with
`lib/ai/client.ts` excluded as the live-network module).

### TDD cycle screenshots (colored Red → Green)

Each run above is also captured as a colored screenshot — produced from the same run as
its log via `npm run capture -- <NN-name-(red|green)> <vitest args>` (see
`scripts/capture-tdd.sh` + `scripts/render-tdd.mjs`). Red runs render failing tests and
assertion errors in red; green runs render the passing suite in green. Images share the
`NN-name` numbering of the logs:

- Sanity check — `docs/screenshots/00-sanity-green.png`
- Offsets (EST/EDT) — `docs/screenshots/01-offsets-red.png` → `docs/screenshots/01-offsets-green.png`
- Spring-forward gap — `docs/screenshots/02-springforward-red.png` → `docs/screenshots/02-springforward-green.png`
- Fall-back ambiguous hour — `docs/screenshots/03-fallback-green.png` (green only — see note above)
- Duration across leap day — `docs/screenshots/04-leapyear-red.png` → `docs/screenshots/04-leapyear-green.png`
- Add-year clamping — `docs/screenshots/05-addyear-red.png` → `docs/screenshots/05-addyear-green.png`
- West crossing (Tokyo → LA) — `docs/screenshots/06-idl-tokyo-red.png` → `docs/screenshots/06-idl-green.png`
- Non-crossing guard (JFK → LHR) — `docs/screenshots/06-idl-noncrossing-red.png` → `docs/screenshots/06-idl-green.png`
- East crossing leap (LA → Sydney) — `docs/screenshots/07-idl-sydney-red.png` → `docs/screenshots/07-idl-sydney-green.png`
- Sunrise/sunset tiling — `docs/screenshots/08-arcs-red.png` → `docs/screenshots/08-arcs-green.png`
- Segments + layover axis — `docs/screenshots/09-timeline-red.png` → `docs/screenshots/09-timeline-green.png`
- Red-eye sleep window — `docs/screenshots/16-sleep-redeye-red.png` → `docs/screenshots/16-sleep-redeye-green.png`
- Daytime hop / layover (green only) — `docs/screenshots/17-sleep-daytime-green.png`, `docs/screenshots/18-sleep-layover-green.png`
- Timeline scale helper — `docs/screenshots/20-scale-red.png` → `docs/screenshots/20-scale-green.png`
- AI prompt / parse / generate (US-F1) — `docs/screenshots/10-ai-prompt-*.png`, `11-ai-parse-ok-*.png`, `12-ai-parse-bad-*.png`, `13-ai-generate-ok-*.png`, `14-ai-generate-fail-*.png`, `15-ai-prompt-branches-green.png`
- Engine → facts adapter — `docs/screenshots/19-ai-facts-red.png` → `docs/screenshots/19-ai-facts-green.png`

### AI advice feature — what is mocked-and-tested vs live-and-demo-only

> The engine and the AI glue (prompt assembly, response parsing, orchestration)
> are unit-tested deterministically with a **mocked** model client; the suite runs
> with no API key. The **live model call** is exercised in the demo with a real
> key. Model output is non-deterministic by nature, so it is never snapshot-asserted.

`lib/ai/` is server-only (CLAUDE.md §13). `facts.ts`, `prompt.ts`, `parse.ts`, and
`advice.ts` are pure and held at 100% coverage — including the malformed-response and
client-error branches. `lib/ai/client.ts` is the single module that touches the network
(the Google Gen AI SDK); it is excluded from coverage with an explicit `/* v8 ignore file */`
pragma and is exercised only in the demo. The API key lives in `.env.local` (gitignored);
`.env.example` documents the variable name with no value. Tests and coverage pass with no
key present.

**Verified live.** With a real `GEMINI_API_KEY` set, the panel makes a genuine per-trip
Gemini call (`gemini-3.1-flash-lite`, with a fastest-first fallback chain that drops to
lighter models on a rate limit) that narrates the engine's computed facts — the screenshot
below quotes the 13-hour shift and the exact in-flight sleep window:

![Live AI-generated plan](docs/screenshots/app-ai-live.png)

### Jetlag Coach (grounded RAG) — what is mocked-and-tested vs live-and-demo-only

> A standalone `/coach` page answers a free-form jetlag question **only** from
> TimeShift's curated knowledge base: it retrieves the most relevant passages,
> grounds the answer in them, adds a **next-step follow-up**, **cites verifiable
> external sources** (CDC, NHS, Sleep Foundation, …), and **refuses honestly**
> when the question falls outside the KB.

**Retrieval is grounded and the citations are verifiable (AC-R1/R3).** The
knowledge base is **55 hand-authored markdown docs** under [`docs/kb/`](docs/kb/),
chunked by `##` heading (~220 passages). Each doc carries YAML frontmatter naming a
real, authoritative source (an org title + URL), and the coach cites **those
external links** — never the internal filename, and never anything the model made
up. Citations are derived from the *retrieved* docs' metadata, so the model cannot
fabricate a source by construction. Retrieval is **semantic** — Google embeddings +
cosine over precomputed chunk vectors (`docs/kb/kb-embeddings.json`) — when a key
and those vectors are present, and falls back to a **lexical TF-IDF-cosine** search
when not, so the feature works **keyless**. A refusal gate (`decideAnswerable`)
drops any question whose best passage doesn't clear the threshold *before* any
model call (AC-R2). Every answer also includes a **follow-up**: the single most
logical next step, grounded in the same retrieved context.

**Mocked-and-unit-tested (no key, 100% coverage).** `lib/rag/` (chunking, vector
search, lexical fallback, refusal gate) and the `lib/ai/` coach glue
(`buildGroundedPrompt`, `parseGroundedResponse`, `answerQuestion`) are pure and
held at **100%** — including the malformed-response and generation-failure
branches. The two I/O shells, `lib/rag/embed.ts` (the query-embedding network
call) and `lib/rag/corpus.ts` (filesystem KB load), are the only modules excluded
from coverage, each with an explicit `/* v8 ignore file */` pragma (CLAUDE.md
§13). The whole suite and coverage pass with **no API key** (AC-R4/R5).

**Live-and-demo-only.** Two things spend a real key: regenerating the KB vectors
(`npm run embed:kb`, model `gemini-embedding-001` at 768 dims) and the answer
**generation** (the same `GEMINI_API_KEY` and Gemini client as the advice
feature). Keyless, the coach still answers and cites sources, composing the
answer **extractively** from the retrieved passages; with a key it upgrades to an
LLM-written answer — the **Sources are identical either way**, since they come
from retrieval, not the model. The refusal gate is **path-aware**: embedding
cosine and TF-IDF cosine sit on different scales, so each path has its own
threshold (`COACH_THRESHOLD_SEMANTIC` ≈ 0.62, `COACH_THRESHOLD_LEXICAL` ≈ 0.25),
both env-overridable. On the 55-doc KB the semantic path separates cleanly
(on-topic ≈0.75–0.82 vs off-topic ≈0.49–0.52); the keyless lexical fallback is
weaker, so it gates conservatively. Model output is non-deterministic, so it is
never snapshot-asserted; the E2E (below) runs keyless for a deterministic grounded
answer + refusal.

![Grounded coach answer with sources](docs/screenshots/e2e-coach-grounded.png)

### Real flight selection — what is mocked-and-tested vs live-and-demo-only

> Rather than hand-typing airports and times, a traveler searches **real flights** by
> route + date, gets a sortable list, and picks one — the leg is filled with accurate
> scheduled times, IANA zones, terminals, and coordinates, so layovers compute from real
> gaps and input errors disappear. The manual builder remains as a fallback.

`lib/flights/` mirrors the AI boundary (CLAUDE.md §13): `validate.ts`, `parse.ts`,
`sort.ts`, `status.ts`, `coords.ts`, and `cache.ts` are pure/deterministic and held at
**100% coverage** — including malformed-response, missing-field, IDL, and TTL branches.
`lib/flights/client.ts` is the single module that touches the network (AviationStack); it
is excluded from coverage with a `/* v8 ignore file */` pragma and exercised only in the
demo. The search route is session-gated, validates params before any upstream call, and
serves a **6-hour DB cache** (`FlightQueryCache`) to protect the free tier's ~100 req/month.
The key lives in `.env.local` (gitignored); `.env.example` documents the name only. **The
suite and coverage pass with no key** — keyless, the route returns a friendly error and the
UI falls back to manual entry.

![Flight search in the builder](docs/screenshots/flight-search-builder.png)

A leg whose departure is within ~48h additionally shows a **live status badge**
(on-schedule / delayed / cancelled) from the same client — a trip planned weeks out has no
delay data yet, so future legs show scheduled-only by design. **Live-and-demo-only:** the
free tier is HTTP-only (a paid HTTPS plan is recommended for production), the live call
needs a real `AVIATIONSTACK_API_KEY`, and AviationStack output is never snapshot-asserted.

### Data layer

Five tables — `User 1→* Trip 1→* FlightSegment` plus `User 1→* Session` (for auth) and a
standalone `FlightQueryCache` (the flight-search TTL cache) — defined in
[`prisma/schema.prisma`](prisma/schema.prisma) and migrated into PostgreSQL
(`prisma/migrations/`). Accounts use bcrypt-hashed passwords and opaque
DB-backed session tokens in an httpOnly cookie; every trip query is scoped to its owner,
so a non-owner can't read or act on someone else's trip (US-B4). Every timestamp is stored in UTC with the original IANA timezone
string kept alongside it, so all offset/DST reasoning stays delegated to Luxon. Layovers
are **derived** (gaps between consecutive segments), not stored. The query that feeds the
whole engine pipeline is `getTripWithSegments` in [`lib/db/trips.ts`](lib/db/trips.ts): an
ownership-scoped `findFirst` with an ordered `include` on segments. Schema, migrations, and
the thin query layer are configuration/integration, not TDD'd — the engine remains the TDD
showcase.

### End-to-end verification

The running app, captured from `http://localhost:3000/` via a headless browser. The
landing pairs a trip builder with a fully-worked example:

![TimeShift home](docs/screenshots/app-home.png)

Any itinerary works — there is no seeded-data limitation. Entering airports + local times
in the builder and submitting drives the real path (validate → UTC-normalize → persist →
ownership-scoped fetch → engine → render) and lands on a per-trip page:

![A user-built trip](docs/screenshots/app-custom-trip.png)

The pages were asserted against the engine's headline numbers — trip name, computed clock
shift (`+12.0h` for the NY → Singapore showcase), destination axis labels, and the in-air
sleep window over the destination's night. The **"AI-generated" panel is present** and
degrades cleanly without a key; its live model call is demo-only (it needs `GEMINI_API_KEY`
in `.env.local`) and is never snapshot-asserted.

These numbers are now locked in by a committed Playwright regression spec
(`e2e/regression.spec.ts`, run with `npm run test:e2e`): it seeds the showcase trip, opens
the running app, and re-asserts the trip name, the `+12.0h` clock shift, the home/destination
zones, the flight legs, and the recommended sleep window — so a temporal-engine regression
fails the check rather than slipping through. It is a test, not just a screenshotter (§8.B).

---

## Local Development (build phase)

```bash
# 1. Install
npm install

# 2. Configure environment (DATABASE_URL etc.) — .env is gitignored
cp .env.example .env

# 3. Run migrations + seed one demo trip
npx prisma migrate dev
npm run seed

# 4. Run the test suite (TDD loop) — no API key required
npm run test            # watch mode
npm run test:run        # single run
npm run test:coverage   # with coverage report

# 5. (Optional) enable the live AI advice call for the demo
#    Add GEMINI_API_KEY to .env.local (gitignored). The timeline renders
#    without it; only the "Get my jetlag plan" button needs a key.

# 6. Start the dev server
npm run dev
```
