# TimeShift — Monday Demo Script (5–6 min)

One product, two assignments: the **jetlag planner** (main course project: data layer +
story + live TDD) and the **grounded Jetlag Coach** (the Vibe-Friday RAG deliverable).
The whole talk is timed for ~6 minutes. Stage directions are in **[SCREEN]**, **[POINT]**,
and **[SAY]** blocks. Practice the timing once end-to-end.

---

## ⚠️ Read this first — assignment-fit honesty check

The RAG brief came in two forms. Be ready to name which one this product satisfies:

- **Vibe-Friday RAG (the one we built to):** custom KB (md/txt/json), retrieval, AI-generated
  **grounded** answer, **source display**, stretch = **deployed**. ✅ We satisfy all of it,
  including the deployed stretch (live at timeshift.windwardline.com), plus extras (honest
  refusal, follow-on next-step, verifiable external citations).
- **The "simple Python CLI RAG" brief** (OpenAI SDK + scikit-learn TF-IDF + a `data/` folder,
  Community-College mock docs): **we diverged from this on purpose.** Ours is TypeScript inside
  the Next.js app, not a Python CLI; retrieval is Google embeddings with **TF-IDF cosine as the
  keyless fallback** (so it still works with no API key); generation is the Claude/Gemini path,
  not the OpenAI Responses API.

**If the instructor asks "wasn't this supposed to be a Python CLI?":** say it plainly —
*"The Vibe-Friday brief let us pick the stack and theme, so we built the RAG into the product
itself rather than a throwaway CLI. Same architecture the Python brief teaches — load → chunk →
TF-IDF retrieve → ground the answer to retrieved context → cite sources — just in TypeScript and
deployed. I can walk the TF-IDF retrieval code if you want to see the internals."* Don't claim it
*is* the Python CLI. If they specifically require the Python/OpenAI version, that's a separate
30-line script we'd hand in alongside — flag it now rather than on Monday.

---

## 0. Before you start (have these open in tabs)

1. **Tab A — Live app homepage:** <https://timeshift.windwardline.com>
   (scrolled to the "A worked example — JFK → Tokyo via London" card).
2. **Tab B — Live Coach:** <https://timeshift.windwardline.com/coach>
3. **Editor — three files pinned:** `prisma/schema.prisma`, `lib/db/trips.ts`, `CLAUDE.md`.
4. **A terminal** with Claude Code running, repo at `lib/trips/`.
5. Have the question **"When should I take melatonin?"** ready to paste into the Coach.

---

## 1. The Story (~1 min)

**[SCREEN]** Tab A, the homepage hero + the worked-example timeline.

**[SAY]**
> "TimeShift answers one question every long-haul traveler has: *when will my body actually
> feel like it's the wrong time, and when should I sleep on the plane?* Jet lag is a
> time-zone math problem people get wrong by hand. The user is anyone flying across 3+ zones —
> here it's a New-York-to-Tokyo trip via London."

**[POINT]** the day/night arcs and the highlighted timeline on the worked example.

**[SAY]**
> "We map the itinerary across zones, overlay destination day and night, and recommend the
> in-flight sleep windows. Let me show the core feature."

**[SCREEN]** Click **"Get my jetlag plan"** on the worked-example card. Wait for it.

**[POINT]** the teal **"Computed from your flight"** chip strip (e.g.
`+13.0h eastward shift · sleep … · crosses the Date Line`).

**[SAY]**
> "This is the product's signature: the plan is *computed* from this exact itinerary by our
> temporal engine — the offset shift, the sleep windows, the date-line crossing are real
> numbers, not the model guessing. The AI only narrates facts the engine already proved."

*(This line also sets up the contrast with the Coach later — Plan = computed; Coach = sourced.)*

---

## 2. The Data Layer (~1.5 min)

**[SCREEN]** Editor → `prisma/schema.prisma`.

**[SAY] — schema shape**
> "Five models. `User` owns `Trip`s; a `Trip` owns ordered `FlightSegment`s. `Session` and
> `LoginToken` back passwordless magic-link auth. `FlightQueryCache` memoizes flight-API
> lookups so we don't burn the free-tier quota."

**[POINT]** the `FlightSegment` model, specifically these fields:

> "Here's the one schema decision worth defending: every leg stores `departureTime` and
> `arrivalTime` **in UTC**, and stores the IANA zone — `departureTz` / `arrivalTz` — right
> next to it."

**[SAY] — *why* (this answers "why did you structure it this way?")**
> "Storing UTC alone loses the zone; storing local time alone is ambiguous across DST. Keeping
> the UTC instant **and** the original zone lets us delegate every offset/DST calculation to
> Luxon and never hand-roll a timezone table — that's the project's core bug-avoidance rule."

**[POINT]** the `@@unique([tripId, sequence])` line on `FlightSegment`.

**[SAY] — relationships**
> "Segments are ordered by a `sequence` integer, unique per trip, so the engine always receives
> legs in flight order. That's the relationship that matters: a trip *is* its ordered legs."

**[SCREEN]** Editor → `lib/db/trips.ts`.

**[POINT]** `getTripWithSegments` (the ownership-scoped `include`).

**[SAY] — the query the app runs**
> "The workhorse query: fetch one trip with all its segments ordered by sequence, **scoped to
> the owner's id** in the `where`. Access control lives in the query itself — a non-owner's id
> simply returns nothing, no separate permission check to forget."

