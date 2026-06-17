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

> Populated during the sprint from real runs.

### TDD cycle logs (Red → Green → Refactor)

Every module's failing and passing runs are piped to `docs/logs/` and committed
alongside the code that produced them:

- Offsets & DST — [`01-offsets-red.txt`](docs/logs/01-offsets-red.txt) → [`01-offsets-green.txt`](docs/logs/01-offsets-green.txt)
- Leap year — [`02-leapyear-red.txt`](docs/logs/02-leapyear-red.txt) → [`02-leapyear-green.txt`](docs/logs/02-leapyear-green.txt)
- IDL crossings — [`03-idl-red.txt`](docs/logs/03-idl-red.txt) → [`03-idl-green.txt`](docs/logs/03-idl-green.txt)
- Sleep windows — [`04-sleep-red.txt`](docs/logs/04-sleep-red.txt) → [`04-sleep-green.txt`](docs/logs/04-sleep-green.txt)
- Full suite + coverage — [`05-suite-coverage.txt`](docs/logs/05-suite-coverage.txt)

### TDD cycle screenshots (colored Red → Green)

Every Red and Green run is also captured as a colored screenshot — produced from the
same run as the log above via `npm run capture -- <NN-name-red|green> <vitest args>`
(see `scripts/capture-tdd.sh` + `scripts/render-tdd.mjs`). Red runs render the failing
tests and assertion errors in red; Green runs render the passing suite in green. Images
share the same `NN-name-{red,green}` numbering as the logs:

- Offsets & DST — `docs/screenshots/01-offsets-red.png` → `docs/screenshots/01-offsets-green.png`
- Leap year — `docs/screenshots/02-leapyear-red.png` → `docs/screenshots/02-leapyear-green.png`
- IDL crossings — `docs/screenshots/03-idl-red.png` → `docs/screenshots/03-idl-green.png`
- Sleep windows — `docs/screenshots/04-sleep-red.png` → `docs/screenshots/04-sleep-green.png`

### End-to-end verification (Playwright)

The deployed app is driven to a known itinerary and screenshotted; the same script
asserts the headline numbers (arrival time, offset, sleep-window label) as a
regression check.

![Timeline E2E — known itinerary](docs/screenshots/e2e-timeline.png)
![Sleep-window E2E](docs/screenshots/e2e-sleep.png)

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
