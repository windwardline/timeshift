# Jetlag Coach (Grounded RAG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a grounded jetlag Q&A coach to TimeShift: semantic retrieval over a curated KB, an LLM answer grounded only in retrieved context, sources displayed, off-topic questions refused.

**Architecture:** A pure `lib/rag/` module (chunking, vector search, lexical fallback, refusal gate) mirroring `lib/engine/`'s purity, plus extensions to the existing `lib/ai/` boundary (grounded prompt, response parse, `answerQuestion` orchestrator). The only network calls — embedding the query and generating the answer — live in thin shells (`embed.ts`, `client.ts`) that are mocked in tests and excluded from coverage. KB chunk vectors are precomputed by a script and committed, so the suite runs keyless and deterministic.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Vitest, `@google/genai` (generation + embeddings), Prisma 6 (unchanged), Playwright (E2E).

## Global Constraints

- **TDD law (§2):** no production code before a failing test; Red → Green → Refactor; commit Red and Green together per unit; capture run logs to `docs/logs/NN-name-red.txt` / `-green.txt`.
- **Engine/RAG purity (§4):** `lib/rag/` tested units have no `fetch`, no DB, no framework imports. Pure functions only.
- **AI boundary (§13):** network isolated to `lib/rag/embed.ts` and `lib/ai/client.ts`; both excluded from coverage (marked explicitly); everything else in `lib/ai/` and `lib/rag/` is pure and held at 100%.
- **Keyless (§13):** the full unit suite + coverage pass with NO API key. KB vectors are committed fixtures; the query embedder and generation client are mocked in tests.
- **Provider:** `@google/genai` only — no new AI dependency. No new runtime dep unless flagged (§3).
- **Prisma stays on `^6`** (§3). This feature adds no schema changes.
- **Conventional Commits (§7):** `test:` Red, `feat:`/`fix:` Green, `refactor:`, `docs:`. One logical change per commit. No force-push.
- **Scope (§9):** build only US-R below; out-of-scope list in the design spec stays out.
- **Provider id verification:** exact Google embedding model id + dimension confirmed via context7 at Task 8 before writing the shell.

**Source spec:** `docs/superpowers/specs/2026-06-26-jetlag-coach-rag-design.md`

---

## File Structure

| File | Responsibility | Coverage |
| ---- | -------------- | -------- |
| `docs/kb/*.md` (10 docs) | Hand-authored knowledge base | n/a (content) |
| `docs/kb/kb-embeddings.json` | Committed precomputed chunk vectors | n/a (artifact) |
| `lib/rag/types.ts` | `Chunk`, `ScoredChunk`, `Decision`, `KbVector` types | n/a (types) |
| `lib/rag/chunk.ts` | `chunkMarkdown(raw, docId)` — split md by heading | 100% |
| `lib/rag/search.ts` | `searchByVector(queryVec, kbVectors, k)` — cosine + top-k | 100% |
| `lib/rag/lexical.ts` | `searchLexical(query, chunks, k)` — BM25-lite fallback | 100% |
| `lib/rag/ground.ts` | `decideAnswerable(scored, threshold)` — refusal gate | 100% |
| `lib/rag/embed.ts` | `embedQuery(text)` — Google embeddings I/O shell | EXCLUDED |
| `lib/rag/corpus.ts` | `loadCorpus()` — read `docs/kb/*.md` + `kb-embeddings.json` (fs) | EXCLUDED |
| `lib/ai/prompt.ts` | + `buildGroundedPrompt(query, chunks)` | 100% |
| `lib/ai/parse.ts` | + `parseGroundedResponse(raw)` | 100% |
| `lib/ai/coach.ts` | `answerQuestion(query, deps)` orchestrator | 100% |
| `scripts/embed-kb.ts` | Build-time: embed chunks → `kb-embeddings.json` | n/a (script) |
| `app/api/coach/route.ts` | POST handler: retrieve → refuse-or-generate → JSON | route test |
| `app/coach/page.tsx` | Question box → answer → Sources list | E2E |
| `tests/e2e/coach.spec.ts` | Playwright: grounded answer + refusal + screenshot | n/a |
| `vitest.config.ts` | Add `lib/rag/embed.ts`, `lib/rag/corpus.ts` to coverage exclude | n/a |
| `.env.example` | Document embedding/generation key var (no value) | n/a |
| `README.md` | State mocked-and-tested vs live-and-demo-only | n/a |

