# Instructor Briefs — both assignments (verbatim)

This project **combines two assignments**: the main course project (data layer + story +
live TDD) and the Vibe-Friday RAG build-out (the Jetlag Coach). Both instructor briefs are
reproduced verbatim below so they don't need to be re-supplied. The demo script
(`docs/DEMO_SCRIPT.md`) is written to satisfy both.

---

## Assignment 1 — Main project presentation (verbatim)

> Aim for 5-6 mins.
>
> **The Data Layer (~2min)**
> Walk us through your perspective of the database:
> - whats your schema
> - how do the tables relate
> - what kind of queries does your app run against it
>
> **The Story (~1.5 mins)**
> Give us the why behind the product (you can swap these btw, do story first and data layer second too)
> - what problem does it solve?
> - who does it help?
> - show how it helps by demoing the core features/basic functionality
>
> **Live TDD Demo (~2 mins) Keep it small**
> - Code one small feature (rehearsed) live using your CLI coding agent.
> - Write the prompt to write a failing test first, then make it pass
> - The point is to show your TDD flow, not to build something fancy
> - pick something small enough to finish in 2 mins.
>
> Demonstrate a clear understanding of your product and your database, plus a clean TDD
> development flow. Show us your rules or context file that has the rules in there that you
> control. You want to show the level of control you have over the AI
>
> **Questions you should be able to answer:**
> - Why did you structure your schema this way?
> - What relationships exist between your tables and why?
> - Whats the most complex query your app handles?
> - Who is your user and whats the one problem you're solving for them?
> - Why write the test before the code?
> - How does your CLI coding agent fit into the workflow?
>
> Keep it focused and practice your timing!

---

## Assignment 2 — Vibe Friday RAG build-out (verbatim)

> we will do a Vibe Friday RAG build out today.
>
> **Vibe Requirements**
> - Custom knowledge base
>   - in md , txt, json, pds etc
> - Retrieval
> - AI Generated answer
> - Grounded Answer (answer must be based only on retrieved context
> - Source display
> - Stretch: Deployed
>
> **Suggested Project Themes**
> - The Survival Guide — survive the jungle / survive freshman year / survive moving to a new
>   city / survive being a new parent / survive a zombie outbreak / etc.
> - The Fictional world lore — who are the main characters? factions? what powers are forbidden?
>   what happened in the old war? etc.
> - Ask my business — ridiculous coffee shop handbook / the dog adopting and loving policy / auto
>   repair shop that talks in riddles / daycare parent handbook / restaurant related / etc.
> - Personal Knowledge — your story / your projects / your family / etc.
> - The Mystery / Detective — witness statements, timelines, evidence logs / solve a mystery / a
>   digital escape room type
> - The health/wellness boundary — diets and lifestyle / how to X guide / meal prep guide /
>   sleep routine
> - The Beginner Guide — how to play an instrument / guide to coffee brewing / first pet / board
>   games / etc.

---

## How TimeShift maps to each requirement

**Assignment 1**

| Requirement | Where it's satisfied |
| --- | --- |
| Schema | `prisma/schema.prisma` — 6 models (User, Trip, FlightSegment, Session, LoginToken, FlightQueryCache). |
| Table relationships | `User 1→* Trip 1→* FlightSegment`; segments ordered & unique by `sequence`; layovers derived, not stored. |
| Queries the app runs | `lib/db/trips.ts` — `getTripWithSegments` (ordered, ownership-scoped) feeds the engine; `deleteSegment` (scoped delete + `$transaction` resequencing) is the most complex. |
| Story / problem / user | Long-haul jetlag: "when will I be jet-lagged and when should I sleep on the plane?" Demoed via the live timeline + computed plan. |
| Live TDD | New pure `daysToAdjust()` — failing test first → red → minimal green, driven by the CLI agent under `CLAUDE.md` §2. |
| Rules/context file you control | `CLAUDE.md` (§2 TDD law, §4 time-handling, §7 git workflow, §13 AI boundary). |

**Assignment 2 (Vibe RAG → the Jetlag Coach, `/coach`)** — theme: *health/wellness → sleep routine.*

| Requirement | Where it's satisfied |
| --- | --- |
| Custom knowledge base (md) | 55 sourced jetlag/sleep docs in `docs/kb/` (markdown). |
| Retrieval | Google-embedding semantic search, with TF-IDF cosine as the keyless fallback. |
| AI-generated answer | Live Gemini call (with a grounded extractive fallback if the model call fails). |
| Grounded (only from retrieved context) | Prompt is built only from retrieved chunks; honest refusal when nothing clears the threshold. |
| Source display | Verifiable external links (CDC, NHS, Sleep Foundation) from the chunks' own metadata. |
| Stretch: Deployed | Live at <https://timeshift.windwardline.com/coach>. |
