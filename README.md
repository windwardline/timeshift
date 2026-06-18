# TimeShift — Jetlag & Layover Visualizer

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

**Pending (not yet built):** timeline assembly (US-D1/D3), sleep windows (US-E4), and the
full suite + coverage run at sprint end.

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

### End-to-end verification (Playwright)

Planned for after deploy: the deployed app will be driven to a known itinerary and
screenshotted, and the same script will assert the headline numbers (arrival time,
offset, sleep-window label) as a regression check. Screenshots will be embedded here
once the run exists — not linked while the files are absent.

---

## Local Development (build phase)

```bash
# 1. Install
npm install

# 2. Configure environment (DATABASE_URL etc.) — .env is gitignored
cp .env.example .env

# 3. Run migrations
npx prisma migrate dev

# 4. Run the test suite (TDD loop)
npm run test            # watch mode
npm run test:run        # single run
npm run test:coverage   # with coverage report

# 5. Start the dev server
npm run dev
```