---

## Knowledge Base Doc List (robust — authored in Task 1)

Ten markdown docs under `docs/kb/`, each chunked by `##` heading. Designed for demo
breadth: every doc surfaces distinct retrievable chunks so live questions land cleanly.

1. **`circadian-basics.md`** — What the body clock is; circadian rhythm & the SCN; what
   jetlag actually is (internal clock vs. local time mismatch); why symptoms happen
   (fatigue, fog, GI upset, broken sleep); the rule of thumb that the clock shifts ~1
   hour/day.
2. **`eastward-vs-westward.md`** — Why eastward (phase-advance) is harder than westward
   (phase-delay); "east = early, west = late"; estimating recovery days by direction and
   zones crossed; which routes are worst.
3. **`light-exposure.md`** — Light as the master cue; seek vs. avoid light by direction;
   morning vs. evening light timing; the role of sunglasses; using the destination's
   daylight on arrival day.
4. **`melatonin-timing.md`** — What melatonin does (signal, not sedative); typical low-dose
   timing eastward vs. westward; when to take relative to target bedtime; cautions and
   what it is not.
5. **`pre-flight-adjustment.md`** — Shifting sleep/wake 30–60 min/day before departure;
   eastward = earlier, westward = later; meal-timing prep; when pre-adjustment is worth it
   vs. not.
6. **`arrival-day-plan.md`** — The first-24-hours playbook; adopt local meal & sleep times
   immediately; the strategic-nap-vs-push-through decision; getting outdoor light; avoiding
   the "crash nap."
7. **`napping-strategy.md`** — Strategic naps (20–30 min) vs. long naps that wreck night
   sleep; nap timing windows; sleep-pressure vs. circadian drive; when not to nap.
8. **`caffeine-and-alcohol.md`** — Caffeine timing to fight afternoon dips without harming
   night sleep; half-life and cut-off times; why alcohol fragments sleep; hydration on
   long-haul.
9. **`in-flight-strategy.md`** — Setting your watch to destination time at boarding; when to
   sleep vs. stay awake in the air; light/eye-mask use aloft; movement, hydration, meal
   timing on the plane.
