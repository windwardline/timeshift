# CLAUDE.md — TimeShift Context, Guardrails & Rules

This file is the operating contract for any AI assistance on this repo. Read it in
full before doing anything. If a request conflicts with these rules, stop and flag it.

---

## 1. What this project is

TimeShift: a jetlag/layover visualizer. A horizontal timeline maps the traveler's
itinerary across time zones, overlays destination day/night arcs, and recommends
in-flight sleep windows. 5-day solo sprint. **TDD is mandatory throughout.**

Specs live in `docs/SPECIFICATIONS.md`, stories in `docs/USER_STORIES.md`, acceptance
criteria in `docs/ACCEPTANCE_CRITERIA.md`, and the test-writing plan in
`docs/TDD_PLAN.md`. Treat those as the source of truth.

## 2. The TDD law (highest priority)

- **No production code is written before a failing test exists for it.**
- Every unit follows **Red → Green → Refactor**:
  - Red: write the failing test, run it, confirm it fails for the right reason, commit.
  - Green: minimum code to pass, run the suite, confirm green, commit.
  - Refactor: clean up with the suite staying green.
- The temporal engine (`lib/engine/`) is built first and held at **100% coverage**.
- The suite must be green before any non-Red commit.
- Build the engine in the order given in `docs/TDD_PLAN.md`.

## 3. Stack — do not substitute without flagging

- **Next.js (App Router)** — frontend + API route handlers.
- **PostgreSQL** + **Prisma (pinned to `^6`)** — persistence; `schema.prisma` is the
  single source of truth for the data model. **Stay on Prisma 6 for this sprint:**
  Prisma 7's mandatory driver-adapter model removes `url` from the `datasource` block
  (it moves to `prisma.config.ts`) and renames the generator, which breaks the
  `schema.prisma`/`datasource` syntax the specs are written against. Do not bump to
  `7.x` without re-flagging.
- **Vitest** — all tests.
- **Luxon** — all UTC-offset and DST resolution (it carries the IANA tz database).
- **SunCalc** — sunrise/sunset for day/night arcs.

If you believe a different library is warranted, **stop and propose it** — do not swap
silently.

## 4. Time-handling rules (these prevent the project's core class of bugs)

- Persist **all** timestamps in **UTC**. Store the original IANA zone string alongside.
- **Never hand-roll offset or DST tables.** Delegate offsets/DST to Luxon.
- The engine's own *reasoning* (date-line detection, timeline assembly, layover
  detection, sleep windows, arc positioning) is hand-written and **must be test-driven**.
- Engine functions are **pure**: no DB, no `fetch`, no framework imports inside
  `lib/engine/`. This keeps them unit-testable.

## 5. Database & migrations

- The developer owns migrations on this solo repo. Use `npx prisma migrate dev` to
  create/apply migrations; commit the generated migration files.
- After schema changes, run `npx prisma generate`.
- **Never** hand-edit the generated Prisma client. Change `schema.prisma` and migrate.
- The dev/test database is local; never point at a shared or production database.

## 6. Secrets & environment

- `.env` is **gitignored** and never committed. Maintain a committed `.env.example`
  with placeholder keys (`DATABASE_URL`, session secret, etc.).
- Never print real secret values into code, logs, or the README.

## 7. Git workflow (prescriptive — follow exactly)

Work in small, reviewable steps. At each step:

1. State the **exact** shell commands you are about to run.
2. State the **exact** commit message before committing.
3. **Pause for my confirmation** before moving to the next module/checkpoint.

Use **Conventional Commits**, tied to the TDD phase:

- Red commit:  `test: add failing test for <unit> (<US-id>)`
- Green commit: `feat: implement <unit> to pass <US-id>` (or `fix:` when fixing)
- Refactor:    `refactor: <what changed> (suite green)`
- Docs/specs:  `docs: <what changed>`

One logical change per commit. Do not bundle unrelated changes. Do not force-push.

## 8. Test evidence

