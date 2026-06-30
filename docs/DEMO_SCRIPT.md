# TimeShift — Demo Script (~6 min, Tuesday AM)

One product, **two assignments**: the main course project (data layer + story + live TDD) and
the Vibe-Friday RAG build-out (the grounded **Jetlag Coach**). Both instructor briefs are saved
verbatim in [`docs/INSTRUCTOR_BRIEF.md`](./INSTRUCTOR_BRIEF.md); this script is written to satisfy
every bullet in both. Stage directions: **[SCREEN]** = what to show, **[POINT]** = exact lines /
elements to indicate, **[SAY]** = your words. Practice once end-to-end for timing.

> **Live state (verified):** deployed at <https://timeshift.windwardline.com>. Home shows **two**
> worked examples — **JFK → Singapore via London** (+12.0h, the everyday case) and **Los Angeles
> → Sydney** (+17.0h, which **crosses the date line**). Flight search is live (real AviationStack
> data, cached). The Coach is live (Gemini) with a grounded extractive fallback. Suite green;
> engine + deterministic AI at 100% coverage.

**Order:** Story → Data Layer → RAG → Live TDD. (The brief allows Story-first; it makes a better
hook. Data Layer is still the longest segment, per the rubric.)

---

## ⚠️ Read this first — assignment-fit honesty check (Vibe RAG)

The RAG brief came in two forms. Be ready to name which one this satisfies:

- **Vibe-Friday RAG (what we built to):** custom KB, retrieval, AI-generated **grounded** answer,
  **source display**, stretch = **deployed**. ✅ All satisfied — theme is *health/wellness → sleep
  routine* — plus extras (honest refusal, follow-on next-step, verifiable external citations).
- **A "simple Python CLI RAG":** we diverged on purpose — ours is TypeScript inside the Next.js
  app, retrieval is Google embeddings with **TF-IDF cosine as the keyless fallback**, generation
  is the Gemini path. **If asked "wasn't this a Python CLI?":** *"The Vibe brief let us pick the
  stack, so we built the RAG into the product, not a throwaway CLI. Same architecture the Python
  brief teaches — load → chunk → TF-IDF retrieve → ground to retrieved context → cite sources —
  in TypeScript and deployed."* Don't claim it *is* the Python CLI.

---

## 0. Before you start (open these tabs)

1. **Tab A — homepage:** <https://timeshift.windwardline.com> (the two worked-example cards).
2. **Tab B — Coach:** <https://timeshift.windwardline.com/coach>
3. **Editor — pin three files:** `prisma/schema.prisma`, `lib/db/trips.ts`, `CLAUDE.md`.
4. **Terminal** with Claude Code running, cwd at the repo root.
5. The Coach has clickable example chips — you'll just click **"When should I take melatonin?"**.

---

## 1. The Story (~1:15)  ·  *brief: problem / user / demo core features*

**[SCREEN]** Tab A — hero + the first worked example (Singapore).

**[SAY] — problem + user**
> "TimeShift answers the one question every long-haul traveler has: *when will my body feel like
> it's the wrong time, and when should I sleep on the plane?* Jet lag is a time-zone math problem
> people get wrong by hand. The user is anyone flying across 3+ zones — here, New York to
> Singapore via London."

**[POINT]** the day/night arcs and the timeline on the Singapore card.

**[SAY] — demo the core feature**
> "We lay the itinerary across time zones, overlay destination day and night, and recommend the
> in-flight sleep windows."

