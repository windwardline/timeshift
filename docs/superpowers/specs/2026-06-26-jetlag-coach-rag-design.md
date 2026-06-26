# Design — TimeShift Jetlag Coach (Grounded RAG)

Date: 2026-06-26
Status: Approved design, pending spec review
Story: US-R — Grounded Jetlag Coach (to be added to `docs/USER_STORIES.md` before any Red test)

## 1. Purpose

Add a grounded question-answering assistant to TimeShift that satisfies a separate
"Vibe RAG" demo rubric **and** every existing TimeShift guardrail. The traveler asks a
jetlag/sleep question; the system retrieves from a curated knowledge base, an LLM answers
**only** from the retrieved text, the sources are displayed, and off-topic questions are
**refused** rather than guessed.

Domain = circadian / jetlag / sleep science, so the feature doubles as TimeShift's
"how do I beat this jetlag" coach. This is the rubric's "health/wellness boundary" theme.

### Rubric mapping

| Rubric requirement            | How this design meets it                                        |
| ----------------------------- | --------------------------------------------------------------- |
| Custom knowledge base (md/json) | Hand-authored `docs/kb/*.md` + committed `kb-embeddings.json`  |
| Retrieval                     | Semantic (cosine over embeddings), BM25 fallback                |
| AI-generated answer           | `@google/genai` generation through the existing `lib/ai/` boundary |
| Grounded answer (only context) | Pre-LLM refusal threshold + prompt constraint + source = chunks passed in |
| Source display                | `/coach` page lists the doc ids of the chunks actually used     |
| Stretch: Deployed             | Ships on the existing Vercel app; needs the GenAI key env var   |

## 2. Guardrail alignment (why this fits TimeShift)

- **§2 TDD law / §4 engine purity:** `lib/rag/` is pure like `lib/engine/` — no fetch,
  no DB, no framework imports in the tested units. Retrieval scoring is a pure function.
- **§13 AI boundary:** the only network calls are (a) embedding the user's query and
  (b) generating the answer. Both are isolated in thin shells (`embed.ts`, `client.ts`),
  excluded from coverage, and **mocked** in tests. The suite passes **keyless**.
- **§9 scope:** new scope, so US-R + acceptance criteria are committed as a `docs:` change
  (per §12) before the first Red test.

## 3. Architecture

```
docs/kb/*.md                 ← the custom knowledge base (hand-authored)
docs/kb/kb-embeddings.json   ← committed build artifact: chunk vectors (regenerable)

lib/rag/   (PURE units held at 100% coverage, like lib/engine/)
  chunk.ts      chunkMarkdown(raw, docId): Chunk[]                  — pure
  search.ts     searchByVector(queryVec, kbVectors): ScoredChunk[] — pure cosine + top-k
  lexical.ts    searchLexical(query, chunks): ScoredChunk[]        — pure BM25-lite (fallback)
  ground.ts     decideAnswerable(scored, threshold): Decision      — pure refusal gate
  corpus.ts     loadCorpus(): { chunks, vectors }                  — I/O shell (fs), excluded
  embed.ts      embedQuery(text): number[] | null                  — network shell, excluded

lib/ai/    (extends the existing boundary)
  prompt.ts     + buildGroundedPrompt(query, contextChunks)        — pure
  parse.ts      + parseGroundedResponse(raw): { answer }           — pure
  coach.ts      answerQuestion(query, deps): CoachResult           — orchestrator (deps mocked)
  client.ts     unchanged — still the only generation network call

scripts/embed-kb.ts            build-time: embeds every chunk -> docs/kb/kb-embeddings.json
app/api/coach/route.ts         server-only; reads key server-side; returns { answer, sources, grounded }
app/coach/page.tsx             question box -> grounded answer -> Sources list
```

`corpus.ts` and `embed.ts` are the RAG analogues of `client.ts`: the single I/O shells,
explicitly marked as the coverage exclusions for `lib/rag/`.

## 4. Data flow

```
question
  -> POST /api/coach
  -> embedQuery(question)              [live: Google GenAI embeddings; null if no key]
  -> if vector present:  searchByVector(vector, kbVectors)     [semantic, primary]
     else:               searchLexical(question, chunks)        [BM25, degraded — keyless/deploy]
  -> decideAnswerable(scored, threshold)
       ├─ below threshold -> REFUSE (no LLM call):
       │     "That's outside my jetlag knowledge base."
       └─ above threshold -> buildGroundedPrompt(question, topChunks)
                          -> client (LIVE generation) -> parseGroundedResponse
                          -> { answer, sources: [doc ids of chunks used], grounded: true }
```

