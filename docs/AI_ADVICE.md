# AI Advice Feature — Spec Addendum (US-F1)

This is an **additive** spec. Nothing in `lib/engine/` changes. The temporal
engine (Phases 0–6) stays pure, deterministic, and 100%-covered. The AI feature
sits **downstream** of the engine — it consumes the engine's already-computed
facts and narrates them. The model can never feed back into the time-math, which
is the whole identity of this project.

Where it lives: a new server-only module `lib/ai/`. An LLM call is a network
call, so by **CLAUDE.md §4** it is categorically forbidden in `lib/engine/`.

---

## 1. User Story (Epic F — AI-assisted guidance)

**US-F1 (Must).** As a traveler, given my trip's computed timeline, I want a
personalized jetlag-adjustment plan in plain language, so I know how to shift my
sleep before, during, and after the flight.

The engine produces the hard facts (timezone delta, in-air sleep windows,
day/night arcs, IDL crossings). The model turns those facts into tailored,
human-readable guidance — the thing the engine is *not* for.

---

## 2. Acceptance Criteria (Given / When / Then)

**AC-F1.1 — Prompt carries the engine facts.**
Given a `TripFacts` object derived from the engine, when `buildAdvicePrompt(facts)`
runs, then the returned prompt string contains the timezone delta, the origin and
destination zones, and the sleep-window times. (Pure, deterministic.)

**AC-F1.2 — Well-formed response parses.**
Given a well-formed structured model response (JSON), when `parseAdviceResponse(raw)`
runs, then it returns an `AdvicePlan` with all required fields populated. (Pure.)

**AC-F1.3 — Malformed response fails safely.**
Given a malformed or non-JSON response, when `parseAdviceResponse(raw)` runs, then
it throws a typed error (or returns a typed failure) — it never returns a
half-populated plan and never throws an uncaught generic error. (Pure; this is the
error branch that keeps coverage honest — the negative-test discipline from the IDL
unit.)

**AC-F1.4 — Orchestration calls the model with the facts and returns a plan.**
Given a mocked `LlmClient`, when `generateAdvice(facts, client)` runs, then the
client is invoked with a prompt containing the facts, and the parsed `AdvicePlan`
is returned.

**AC-F1.5 — Orchestration degrades gracefully on client failure.**
Given a mocked client that throws, when `generateAdvice(facts, client)` runs, then
it surfaces a typed failure and does not crash. (Covers the failure branch.)

**AC-F1.6 — Live call (demo only).**
Given the real provider key configured server-side, when the user requests advice
in the running app, then a genuine live model call returns output uniquely
personalized to the on-screen trip, generated server-side, with the key never
reaching the browser. (Exercised in the demo — never unit-tested, never
snapshot-asserted.)

---

## 3. Architecture

```
lib/engine/        ← unchanged. pure. no network. (CLAUDE.md §4)
lib/ai/            ← new. server-only.
  facts.ts         ← assembleTripFacts(timeline, sleepWindows, offsets) → TripFacts   (PURE)
  prompt.ts        ← buildAdvicePrompt(facts) → string                                 (PURE)
  parse.ts         ← parseAdviceResponse(raw) → AdvicePlan | throws TypedError         (PURE)
  advice.ts        ← generateAdvice(facts, client) → Promise<AdvicePlan>               (orchestration; client injected)
  client.ts        ← the thin provider wrapper — the ONLY module that touches the SDK/network
app/api/trips/[id]/advice/route.ts   ← wires the REAL client behind the env key (server route)
```

**Key seams that make this testable without faking anything:**

- **`TripFacts`** is the structured output of the engine (timezone delta,
  sleep-window times, arc summary, IDL flags). If an adapter is needed to shape it,
  that adapter is pure and TDD'd like everything else; if Phase 5/6 already exposes
  the shape, reuse it (no new code).
- **`buildAdvicePrompt`** and **`parseAdviceResponse`** are pure functions. Genuine
  Red → Green, asserted against fixtures.
- **`LlmClient`** is an interface (e.g. `{ complete(prompt: string): Promise<string> }`).
  `generateAdvice` takes it as a parameter so tests pass a **mock**.
- **`client.ts`** is the single real-network module. It is the only thing not
  unit-tested, and it is explicitly excluded from coverage (see §6).

**Model output contract.** The model is instructed to return **structured JSON**
(e.g. `{ summary: string, preFlight: string[], inFlight: string[], postArrival: string[] }`).
Structured output is what makes `parseAdviceResponse` meaningfully testable and
makes AC-F1.3 (malformed handling) a real branch.

**Boundary rules (mirror §4):** engine pure; `lib/ai/` server-only; the key is
never imported into a client component.

---

## 4. TDD Plan (AI feature)

Each unit is a **genuine Red** (the function does not exist yet) driven to Green,
captured as a real log + colored screenshot via the existing tooling
(`npm run capture -- <NN-name-(red|green)> <vitest args>`), committed test-first
then feat, per the established two-commit rhythm. Continue the **per-unit `NN-name`
numbering in plan order** — prefix each with the next sequential `NN` at the time of
capture (the engine occupies `00`–`07`; Phases 4–6 will consume more before these
land).

| Unit | Capture name (assign next NN) | Red asserts | Green |
|------|-------------------------------|-------------|-------|
| AI-1 | `ai-prompt`        | `buildAdvicePrompt` missing → built prompt contains delta, zones, sleep-window times | assemble prompt from facts (PURE) |
| AI-2 | `ai-parse-ok`      | `parseAdviceResponse` missing → well-formed JSON fixture → full `AdvicePlan` | parse + validate required fields (PURE) |
| AI-3 | `ai-parse-bad`     | malformed fixture → expects typed failure (currently throws generic / wrong) | typed error path (PURE; covers error branch) |
| AI-4 | `ai-generate-ok`   | `generateAdvice` missing → mocked client → returns parsed plan, client called with facts-bearing prompt | orchestrate prompt → client → parse |
| AI-5 | `ai-generate-fail` | mocked client throws → expects graceful typed failure (currently crashes) | catch + typed failure (covers failure branch) |