**[POINT]** `deleteSegment` (the re-read + `$transaction` resequencing).

**[SAY] — "what's the most complex query?"**
> "The most complex operation is deleting a leg: an ownership-scoped delete, then a transaction
> that re-numbers the remaining legs back to a contiguous 0-based sequence — so the engine still
> gets a clean ordered list. Delete plus transactional re-sequencing in one unit."

---

## 3. The RAG — Jetlag Coach (~1 min)

**[SCREEN]** Tab B — `/coach`.

**[POINT]** the eyebrow **"Sourced jetlag Q&A · not tied to a trip."**

**[SAY] — the two features are distinct on purpose**
> "Second deliverable, and the deliberate contrast: the Plan is *computed for your flight*; the
> Coach is *general questions, answered only from sourced research*. Same product, opposite
> mechanic."

**[SCREEN]** Paste **"When should I take melatonin?"** → **Ask the coach.**

**[POINT]**, in order: the **"✓ Grounded in N cited sources"** badge → the answer → the
**Sources** list (real external links).

**[SAY] — hits every Vibe-Friday requirement**
> "Custom knowledge base of 55 sourced docs, TF-IDF retrieval, an answer **grounded only in the
> retrieved chunks**, and **the actual external sources displayed** — CDC, NHS, Sleep Foundation,
> not internal filenames. The model can't fabricate a citation because the sources come from the
> retrieved documents' own metadata."

**[SCREEN]** (Optional, if time) type **"How do I fix my car engine?"** → **Ask.**

**[POINT]** the **"Outside the knowledge base"** refusal, no sources.

**[SAY]**
> "And it refuses honestly when a question is outside the KB — grounding means it won't bluff."

---

## 4. Live TDD Demo (~2 min)

Small, rehearsed, pure — a new `daysToAdjust()` helper (the ~1-day-per-time-zone recovery
rule of thumb). New file, so it won't disturb the existing green suite. **You type only two
short lines** — the rules file does the rest of the work.

**[SCREEN]** Editor → `CLAUDE.md`, scroll to **§2 "The TDD law."**

**[SAY] — show the control file FIRST**
> "This is the rules file the agent operates under. Section 2 — the TDD law: *no production code
> before a failing test exists.* I control the AI with this, not vibes. Watch it obey."

**[SCREEN]** Terminal with Claude Code. **Type line 1 (RED) — exactly this:**

```text
Per CLAUDE.md §2: failing test only, no code. New pure fn daysToAdjust(min) in lib/trips/jetlag-burden.ts: 780→13, -600→10. Run it.
```

**[POINT]** the failing run (red — "cannot find module" / failing import).

**[SAY]**
> "Red. It fails for the right reason — the function doesn't exist yet. That's the proof the test
> is real."

**[Type line 2 (GREEN) — exactly this:]**

```text
Now minimal code to pass. Run it.
```

**[POINT]** the green run.

**[SAY] — answers "why test first?" + "how does the agent fit?"**
> "Green, minimal code. Writing the test first means I defined *correct* before I wrote any code,
> so the test can actually fail and actually prove the fix. The CLI agent is the implementer
> inside that loop — it writes the red test, I confirm it fails for the right reason, it writes
> the green code, the suite stays the source of truth. The rules file keeps it disciplined."

*(Expected green file, for your reference — don't read it aloud:)*

```ts
// lib/trips/jetlag-burden.ts
export function daysToAdjust(offsetDeltaMinutes: number): number {
  // Rule of thumb: the body realigns ~1 time zone per day.
  return Math.round(Math.abs(offsetDeltaMinutes) / 60);
}
```

**If you'd rather not type even that much:** keep a sticky note with just the two lines above,
or shorten line 1 further to `failing test only for daysToAdjust(min): 780→13, -600→10` — the
agent already has the TDD law from CLAUDE.md and will scaffold the file path itself.

---

## 5. Close (~15s)

**[SAY]**
> "So: a UTC-plus-zone schema that delegates all the hard time math to Luxon, an engine that
> *computes* a jet-lag plan, a RAG coach that *sources* its answers, and a TDD loop the rules
> file keeps honest. Happy to dig into any of it."

---

## Cheat sheet — the six questions, one-liners

| Question | Your answer |
| --- | --- |
| Why this schema? | UTC instant **+** IANA zone on every leg → delegate all offset/DST to Luxon, never hand-roll tz tables. |
| What relationships & why? | `User → Trip → FlightSegment`, segments unique-ordered by `sequence` so the engine gets legs in flight order. |
| Most complex query? | `deleteSegment`: ownership-scoped delete + a `$transaction` re-numbering the remaining legs to a contiguous 0-based sequence. |
| Who's the user / one problem? | Long-haul travelers; "when will I be jet-lagged and when should I sleep on the plane?" |
| Why test before code? | A test written after the code can't fail; writing it first defines *correct* and proves the fix is real. |
| How does the CLI agent fit? | It's the implementer inside Red→Green→Refactor; CLAUDE.md §2 forbids it writing code before a failing test exists. |

## Timing budget

Story 1:00 · Data layer 1:30 · RAG 1:00 · Live TDD 2:00 · Close 0:15 → **~5:45.**
If you're long, drop the Coach refusal step (§3 optional) and the second TDD assertion.