Two evidence types, both captured from real runs:

**A. TDD cycle logs (Red-Green-Refactor proof).**
- Pipe every test run to a file: Red to `docs/logs/NN-name-red.txt`, Green to
  `docs/logs/NN-name-green.txt` (NN = zero-padded phase order). Example:
  `npm run test:run -- lib/engine/time.test.ts > docs/logs/01-offsets-red.txt 2>&1`
- Confirm each Red fails for the RIGHT reason before implementing.
- Commit the code change plus BOTH captures together, one commit per unit
  (`test:` / `feat:` per §7). Captures are real run output — never edited or fabricated.

**B. E2E regression check (Playwright, after deploy).**
- A Playwright script opens the deployed app, drives it to a known itinerary, and
  screenshots to `docs/screenshots/`.
- The SAME script ASSERTS the headline numbers (computed arrival, offset, sleep-window
  label) as a regression check — it is a test, not just a screenshotter.

At sprint end, run `npm run test:coverage` and capture the full passing suite to
`docs/logs/`.

## 9. Scope discipline (5 days)

- Build only what's in `docs/USER_STORIES.md`. Anything in the "Out of scope" list
  stays out unless I explicitly re-scope it.
- If something looks like scope creep, **flag it and ask** before building it.
- Prefer the smallest correct implementation that satisfies the acceptance criteria.

## 10. Definition of Done (per story)

Every acceptance criterion has a passing test · engine coverage target holds · the
Red-Green-Refactor history is captured · the work is committed per §7.

## 11. When uncertain

If a requirement is ambiguous, the acceptance criteria conflict, or a change would
violate any rule above — **stop and ask** rather than guessing.

## 12. Committing a spec change (Day 1 / pre-build routine)

Whenever a doc in this repo is edited (a spec, story, criterion, or this file),
publish it to GitHub with the same three steps every time. Run from the repo root
(`timeshift/`):

```bash
git add .
git commit -m "docs: <short description of what changed>"
git push
```

Rules for this routine:

- Keep the message in the `docs:` Conventional Commit type, present tense, specific —
  e.g. `docs: tighten IDL acceptance criteria`, not `docs: update`.
- One logical doc change per commit. If you edited three unrelated files, make three
  commits.
- This is the pre-build routine only. Once the build starts, commits follow the TDD
  git workflow in §7 (`test:` for Red, `feat:`/`fix:` for Green, `refactor:`).

## 13. AI integration boundary

- An AI/LLM call is a network call. Per §4 it is forbidden in `lib/engine/`. All AI code lives in `lib/ai/` and is server-only.
- The provider call is isolated to one thin wrapper: `lib/ai/client.ts`. It is the only module in `lib/ai/` that touches the network/SDK. Everything else in `lib/ai/` is pure: facts assembly, prompt assembly, response parsing.
- TDD law (§2) applies to the deterministic surface. `buildAdvicePrompt`, `parseAdviceResponse`, and `generateAdvice` (with the client mocked) are driven Red→Green like any engine unit, and held to 100% coverage (§10) — including the malformed-response and client-error branches.
- The live provider call is never unit-tested and never snapshot-asserted: model output is non-deterministic. It is exercised only in the demo with a real key. `lib/ai/client.ts` is the single module excluded from coverage; mark the exclusion explicitly.
- Tests never call the real API and never require a key. The mocked client returns fixtures. The suite and coverage must pass with no key present (grading/CI runs keyless).
- The API key lives in `.env.local` (gitignored, like `DATABASE_URL`, §3). `.env.example` documents the variable name with no value. The key is read server-side only (API route / server action) — never imported into a client component, never shipped to the browser.
- Evidence (§8): deterministic AI units get the usual red/green logs + colored screenshots. The live call is demo-only — capture a redacted server-side request log (request id and/or token usage; key redacted) as demo evidence. The README states plainly which parts are mocked-and-unit-tested and which part is live-and-demo-only. Real runs only — never fabricate a model response and present it as live output.