10. **`special-cases.md`** — Short trips (don't fully shift); red-eyes; crossing the
    International Date Line; older travelers & those with fixed schedules; when to just
    minimize disruption instead of adapting.

Each doc: a one-line intro, then 3–6 `##` sections of 2–5 sentences each (one retrievable
idea per section). Plain, authored prose — no external copyrighted text.

---

## Task 0: Add US-R user story + acceptance criteria (docs, pre-build)

**Files:**
- Modify: `docs/USER_STORIES.md` (append US-R)
- Modify: `docs/ACCEPTANCE_CRITERIA.md` (append US-R criteria)

**Interfaces:** Produces the scope authority for all later tasks (§9).

- [ ] **Step 1:** Append **US-R: Grounded Jetlag Coach** to `docs/USER_STORIES.md`, matching the existing story format. Story: "As a traveler, I can ask a jetlag/sleep question and get an answer grounded only in TimeShift's curated knowledge base, with its sources shown, and an honest refusal when my question is outside that knowledge."
- [ ] **Step 2:** Append acceptance criteria to `docs/ACCEPTANCE_CRITERIA.md`:
  - AC-R1: A question covered by the KB returns an answer plus a non-empty Sources list naming the KB doc(s) used.
  - AC-R2: A question with no relevant KB chunk (below threshold) returns the refusal message and makes **no** generation call.
  - AC-R3: Sources shown are exactly the docs of the chunks passed to the model (no fabricated citations).
  - AC-R4: Retrieval is semantic when an embedder is available and falls back to lexical (BM25) when not; both paths run keyless in tests.
  - AC-R5: The unit suite and coverage pass with no API key.
- [ ] **Step 3: Commit** (no Red — this is the pre-build doc routine, §12):
```bash
git add docs/USER_STORIES.md docs/ACCEPTANCE_CRITERIA.md
git commit -m "docs: add US-R grounded jetlag coach story + acceptance criteria"
```

---

## Task 1: Author the knowledge base + types

**Files:**
- Create: `docs/kb/*.md` (the 10 docs above)
- Create: `lib/rag/types.ts`

**Interfaces:**
- Produces: `docs/kb/` corpus; the shared RAG types every later task imports.
```ts
export interface Chunk { id: string; docId: string; heading: string; text: string }
export interface KbVector { id: string; vector: number[] }            // id matches Chunk.id
export interface ScoredChunk extends Chunk { score: number }
export type Decision =
  | { answerable: true; chunks: ScoredChunk[] }
  | { answerable: false }
```

- [ ] **Step 1:** Write the 10 markdown docs per the doc list, each with a one-line intro and 3–6 `##` sections. Authored prose only.
- [ ] **Step 2:** Create `lib/rag/types.ts` with the interfaces above.
- [ ] **Step 3: Commit:**
```bash
git add docs/kb lib/rag/types.ts
git commit -m "feat: add curated jetlag knowledge base + rag types (US-R)"
```

---

## Task 2: `chunkMarkdown` — split markdown into heading chunks

**Files:** Create `lib/rag/chunk.ts`; Test `lib/rag/chunk.test.ts`

**Interfaces:**
- Consumes: `Chunk` from `lib/rag/types.ts`
- Produces: `chunkMarkdown(raw: string, docId: string): Chunk[]`

- [ ] **Step 1: Write failing tests** — cases: (a) a doc with two `##` sections yields two chunks with the right `heading` and `text`; (b) intro text before the first `##` becomes an "intro" chunk (or is attached per chosen rule — assert the rule); (c) chunk `id` is deterministic and unique (e.g. `` `${docId}#${index}` ``); (d) empty input yields `[]`. Use an inline fixture string, not a file read (keeps the unit pure).
- [ ] **Step 2:** Run `npm run test:run -- lib/rag/chunk.test.ts > docs/logs/30-chunk-red.txt 2>&1`; confirm it fails because `chunkMarkdown` is undefined.
- [ ] **Step 3:** Implement `chunkMarkdown` (pure string parsing).
- [ ] **Step 4:** Run `npm run test:run -- lib/rag/chunk.test.ts > docs/logs/30-chunk-green.txt 2>&1`; confirm pass.
- [ ] **Step 5: Commit** both files + both logs:
```bash
git add lib/rag/chunk.ts lib/rag/chunk.test.ts docs/logs/30-chunk-*.txt
git commit -m "feat: implement chunkMarkdown to pass US-R"
```

---

## Task 3: `searchByVector` — cosine similarity + top-k

**Files:** Create `lib/rag/search.ts`; Test `lib/rag/search.test.ts`

**Interfaces:**
- Consumes: `KbVector`, `Chunk`, `ScoredChunk`
- Produces: `searchByVector(queryVec: number[], kbVectors: KbVector[], chunks: Chunk[], k: number): ScoredChunk[]`
  (joins vectors to chunks by `id`, returns top-`k` by descending cosine score)

- [ ] **Step 1: Write failing tests** with hand-built fixture vectors: (a) the chunk whose vector is most aligned with the query ranks first; (b) results are sorted descending by score and length-capped at `k`; (c) cosine handles zero-magnitude vectors without NaN (returns score 0); (d) a `KbVector` with no matching `Chunk.id` is skipped. Assert numeric scores with `toBeCloseTo`.
- [ ] **Step 2:** Run → `docs/logs/31-search-red.txt`; confirm undefined-function failure.
- [ ] **Step 3:** Implement cosine + sort + slice (pure).
- [ ] **Step 4:** Run → `docs/logs/31-search-green.txt`; confirm pass.
- [ ] **Step 5: Commit:**
```bash
git add lib/rag/search.ts lib/rag/search.test.ts docs/logs/31-search-*.txt
git commit -m "feat: implement searchByVector cosine retrieval to pass US-R"
```

---

## Task 4: `searchLexical` — BM25-lite fallback

**Files:** Create `lib/rag/lexical.ts`; Test `lib/rag/lexical.test.ts`

**Interfaces:**
- Produces: `searchLexical(query: string, chunks: Chunk[], k: number): ScoredChunk[]`

- [ ] **Step 1: Write failing tests:** (a) a query sharing terms with one chunk's text ranks that chunk first; (b) tokenization is case-insensitive and ignores punctuation; (c) a rare term outranks a common one (IDF effect) given a fixture corpus; (d) no term overlap → all scores 0 (caller's threshold handles refusal). Keep the corpus an inline fixture.
- [ ] **Step 2:** Run → `docs/logs/32-lexical-red.txt`.
- [ ] **Step 3:** Implement BM25-lite (term freq + inverse doc freq, length-normalized). ~40 lines, pure.
- [ ] **Step 4:** Run → `docs/logs/32-lexical-green.txt`.
- [ ] **Step 5: Commit:**
```bash
git add lib/rag/lexical.ts lib/rag/lexical.test.ts docs/logs/32-lexical-*.txt
git commit -m "feat: implement BM25 lexical fallback retrieval to pass US-R"
```

