# Differentiating the Jetlag Plan and Jetlag Coach

## Problem

TimeShift now ships two LLM-backed features that, in a demo, read as "two chat
boxes that give jetlag advice":

- **Jetlag Plan** (`AdvicePanel` on a trip page) — narrates the temporal engine's
  computed facts for a specific itinerary into a structured pre/in/post plan.
- **Jetlag Coach** (`/coach`) — open-ended RAG Q&A grounded in a curated KB, with
  verifiable citations, follow-up, and honest refusal.

They are mechanically opposite but the UI never dramatizes the difference. This is
a presentation problem: both are *necessary* (they satisfy two different
assignments combined into one project) and **neither feature's functionality may
be removed.** The goal is to make them read as two distinct, complementary tools.

## Core distinction

- **Plan = "your itinerary, computed."** Grounded in *your* flight via the
  deterministic engine (exact UTC-offset shift, the specific in-flight sleep
  windows, date-line crossing). Personal, prescriptive, no external sources
  because it is computed for you.
- **Coach = "your questions, sourced."** Grounded in a research KB. General,
  educational, cited to authoritative external sources, refuses off-topic.

## Approach (approved)

Lean each feature into its signature mechanic and cross-link them. No capability
is added or removed; the change is framing + surfacing what each already does.

### A. Jetlag Plan — surface the computed inputs

- The advice route already assembles `TripFacts` (offset delta, sleep-window
  labels, date-line flag) but returns only the `AdvicePlan`. Change the response
  to `{ ...plan, facts }` so the client can show what the plan was computed from.
  `facts` are deterministic engine outputs (not model output), so returning them
  is safe and is the "computed" signature.
- `AdvicePanel` renders a **"Computed from your flight" chip strip** above the
  plan — e.g. `+13.0h eastward · sleep 21:00–01:00 Tokyo · crosses the Date Line`.
- Copy leans into "for THIS itinerary, from the temporal engine."
- Cross-link: "Have a general jetlag question? → Ask the Coach" (`/coach`).

### B. Jetlag Coach — foreground sourcing & honesty

- Reframe identity/value copy: general "ask anything," answered only from
  **cited** research; explicitly not tied to a trip.
- Add a **"Grounded in N cited source(s)"** indicator on grounded answers
  (foreground the RAG mechanic). Refusal keeps its "Outside the knowledge base"
  treatment (honesty as a feature).
- Cross-link: "Planning a specific trip? → Build a trip for a computed plan"
  (home `/`).

### C. Demo narrative

The contrasting taglines + mutual cross-links make the story explicit:
**Plan = computed-for-your-flight · Coach = sourced general answers.**

## Components & data flow

| Unit | Change | Test |
| ---- | ------ | ---- |
| `lib/trips/computed-summary.ts` (new, pure) | `describeComputedFacts(facts)` → display chips: shift (`+13.0h eastward`), sleep window label(s), date-line note. Client-safe (no engine/network imports). | 100% unit (in coverage allowlist) |
| `app/api/trips/[id]/advice/route.ts` | Return `{ ...plan, facts }` | route test asserts `facts` present |
| `components/AdvicePanel.tsx` | Render computed-facts chip strip via `describeComputedFacts`; cross-link to Coach; copy | (client; covered via existing route + new unit) |
| `app/coach/page.tsx` | "Grounded in N sources" indicator; reframed copy; cross-link to build a trip | E2E asserts indicator + cross-link |
| `e2e/coach.spec.ts` | Assert grounding indicator text + cross-link present | n/a |

## Constraints

- TDD law (§2): the pure formatter is driven Red→Green; route/E2E updated.
- §13 AI boundary unchanged: `facts` are engine output; no new model surface.
- 100% coverage on the deterministic surface holds; keyless suite + E2E stay green.
- Conventional Commits; feature branch `feat/coach-plan-differentiation`; PR → merge.

## Out of scope

- Multi-turn Coach conversations, retrieved-passage transparency UI, or any new
  AI capability (the approved approach is "lean into existing mechanics").
- Changing the engine, the KB, or the advice prompt/parse contracts.
