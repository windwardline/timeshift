# User Stories — TimeShift

Format: **As a** [role], **I want** [capability], **so that** [benefit].
Priority uses MoSCoW (**M**ust / **S**hould / **C**ould) scoped to a 5-day sprint.
Story IDs are referenced by the Acceptance Criteria and the TDD Plan.

The only role in scope is **Traveler** (an authenticated end user planning a trip).

---

## Epic A — Authentication & Profile

**US-A1 · (M)** As a traveler, I want to register with an email and password, so that
my trips are saved to a personal account.

**US-A2 · (M)** As a traveler, I want to log in and log out, so that my data is private
to me across sessions.

**US-A3 · (M)** As a traveler, I want to set my home time zone on my profile, so that
the app has a baseline for my biological clock.

---

## Epic B — Trip Management

**US-B1 · (M)** As a traveler, I want to create a trip with a name and a destination
time zone, so that I have a container for the journey's flight segments.

**US-B2 · (M)** As a traveler, I want to see a list of my trips, so that I can choose
one to view or edit.

**US-B3 · (S)** As a traveler, I want to rename or delete a trip, so that I can keep my
list accurate.

**US-B4 · (M)** As a traveler, I want a trip to only ever be visible to me, so that
another user cannot read or modify my journey.

---

## Epic C — Flight Segment Entry

**US-C1 · (M)** As a traveler, I want to add a flight segment with departure/arrival
airports, departure/arrival timestamps, and their time zones, so that the journey
can be computed accurately.

**US-C2 · (M)** As a traveler, I want segments to be ordered in sequence, so that the
timeline reflects the real order of travel including layovers.

**US-C3 · (S)** As a traveler, I want to edit or delete a flight segment, so that I can
correct mistakes without recreating the trip.

**US-C4 · (C)** As a traveler, I want each segment to optionally store geo-coordinates,
so that sunrise/sunset arcs can be computed precisely for that location.

---

## Epic D — Timeline Visualization (core)

**US-D1 · (M)** As a traveler, I want to see my journey as a single horizontal timeline,
so that I can understand the whole trip across time zones at a glance.

**US-D2 · (M)** As a traveler, I want the timeline to render color-coded day and night
arcs at the destination, so that I can see local daylight versus darkness.

**US-D3 · (S)** As a traveler, I want layovers shown as distinct blocks on the timeline,
so that I can see ground time between flights.

---

## Epic E — Temporal Engine & Jetlag Logic (TDD priority)

**US-E1 · (M)** As a traveler, I want arrival times computed with correct UTC offsets
and daylight-saving transitions, so that the schedule is never off by an hour.

**US-E2 · (M)** As a traveler, I want date arithmetic to be correct across leap days,
so that a trip spanning February 29 doesn't shift.

**US-E3 · (M)** As a traveler, I want International Date Line crossings handled correctly,
so that the timeline doesn't show impossible "arrive before you depart" results.

**US-E4 · (M)** As a traveler, I want the app to recommend when to sleep on the plane,
so that my body clock is closer to destination time on arrival.

---

## Epic R — Grounded Jetlag Coach (RAG)

**US-R · (S)** As a traveler, I can ask a jetlag/sleep question and get an answer
grounded only in TimeShift's curated knowledge base, with its sources shown, and an
honest refusal when my question is outside that knowledge.

---

## Out of scope for this sprint (logged, not built)

- Real-time flight data / airline API integration
- Multi-traveler shared trips and collaboration
- Push notifications / reminders
- Native mobile app
- Social or sharing features