---

## Task 5: `decideAnswerable` — refusal gate

**Files:** Create `lib/rag/ground.ts`; Test `lib/rag/ground.test.ts`

**Interfaces:**
- Consumes: `ScoredChunk`, `Decision`
- Produces: `decideAnswerable(scored: ScoredChunk[], threshold: number): Decision`

- [ ] **Step 1: Write failing tests:** (a) top score ≥ threshold → `{ answerable: true, chunks }` keeping only chunks at/above threshold; (b) top score < threshold → `{ answerable: false }`; (c) empty input → `{ answerable: false }`; (d) boundary: score exactly == threshold is answerable.
- [ ] **Step 2:** Run → `docs/logs/33-ground-red.txt`.
- [ ] **Step 3:** Implement the gate (pure).
- [ ] **Step 4:** Run → `docs/logs/33-ground-green.txt`.
- [ ] **Step 5: Commit:**
```bash
git add lib/rag/ground.ts lib/rag/ground.test.ts docs/logs/33-ground-*.txt
git commit -m "feat: implement decideAnswerable refusal gate to pass US-R"
```

---

## Task 6: `buildGroundedPrompt` — grounded prompt assembly

**Files:** Modify `lib/ai/prompt.ts`; Test `lib/ai/prompt.test.ts`

**Interfaces:**
- Consumes: `ScoredChunk`
- Produces: `buildGroundedPrompt(query: string, chunks: ScoredChunk[]): string` (or the project's existing prompt-shape type — match `buildAdvicePrompt`'s return type)

- [ ] **Step 1: Write failing tests:** (a) prompt contains every chunk's text and a labelled source id; (b) prompt contains the grounding instruction ("answer only from the context above; if it is not covered, say so"); (c) prompt contains the user's question verbatim. Match the existing `buildAdvicePrompt` test style.
- [ ] **Step 2:** Run → `docs/logs/34-grounded-prompt-red.txt`.
- [ ] **Step 3:** Implement `buildGroundedPrompt`, reusing existing prompt helpers/idioms in `prompt.ts`.
- [ ] **Step 4:** Run → `docs/logs/34-grounded-prompt-green.txt`.
- [ ] **Step 5: Commit:**
```bash
git add lib/ai/prompt.ts lib/ai/prompt.test.ts docs/logs/34-grounded-prompt-*.txt
git commit -m "feat: implement buildGroundedPrompt to pass US-R"
```

---

## Task 7: `parseGroundedResponse` — parse model output

**Files:** Modify `lib/ai/parse.ts`; Test `lib/ai/parse.test.ts`

**Interfaces:**
- Produces: `parseGroundedResponse(raw: string): { answer: string }` (mirror existing `parseAdviceResponse` contract, including its malformed-input behavior)

