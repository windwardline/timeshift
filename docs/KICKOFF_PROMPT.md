# Claude Code — Build Kickoff Prompt

Day 1 is specs only (the documents in this repo). Use the prompt below in the Claude
Code CLI on **Day 2** to start the actual build. Paste it as your first message in the
session, with this repo open.

---

```text
You are working in the TimeShift repository — a jetlag/layover visualizer built as a
5-day TDD sprint. Before writing ANY code, read these files in full and treat them as
the source of truth:

  - CLAUDE.md                       (guardrails, rules, git workflow, TDD law)
  - docs/SPECIFICATIONS.md          (architecture, data model, API, engine spec)
  - docs/USER_STORIES.md            (scope, priorities)
  - docs/ACCEPTANCE_CRITERIA.md     (Given/When/Then — what each test must prove)
  - docs/TDD_PLAN.md                (the ordered Red-Green-Refactor prompts)

Then confirm back to me, in a few lines, your understanding of: the stack, the
time-handling rules, and the TDD law. Do not proceed until I reply "go".

Once I say "go", work in this order, strictly test-first:

1. SCAFFOLD: initialize Next.js (App Router) + Prisma (PostgreSQL) + Vitest with
   coverage. Add the npm scripts test / test:run / test:coverage. Create schema.prisma
   for User, Trip, FlightSegment exactly as in SPECIFICATIONS.md, plus .env.example.
   Do NOT commit .env. Run the Vitest sanity check (Phase 0 in TDD_PLAN.md) and show me
   the passing output.

2. TEMPORAL ENGINE (lib/engine/), following docs/TDD_PLAN.md Phases 1–6 IN ORDER, one
   prompt at a time, Red → Green → Refactor:
     - write the failing test, run it, show me the RED output;
     - then minimal code to green, run the suite, show me the GREEN output;
     - then refactor with the suite green.
   The engine functions must be pure (no DB/framework imports). Hold engine coverage
   at 100%.

3. After each Green, RUN THE FULL SUITE and print the output so I can screenshot the
   real run for the README, then PAUSE for my confirmation before the next phase.

Hard rules (from CLAUDE.md — do not violate):
  - Never write production code before its failing test exists.
  - Persist all timestamps in UTC; delegate offsets/DST to Luxon; never hand-roll
    offset tables; hand-write and test the engine's own logic (IDL, assembly, sleep,
    arcs) per the plan.
  - At every git step: state the exact commands, state the exact commit message
    (Conventional Commits, e.g. `test: ...` for Red, `feat:`/`fix:` for Green,
    `refactor: ...`), and pause for my confirmation before running them. One logical
    change per commit. Never force-push.
  - Stay within the user stories in scope; flag anything that looks like scope creep
    and ask before building it.
  - Do not fabricate or mock test output — only ever show real runs.

Start by reading the files and giving me your confirmation. Wait for "go".
```

---

## How to use it

1. Open the repo in VS Code with the Claude Code CLI.
2. Paste the block above as your first message.
3. Reply `go` after it confirms its understanding.
4. At each phase, when it prints the Red and Green runs, screenshot the terminal and
   save the images to `docs/screenshots/` using the filenames already referenced in
   `README.md` (e.g. `01-offsets-red.png`, `01-offsets-green.png`). Those become your
   README test evidence.
5. Keep approving phase by phase so the git history stays in clean Red/Green steps.