**[SCREEN]** On the Singapore card, click **"Get my jetlag plan"** (button shows **"Consulting…"**
— it's a live AI call; no sign-in needed, the showcase is public).

**[POINT]** the **"Computed from your flight"** chip strip (e.g. `+12.0h eastward shift` + a
sleep-window chip), then the **"AI-generated"** badge.

**[SAY] — the signature mechanic**
> "This is the product's signature: the plan is *computed* from this exact itinerary by our
> temporal engine — the shift and the sleep windows are real numbers, not the model guessing. The
> AI only narrates facts the engine already proved."

**[SCREEN]** Scroll to the **second** card — **"Crossing the date line — Los Angeles → Sydney."**

**[POINT]** the **"crosses the date line"** pill in the header.

**[SAY] — the edge case, made visible**
> "And this is the case people get wrong by hand: LA→Sydney you skip a whole calendar day. The
> engine *detects* the date-line crossing and flags it — `+17.0h` here. Keep that in mind; it's
> the behavior I'll point back to in the TDD demo."

---

## 2. The Data Layer (~1:45)  ·  *brief: schema / relationships / queries*

**[SCREEN]** Editor → `prisma/schema.prisma`.

**[SAY] — schema (answers "why this schema?")**
> "Six models. `User` owns `Trip`s; a `Trip` owns ordered `FlightSegment`s. `Session` and
> `LoginToken` back passwordless magic-link auth, and `FlightQueryCache` memoizes real flight-API
> lookups so we don't burn the free-tier quota — that one's live behind the app's flight search."

**[POINT]** `prisma/schema.prisma` **lines 66–69** (`departureTime`, `arrivalTime`, `departureTz`,
`arrivalTz` on `FlightSegment`).

**[SAY] — the decision worth defending**
> "Every leg stores its times **in UTC** *and* the IANA zone right beside them. UTC alone loses
> the zone; local time alone is ambiguous across DST. Keeping both lets us delegate every
> offset/DST calculation to Luxon and never hand-roll a timezone table — the project's core
> bug-avoidance rule."

**[POINT]** `prisma/schema.prisma` **line 75** — `@@unique([tripId, sequence])`.

**[SAY] — relationships (answers "what relationships & why?")**
> "`User → Trip → FlightSegment`. Segments are ordered by a `sequence` integer that's unique per
> trip, so the engine always receives legs in flight order — a trip *is* its ordered legs.
> Layovers aren't a table; they're *derived* as the gaps between consecutive legs, so there's no
> redundant state to keep in sync."

**[SCREEN]** Editor → `lib/db/trips.ts`.

**[POINT]** **lines 59–64** (`getTripWithSegments`) — specifically **line 61**, `where: { id, userId }`.

**[SAY] — the query the app runs**
> "The workhorse query: one trip with all its segments ordered by sequence, **scoped to the
> owner's id** in the `where`. Access control lives in the query itself — pass a non-owner's id
> and it simply returns nothing. This ordered join is the single input the whole engine runs on."

**[POINT]** **lines 106–121** (`deleteSegment`) — the scoped delete at **line 108**
(`trip: { userId }`) and the **`$transaction`** at **lines 117–119**.

**[SAY] — answers "most complex query?"**
> "The most complex operation is deleting a leg: an ownership-scoped delete, then a transaction
> that re-numbers the remaining legs back to a contiguous 0-based sequence — so the engine still
> gets a clean ordered list. A scoped delete plus transactional re-sequencing in one unit."

---

## 3. The RAG — Jetlag Coach (~0:50)  ·  *Assignment 2: all Vibe requirements*

**[SCREEN]** Tab B — `/coach`.

**[POINT]** the eyebrow **"Sourced jetlag Q&A · not tied to a trip."**

**[SAY] — the deliberate contrast**
> "Second deliverable. The Plan is *computed for your flight*; the Coach is *general questions,
> answered only from sourced research*. Same product, opposite mechanic. Theme: health/wellness —
> a sleep-and-jetlag knowledge base."

**[SCREEN]** Click the chip **"When should I take melatonin?"** → it runs.

**[POINT]**, in order: the **"✓ Grounded in N cited sources"** badge → the **Answer** → the
**Next step** card → the **Sources** list (real external links, new tab).

**[SAY] — tick every Vibe requirement out loud**
> "**Custom knowledge base** — 55 sourced markdown docs. **Retrieval** — semantic search with a
> TF-IDF fallback. An **AI-generated answer grounded only in the retrieved chunks**, plus a
> next-step. And **the real external sources displayed** — CDC, NHS, Sleep Foundation, not
> internal filenames — because the citations come from the retrieved docs' own metadata, so the
> model can't fabricate one. And it's **deployed** — that's the stretch goal."

**[SCREEN]** (Optional, if time) type **"How do I fix my car engine?"** → **Ask.**

**[POINT]** the **"Outside the knowledge base"** refusal, no sources.

**[SAY]**
> "And it refuses honestly when a question is outside the KB — grounding means it won't bluff."

---

## 4. Live TDD Demo (~1:30)  ·  *brief: one small rehearsed feature, test-first*

Deliberately the smallest possible: one pure function, **two short prompts, one assertion**. New
file, so it can't disturb the green suite. Show the rules file first, then let the agent run it.

**[SCREEN]** Editor → `CLAUDE.md`, **line 18** (`## 2. The TDD law (highest priority)`).

**[SAY] — show the control file FIRST (the brief asks for this)**
> "This is the rules file the agent operates under. Section 2 — the TDD law: *no production code
> before a failing test exists.* I control the AI with this, not vibes. Watch it obey."

**[SCREEN]** Terminal. **Type prompt 1 (RED) — exactly this:**

```text
Per CLAUDE.md §2, write ONLY a failing test (no implementation) for a new pure function daysToAdjust(min) in lib/trips/jetlag-burden.ts. Assert daysToAdjust(780) === 13 (~1 recovery day per time zone). Run it.
```

**[POINT]** the failing run — red, `daysToAdjust` is not defined / cannot find module.

**[SAY]**
> "Red. It fails for the right reason — the function doesn't exist yet. That's the proof the test
> is real."

**[Type prompt 2 (GREEN) — exactly this:]**

```text
Now write the minimal code to pass. Run it.
```

**[POINT]** the green run.

**[SAY] — answers "why test first?" + "how does the agent fit?"**
> "Green, minimal code. Writing the test first means I defined *correct* before any code existed,
> so the test could actually fail and actually prove the fix — the same discipline that made the
> date-line case real earlier. The CLI agent is the implementer inside that loop; CLAUDE.md §2 is
> what stops it from writing code before a failing test exists."

*(Expected green file — for your reference, don't read aloud. No branches, so it stays 100%
coverage-clean if you keep it.)*

```ts
// lib/trips/jetlag-burden.ts
export function daysToAdjust(offsetDeltaMinutes: number): number {
  // Rule of thumb: the body realigns ~1 time zone per day.
  return Math.round(Math.abs(offsetDeltaMinutes) / 60);
}
```

**Easiest-possible fallback:** keep a sticky note with just the two prompts. The agent already has
the TDD law from CLAUDE.md and scaffolds the file path itself. (Throwaway demo unit — discard
after, or keep it as a real helper. In a real cycle the rules also have me capture the red/green
logs and commit each; skipped live to stay under 2 minutes.)

---

## 5. Close (~15s)

**[SAY]**
> "So: a UTC-plus-zone schema that delegates all the hard time math to Luxon, an engine that
> *computes* a jet-lag plan and flags the date-line edge case, a RAG coach that *sources* its
> answers, and a TDD loop the rules file keeps honest. Happy to dig into any of it."

---

## Cheat sheet — the six questions, one-liners

| Question | Your answer |
| --- | --- |
| Why this schema? | UTC instant **+** IANA zone on every leg → delegate all offset/DST to Luxon, never hand-roll tz tables. |
| What relationships & why? | `User → Trip → FlightSegment`; segments unique-ordered by `sequence` so the engine gets legs in order; layovers are *derived*, not stored. |
| Most complex query? | `deleteSegment` (`lib/db/trips.ts:106`): ownership-scoped delete + a `$transaction` re-numbering remaining legs to a contiguous 0-based sequence. |
| Who's the user / one problem? | Long-haul travelers; "when will I be jet-lagged and when should I sleep on the plane?" |
| Why test before code? | A test written after the code can't fail; writing it first defines *correct* and proves the fix is real (e.g. the date-line negative test). |
| How does the CLI agent fit? | It's the implementer inside Red→Green→Refactor; `CLAUDE.md` §2 (line 18) forbids it writing code before a failing test exists. |

## File/line quick-reference (so you never fumble)

| Show | File:line |
| --- | --- |
| UTC + IANA tz fields | `prisma/schema.prisma:66–69` |
| Ordered-unique constraint | `prisma/schema.prisma:75` |
| Ownership-scoped query | `lib/db/trips.ts:59–64` (the `where` is line 61) |
| Most complex query | `lib/db/trips.ts:106–121` (delete line 108, `$transaction` 117–119) |
| TDD law (rules file) | `CLAUDE.md:18` (also §4 line 45, §7 line 68, §13 line 144) |

## Timing budget

Story 1:15 · Data layer 1:45 · RAG 0:50 · Live TDD 1:30 · Close 0:15 → **~5:35.**
If long: drop the date-line scroll (§1) and the Coach refusal (§3). If short: generate the
LA→Sydney plan to show the `crosses the Date Line` chip.