- [ ] **Step 1: Write failing tests:** (a) a well-formed model string yields the trimmed answer; (b) empty/whitespace raw throws or returns the project's defined error shape (match `parseAdviceResponse`); (c) the malformed branch is covered (per §13, parse error branches are required coverage).
- [ ] **Step 2:** Run → `docs/logs/35-grounded-parse-red.txt`.
- [ ] **Step 3:** Implement `parseGroundedResponse`, reusing `parse.ts` idioms.
- [ ] **Step 4:** Run → `docs/logs/35-grounded-parse-green.txt`.
- [ ] **Step 5: Commit:**
```bash
git add lib/ai/parse.ts lib/ai/parse.test.ts docs/logs/35-grounded-parse-*.txt
git commit -m "feat: implement parseGroundedResponse to pass US-R"
```

---

## Task 8: Network shells — `embed.ts` + `corpus.ts` (excluded from coverage)

**Files:** Create `lib/rag/embed.ts`, `lib/rag/corpus.ts`; Modify `vitest.config.ts`; Modify `.env.example`

**Interfaces:**
- Produces:
  - `embedQuery(text: string): Promise<number[] | null>` — returns `null` when no key/embedder is configured (drives the lexical fallback). The single embedding network call.
  - `loadCorpus(): { chunks: Chunk[]; vectors: KbVector[] }` — reads `docs/kb/*.md` (via `chunkMarkdown`) and `docs/kb/kb-embeddings.json` from disk.

- [ ] **Step 1:** Verify the current Google GenAI embedding model id + dimension via context7 (`@google/genai` docs). Record the chosen model id in a comment in `embed.ts`.
- [ ] **Step 2:** Implement `embed.ts`: read the key server-side; if absent, return `null` (no throw). Wrap the `@google/genai` embeddings call; this is the only network code here.
- [ ] **Step 3:** Implement `corpus.ts`: glob `docs/kb/*.md`, chunk each via `chunkMarkdown`, load `kb-embeddings.json`. Pure-ish but does fs I/O → excluded.
- [ ] **Step 4:** In `vitest.config.ts`, add `lib/rag/embed.ts` and `lib/rag/corpus.ts` to `coverage.exclude` (alongside the existing `lib/ai/client.ts` exclusion). Add a one-line comment citing §13.
- [ ] **Step 5:** In `.env.example`, document the key variable name (reuse the existing GenAI key var if one exists — check `lib/ai/client.ts`) with no value.
- [ ] **Step 6: Commit** (no Red — these are the excluded I/O shells, like `client.ts`):
```bash
git add lib/rag/embed.ts lib/rag/corpus.ts vitest.config.ts .env.example
git commit -m "feat: add embedQuery + corpus loader shells (coverage-excluded, US-R)"
```

---

## Task 9: `scripts/embed-kb.ts` — precompute committed vectors

**Files:** Create `scripts/embed-kb.ts`; Create `docs/kb/kb-embeddings.json`; Modify `package.json` (script entry)

**Interfaces:** Consumes `loadCorpus` chunks + `embedQuery`; produces the committed `kb-embeddings.json` (`KbVector[]`).

- [ ] **Step 1:** Implement the script: load chunks via `chunkMarkdown` over `docs/kb/*.md`, embed each chunk's text via the Google embeddings call, write `[{ id, vector }]` to `docs/kb/kb-embeddings.json`. Add `"embed:kb": "tsx scripts/embed-kb.ts"` (or the project's runner) to `package.json`.
- [ ] **Step 2:** Run the script **once with a real key** (this is the only token-spending build step; gated to when a key is available) to generate `kb-embeddings.json`. If no key is available at build time, leave a committed empty/placeholder `[]` so the app boots on the lexical path, and note in the README that vectors are regenerated via `npm run embed:kb`.
- [ ] **Step 3: Commit** the script + generated artifact:
```bash
git add scripts/embed-kb.ts docs/kb/kb-embeddings.json package.json
git commit -m "feat: add embed-kb script + precomputed KB vectors (US-R)"
```