### Grounding is enforced three ways

1. **Pre-LLM refusal** — if nothing clears the relevance threshold, the system answers
   "outside my knowledge base" with **no** generation call. (Pure, tested unit.)
2. **Prompt constraint** — `buildGroundedPrompt` instructs the model to answer only from
   the provided context and to say so when the context does not cover the question.
3. **Source integrity** — `sources` are the doc ids of the chunks actually passed to the
   model, so the UI can never cite a document the model did not receive.

## 5. Retrieval detail

- **Embeddings (primary):** `@google/genai` embedding model (e.g. `text-embedding-004` /
  `gemini-embedding-001` — exact id verified against current docs via context7 at build
  time). KB chunk vectors are precomputed by `scripts/embed-kb.ts` and **committed** to
  `docs/kb/kb-embeddings.json`, so KB load needs no network and stays deterministic.
- **Search:** `searchByVector` = cosine similarity over the committed vectors, ranked,
  top-k above a threshold. Pure; unit-tested with fixed vector fixtures.
- **Fallback (BM25-lite):** when `embedQuery` returns `null` (no key / embedder offline),
  `searchLexical` provides keyword retrieval so the deployed app and keyless runs never
  hard-fail. Semantic is the real retrieval; lexical is graceful degradation, mirroring the
  existing flight feature's no-key behavior.
- **Refusal threshold:** its own pure, tested unit (`decideAnswerable`). Thresholds differ
  per retrieval mode and are documented in the test fixtures.

## 6. Knowledge base

Hand-authored markdown under `docs/kb/`, chunked by heading. Initial doc set (subject to
refinement during authoring):

- `circadian-basics.md` — body clock, phase, the science of jetlag
- `light-exposure.md` — light timing / avoidance to shift the clock
- `melatonin-timing.md` — dose timing, eastward vs westward use
- `eastward-vs-westward.md` — why direction changes difficulty + strategy
- `napping-strategy.md` — strategic naps vs. sleep debt
- `caffeine-and-alcohol.md` — timing, what to avoid
- `pre-flight-adjustment.md` — shifting schedule before departure
- `arrival-day-plan.md` — first-24-hours playbook

## 7. Testing & evidence (§2 / §8 / §13)

- **Red -> Green logs** captured to `docs/logs/NN-*-red.txt` / `-green.txt` for every new
  pure unit: `chunkMarkdown`, `searchByVector`, `searchLexical`, `decideAnswerable`,
  `buildGroundedPrompt`, `parseGroundedResponse`, and `answerQuestion` (with a **mocked**
  embedder + **mocked** client returning fixtures).
- **Coverage:** `lib/rag/` pure units + the new `lib/ai/` units held at 100%. `corpus.ts`
  and `embed.ts` are the explicit exclusions (alongside `client.ts`).
- **Keyless:** the whole unit suite passes with no API key — KB vectors are committed
  fixtures, the query embedder is mocked, and the refusal path needs no LLM. The BM25
  fallback also runs keyless.
- **E2E (Playwright):** extend the existing spec to drive `/coach` and assert (a) a grounded
  answer renders the expected Sources doc, and (b) an off-topic question renders the refusal.
  Screenshot to `docs/screenshots/`. The existing timeline regression is untouched because
  `/coach` is a standalone page.
- **Live call:** demo-only; capture a redacted server-side request log (request id / token
  usage; key redacted) as evidence. The README states plainly which parts are
  mocked-and-unit-tested and which part is live-and-demo-only.

## 8. Deployment (stretch)

`/coach` ships with the existing Vercel app. Live semantic retrieval + generation require
the GenAI key set as a Vercel env var (documented in `.env.example` with no value). Without
it, `/coach` degrades to BM25 retrieval and refuses generation cleanly — it never 500s.

## 9. Out of scope (this sprint)

- Embeddings re-ranking, query expansion, or multi-hop retrieval.
- User-uploaded knowledge bases / runtime KB editing.
- Conversation memory / multi-turn chat (single question -> single grounded answer).
- PDF ingestion (markdown + json only).

## 10. Open items to confirm at build time

- Exact Google GenAI embedding model id + vector dimension (verify via context7).
- Final refusal threshold values per mode (tuned against KB fixtures during TDD).