**Route (Phase 7, after AI-1…AI-5):** `app/api/trips/[id]/advice/route.ts` wires the
**real** client behind `ANTHROPIC_API_KEY`. The route's own test mocks
`generateAdvice` (or the client) — the route is unit-tested for wiring/shape, not
for model content. The real call is demo-only.

**Tests never call the real API and never require a key.** The mocked client
returns fixtures. The full suite and coverage must pass with **no key present**
(grading/CI runs keyless).

---

## 5. Environment & API key

Create `.env.example` at the repo root, committed (documents the requirement
without the secret):

```
# Copy to .env.local (gitignored) and fill in a real value.
# Sits alongside your existing DATABASE_URL (wherever that is configured).
#
# AI provider key — read server-side only (API route / server action),
# never in a client component, never shipped to the browser.
# Anthropic is the default. For OpenAI, swap the wrapper in lib/ai/client.ts
# and use OPENAI_API_KEY instead.
ANTHROPIC_API_KEY=""
```

- Real key goes in **`.env.local`** (gitignored, exactly like `DATABASE_URL`).
  Confirm `.env.local` is ignored before committing anything.
- The key is read **server-side only** — in the API route / server action. Never in
  a client component. Anything that runs in the browser would ship the key to the
  browser.

---

## 6. Coverage policy

- The **deterministic AI surface** (`facts.ts`, `prompt.ts`, `parse.ts`, and
  `advice.ts` with the client mocked) is held to **100%** per §2/§10 — including
  the malformed-response (AC-F1.3) and client-error (AC-F1.5) branches.
- **`client.ts` is the single module excluded from coverage**, because it is the
  real network boundary. Mark the exclusion explicitly (e.g. an
  `/* v8 ignore file */` / istanbul-ignore pragma) so the exclusion is visible and
  intentional, not silent. It is exercised in the demo.

---

## 7. Demo clarity & evidence

The demo's AI output must be a **genuine live call** — never a canned response
dressed as live. Same inviolable line that has governed test evidence from day one:
real runs only.

- **Loading state.** Render a visible "generating…" state so the live call is seen
  happening in real time.
- **Labeling.** Mark the advice panel **"AI-generated"** in the UI — a clean visual
  seam between the deterministic timeline and the model's narrative.
- **Server-side request log.** Log the live request server-side with the **key
  redacted** (request id and/or token usage). Capture it as demo evidence.
- **Optional, airtight.** Open the browser network tab on the live request during
  the demo.
- **README note (verbatim):**
  > The engine and the AI glue (prompt assembly, response parsing, orchestration)
  > are unit-tested deterministically with a **mocked** model client; the suite runs
  > with no API key. The **live model call** is exercised in the demo with a real
  > key. Model output is non-deterministic by nature, so it is never snapshot-asserted.

Because the output is uniquely personalized to the on-screen trip, it self-evidently
cannot be hardcoded.

---

## 8. CLAUDE.md — add as a new section (§13)

Paste verbatim into `CLAUDE.md`:

> **§13 — AI integration boundary**
> - An AI/LLM call is a network call. Per §4 it is forbidden in `lib/engine/`. All AI code lives in `lib/ai/` and is server-only.
> - The provider call is isolated to one thin wrapper: `lib/ai/client.ts`. It is the only module in `lib/ai/` that touches the network/SDK. Everything else in `lib/ai/` is pure: facts assembly, prompt assembly, response parsing.
> - TDD law (§2) applies to the deterministic surface. `buildAdvicePrompt`, `parseAdviceResponse`, and `generateAdvice` (with the client mocked) are driven Red→Green like any engine unit, and held to 100% coverage (§10) — including the malformed-response and client-error branches.
> - The live provider call is never unit-tested and never snapshot-asserted: model output is non-deterministic. It is exercised only in the demo with a real key. `lib/ai/client.ts` is the single module excluded from coverage; mark the exclusion explicitly.
> - Tests never call the real API and never require a key. The mocked client returns fixtures. The suite and coverage must pass with no key present (grading/CI runs keyless).
> - The API key lives in `.env.local` (gitignored, like `DATABASE_URL`, §3). `.env.example` documents the variable name with no value. The key is read server-side only (API route / server action) — never imported into a client component, never shipped to the browser.
> - Evidence (§8): deterministic AI units get the usual red/green logs + colored screenshots. The live call is demo-only — capture a redacted server-side request log (request id and/or token usage; key redacted) as demo evidence. The README states plainly which parts are mocked-and-unit-tested and which part is live-and-demo-only. Real runs only — never fabricate a model response and present it as live output.

---

## 9. Sequencing (no disruption to the engine work)

1. **Now — guardrail checkpoint (docs/chore commit).** Add §13 to `CLAUDE.md`,
   create `.env.example`, confirm `.env.local` is gitignored, and commit this doc.
   No AI *code* yet. This puts the boundary in the repo before the first line of AI
   code, exactly as §4 was in place before the engine.
2. **Phases 4–6 — unchanged.** Day/night arcs, timeline assembly, sleep windows
   proceed exactly as planned. `TripFacts` becomes available as a by-product of
   Phases 5–6.
3. **Phase 7 — API + AI.** Build `lib/ai/` test-first (AI-1…AI-5, mocked client),
   then the route wiring the real client, then the component with the live call and
   the "AI-generated" + loading UI.
4. **Demo.** Live call, visible loading, labeled panel, redacted server log.