---

## Task 10: `answerQuestion` orchestrator (mocked deps)

**Files:** Create `lib/ai/coach.ts`; Test `lib/ai/coach.test.ts`

**Interfaces:**
- Consumes: all pure units + injected deps (so tests stay keyless).
- Produces:
```ts
export interface CoachDeps {
  embedQuery: (text: string) => Promise<number[] | null>;
  generate: (prompt: string) => Promise<string>;     // the client wrapper, mocked in tests
  corpus: { chunks: Chunk[]; vectors: KbVector[] };
  threshold: number;
}
export interface CoachResult {
  grounded: boolean;
  answer: string;          // refusal message when grounded === false
  sources: string[];       // distinct docIds of chunks passed to the model; [] when refused
}
export async function answerQuestion(query: string, deps: CoachDeps): Promise<CoachResult>
```

- [ ] **Step 1: Write failing tests** (all deps mocked — keyless): (a) embedder returns a vector → `searchByVector` path → grounded answer + sources = docIds of chunks used; (b) embedder returns `null` → `searchLexical` path used (assert lexical retrieval still produces grounded result); (c) retrieval below threshold → `{ grounded: false, answer: <refusal>, sources: [] }` and `generate` is **never called** (assert mock not called); (d) `generate` throws → error surfaced per project convention (covered branch, §13); (e) `sources` are de-duplicated docIds.
- [ ] **Step 2:** Run → `docs/logs/36-coach-red.txt`.
- [ ] **Step 3:** Implement `answerQuestion`: embed → choose path → `decideAnswerable` → refuse or (`buildGroundedPrompt` → `generate` → `parseGroundedResponse`) → assemble `CoachResult`.
- [ ] **Step 4:** Run → `docs/logs/36-coach-green.txt`; confirm pass + 100% on `coach.ts`.
- [ ] **Step 5: Commit:**
```bash
git add lib/ai/coach.ts lib/ai/coach.test.ts docs/logs/36-coach-*.txt
git commit -m "feat: implement answerQuestion grounded orchestrator to pass US-R"
```

---

## Task 11: `POST /api/coach` route

**Files:** Create `app/api/coach/route.ts`; Test `app/api/coach/route.test.ts`

**Interfaces:** Consumes `answerQuestion`, `loadCorpus`, `embedQuery`, and the existing generation client. Produces JSON `{ grounded, answer, sources }`.

- [ ] **Step 1: Write failing tests** (follow the existing `app/api/trips/[id]/advice/route.test.ts` pattern; mock `answerQuestion`): (a) valid `{ question }` body → 200 with `{ grounded, answer, sources }`; (b) missing/empty question → 400 (Zod-validated, matching project style); (c) refusal result passes through as 200 with `grounded: false`.
- [ ] **Step 2:** Run → `docs/logs/37-coach-route-red.txt`.
- [ ] **Step 3:** Implement the route: Zod-validate body, build `CoachDeps` (real `loadCorpus`/`embedQuery`/client, server-side key read), call `answerQuestion`, return JSON. Key is read server-side only.
- [ ] **Step 4:** Run → `docs/logs/37-coach-route-green.txt`.
- [ ] **Step 5: Commit:**
```bash
git add app/api/coach/route.ts app/api/coach/route.test.ts docs/logs/37-coach-route-*.txt
git commit -m "feat: add POST /api/coach route to pass US-R"
```

---

## Task 12: `/coach` page UI

**Files:** Create `app/coach/page.tsx`

**Interfaces:** Calls `POST /api/coach`. Renders question box, answer, Sources list, refusal state.

- [ ] **Step 1:** Build the client page following the existing app's component/styling idioms (Space Grotesk palette, see `app/trips/[id]/page.tsx`): a textarea + Ask button, a loading state, the grounded answer, and a **Sources** list rendering `sources`. When `grounded === false`, render the refusal answer with a distinct "outside the knowledge base" treatment and no Sources block.
- [ ] **Step 2:** Add a nav link to `/coach` from the app header/home so it's demoable (match existing nav).
- [ ] **Step 3:** Manual smoke check is deferred to Task 13 (E2E). Lint must pass: `npm run lint`.
- [ ] **Step 4: Commit:**
```bash
git add app/coach/page.tsx app/layout.tsx app/page.tsx
git commit -m "feat: add /coach jetlag coach page (US-R)"
```

---

## Task 13: E2E regression (Playwright) — grounded + refusal

**Files:** Create `tests/e2e/coach.spec.ts` (match existing E2E spec location/style)

**Interfaces:** Drives the deployed/local app; asserts headline behavior; screenshots to `docs/screenshots/`.

- [ ] **Step 1: Write the spec** (it is a regression test, not just a screenshotter — §8B): navigate to `/coach`; ask a KB-covered question (e.g. "Why is flying east worse for jetlag?"); **assert** the answer renders AND the Sources list contains the expected doc (`eastward-vs-westward.md`); screenshot. Then ask an off-topic question (e.g. "What's the best sushi in Tokyo?"); **assert** the refusal text appears and no Sources block renders; screenshot.
- [ ] **Step 2:** Run the E2E suite locally per the project's existing Playwright command; confirm assertions pass against the lexical path (keyless) at minimum.
- [ ] **Step 3: Commit:**
```bash
git add tests/e2e/coach.spec.ts docs/screenshots
git commit -m "test: add /coach E2E regression (grounded answer + refusal) for US-R"
```

---

## Task 14: README + full-suite coverage capture

**Files:** Modify `README.md`; capture coverage log

- [ ] **Step 1:** Update `README.md`: describe the coach; state plainly which parts are **mocked-and-unit-tested** (retrieval, grounding gate, prompt/parse, orchestrator) and which part is **live-and-demo-only** (query embedding + answer generation); document `npm run embed:kb` to regenerate vectors and the env var for the key (§13).
- [ ] **Step 2:** Run the full suite with coverage: `npm run test:coverage > docs/logs/38-coach-coverage-green.txt 2>&1`; confirm green and that `lib/rag/` pure units + new `lib/ai/` units are at 100% (excluded shells not counted).
- [ ] **Step 3:** Capture a redacted live-call evidence log during the demo (request id / token usage; key redacted) per §13 — demo-day step, not a commit gate.
- [ ] **Step 4: Commit:**
```bash
git add README.md docs/logs/38-coach-coverage-green.txt
git commit -m "docs: document jetlag coach (mocked vs live) + capture passing coverage"
```

---

## Self-Review

**Spec coverage:** Every spec section maps to a task — §3 architecture → Tasks 2–12; §4 data flow + grounding (refusal, prompt constraint, source integrity) → Tasks 5/6/10; §5 retrieval (semantic primary + BM25 fallback + threshold) → Tasks 3/4/5/10; §6 KB → Task 1 (expanded to 10 docs); §7 testing/evidence → every task's logs + Tasks 13/14; §8 deploy → Tasks 8/9/14 + README; §9 scope → Task 0. No gaps.

**Placeholder scan:** No "TBD/TODO/handle edge cases" — each unit lists concrete test cases and exact signatures. The one deferred value (refusal threshold) is a tunable constant assigned during Task 5/10 against fixtures, not a placeholder.

**Type consistency:** `Chunk`/`KbVector`/`ScoredChunk`/`Decision`/`CoachDeps`/`CoachResult` are defined in Task 1/10 and referenced with identical names and shapes throughout. `searchByVector` takes `(queryVec, kbVectors, chunks, k)`, `searchLexical` takes `(query, chunks, k)`, `decideAnswerable` takes `(scored, threshold)`, `answerQuestion` takes `(query, deps)` — consistent across the orchestrator in Task 10.

## Execution note (token-aware)

Token-spending steps are isolated: only **Task 9 Step 2** (running `embed:kb` with a real key) and the **Task 14 Step 3** demo capture require a live key. All unit work (Tasks 0–8, 10–13) runs keyless. Recommended execution order on 6/28: Task 0 → 1 → 2–7 (pure units, fast) → 8 → 10–13 → 9 (vectors, when key available) → 14.
