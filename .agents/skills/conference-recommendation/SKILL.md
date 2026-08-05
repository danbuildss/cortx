---
name: "conference-recommendation"
title: Conference recommendation
description: "Recommends which conferences, trade shows, and vendor events a company should attend, exhibit at, or sponsor next. Use when the user needs to pick events for a field-sales or field-marketing motion, build a scored shortlist against ICP, justify event spend, or plan a conference calendar. Scores each event on ICP relevance, decision-maker accessibility, and buying mindset — and returns a ranked, tiered list, not a pile of famous names."
category: Events
---

*Setup state.* Not yet configured for this org. Load the Readme sub-page and walk the user through locking their ICP (buyer roles, target verticals, ACV range, sales-cycle length), geographic scope, B2B/B2C classification, and any events to force-include or force-exclude before scoring anything. (After setup completes, rewrite this paragraph to capture the locked profile — buyer roles, verticals, ACV band, geo scope, classification, exclusions, and last-refreshed date — so future runs proceed without re-asking.)

This skill scores the *front-end decision* — which events to invest in. It is the mirror image of an attendee-radar skill, which acts on attendees after an event. Run this one first; feed its picks into your calendar, then let the attendee-radar work the lists post-event.

---

### The scoring frame

Every event is scored on a *100-point base* across three dimensions, plus a *+10 bonus* for organizer-run matchmaking (Total Score out of 110).

| Dimension | Weight | What it measures |
| --- | --- | --- |
| *Relevance* | 40 | How closely the attendee/exhibitor composition matches the client's ICP. |
| *Decision-maker accessibility* | 40 | Density of actual buyers AND structural reach to them (floor layout, meeting infrastructure, side events). |
| *Engagement mode* | 20 | Are attendees in a vendor-buying mindset, or is it a learning/keynote-driven crowd? |

*Tiers:*

| Tier | Score | Meaning |
| --- | --- | --- |
| *P1* | ≥ 80 | Must-attend. Book it. |
| *P2* | 70–79 | Strong. Attend if budget/calendar allows. |
| *P3* | < 70 | Excluded from the ranked list. No padding, no filler. |

Do not pad the list to hit a target count. A short list of P1/P2 events beats a long list diluted with P3s.

---

### Step 0 — Lock the classification (do this first, never infer it)

Where buyers physically stand at an event depends entirely on what the client sells. Get this wrong and every downstream score is measuring the wrong crowd.

| Classification | Where the buyers are | Scoring orientation |
| --- | --- | --- |
| B2C (general) | In the audience | Audience-driven |
| B2C with booth-density exception (e.g. consumer brand selling to other exhibitors) | At exhibitor booths | Booth-driven |
| B2B selling to marketing / growth / sales | Behind the booths (every booth is staffed by the buyer) | Booth-driven |
| B2B selling to non-marketing functions (CISO, CIO, CFO, engineering) | In the audience / session tracks | Audience-driven |

Ask the user which row fits. Do not guess. The booth-driven insight — that at most B2B events every booth is staffed by a marketing or sales buyer — is the core reason a booth-to-booth motion works, and it flips which side of the floor you're scoring.

### Step 1 — Confirm the intake

Before any discovery, lock these. Org knowledge may already hold some; confirm the rest with the user:

- Client name + website (seeds mandatory research)
- Buyer roles, target verticals, ACV range, sales-cycle length
- Geographic scope (always ask)
- Time window (default: next 12 months)
- Events to force-include or force-exclude (already attended, known duds, organic disqualifiers)
- Max events to return (default cap: 15)

*Budget is noted but NOT scored.* A cheap event that reaches the wrong buyers is worse than an expensive one that reaches the right ones. Surface cost as context for the user's final call; never let it move a score.

*HARD STOP:* do not begin discovery or scoring until classification (Step 0) and intake (Step 1) are both confirmed.

### Step 2 — Discover with breadth (the single biggest failure mode lives here)

The default failure is *pattern-matching to famous conferences* — Dreamforce, Web Summit, RSA, CES, INBOUND, Money20/20 — regardless of whether they fit this client. Famous-event bias produces lists that look identical across wildly different clients. They should not.

Use active web search (do NOT rely on model recall) to cover *all six categories*. For a 15-event candidate set, aim for at least 2 from each:

1. *Industry flagship* — the obvious big name. Often right, not always.
2. *Vertical-specific summit* — narrower events dense with the exact buyer role (PMM Summit, RevOps Co-op, Pavilion CRO Summit, Customer Success Festival, MartechFest). Frequently higher buyer density than the flagship.
3. *Regional flagship* — the leading event in a target geo (OMR Hamburg, iMedia regional summits, Web Summit Rio, Mumbrella). Often beats globals on buyer-density-per-dollar for geographically concentrated clients.
4. *Free vendor conference* — one-day AWS / Snowflake / HubSpot / Salesforce / Databricks / ServiceNow city events. Packed with budget owners, free to attend, and the most under-utilized circuit in B2B field sales. Most lists skip these; they shouldn't.
5. *Emerging event (years 1–3)* — newer, not yet diluted by tourist attendees, often higher density per head.
6. *Side event / unofficial gathering* — dinners, breakfasts, executive meetups, after-parties around the majors. Frequently higher density than the main floor. Requires active search — training data won't surface these.

If a category comes back genuinely empty for this client, document why ("no free vendor conferences serve this niche vertical") rather than silently dropping it.

### Step 3 — Famous-event audit

For every marquee event still on the list — anything you could name without searching — write one line justifying why this specific event beats a more targeted alternative for THIS client's ICP, referencing the locked buyer profile. If you can't justify it, replace it with the targeted alternative. A flagship that survives the audit stays; a flagship that's there out of habit goes.

### Step 4 — Score each candidate

Apply the 40/40/20 rubric per the classification locked in Step 0. Booth-driven clients score density and reach at the booths; audience-driven clients score it in the audience. Reason from research and the client's ICP; show the three sub-scores, not just the total.

### Step 5 — Apply the +10 matchmaking bonus (and resist over-applying it)

Add +10 *only* when the *organizer runs a structured matchmaking program as a service* — they take active responsibility for pairing attendees with relevant counterparts (hosted-buyer program, AI matching, account-managed 1:1s, curated speed-dating).

- *Qualifies:* Money20/20 Connect, Shoptalk Meetup, WBR pre-scheduled matching, WTM Hosted Buyer, SBC Smart Connect, hosted-buyer programs at retail/marketing shows.
- *Does NOT qualify:* self-serve booking in a conference app (Whova, Brella, Swapcard), generic "schedule a meeting" buttons, networking lounges, or "pre-booking encouraged" with no organizer-run pairing.

The test: does the organizer promise to pair you with buyers matching stated criteria? If yes → +10. If the matching is left to attendees through an app → no bonus. Self-serve app booking is a baseline expectation of any modern event, not a differentiator.

### Step 6 — Cross-client pattern check

Before finalizing, ask: would this same list appear for a different client in a different vertical? If yes, it's too generic — replace 3–5 famous events with vertical-specific or regional alternatives. Two clients with different ICPs must get different lists.

### Step 7 — Write the output

Return two artifacts.

*A. Executive summary* — exactly five elements, in order. Never add meta-sections about the scoring process itself:

1. Title ([Client] — Conference Analysis)
2. Client profile (company, product, backers, customers, ICP, target buyer, ACV range, geo scope, sales motion)
3. Scoring methodology as applied to this client
4. Assumptions and notes (intake + discovery insights, data gaps, unverified attendee counts)
5. Top 5 must-attend (name, score, location, dates, one-line case)

*B. Ranked table* — sorted descending by Total Score, capped at 15, no padding. Columns: Conference · Priority · Industry · Country · City · Quarter · Dates · Days · Attendees · Booths · Description · Total · Relevance (/40) · DM Access (/40) · Engagement (/20).

### Step 8 — The description column (this is where the list earns trust)

Each event gets a *two-sentence, ~30–45 word* description. Information density beats grammatical completeness.

- *Sentence 1 — conference texture.* Scale (attendee count), audience composition (specific roles + vertical), distinctive format (matchmaking program, location, vibe). Numbers beat adjectives. Named buyer types beat abstractions ("CMOs and growth leaders from neobanks, payments, embedded finance" — not "fintech executives").
- *Sentence 2 — the client-specific buying case.* Why this audience needs this client's product now. This sentence must NOT be interchangeable across clients or events. Sentence 1 is the constant; Sentence 2 is the variable.

Anti-patterns: marketing superlatives ("premier", "world-class"), generic one-liners, one-sentence entries, or a Sentence 2 that could be pasted onto any other event.

---

## Rules

- MUST lock B2B/B2C classification before scoring. It decides which side of the floor every score measures.
- MUST run active web search across all six discovery categories. Model recall alone produces famous-event bias.
- MUST run the famous-event audit before finalizing. Every marquee event justifies its place against a targeted alternative, or it's cut.
- MUST bias toward the client's actual ICP over event fame. A dense vertical summit beats a diluted flagship.
- MUST show the three sub-scores, not just the total. The breakdown is the audit trail.
- NEVER pad the list to a target count. P3 (< 70) events are excluded, full stop.
- NEVER let budget move a score. Budget is context for the user's decision, never an input to the rubric.
- NEVER add +10 for self-serve app booking. Only organizer-run matchmaking-as-a-service qualifies.
- NEVER reuse another client's list as a template. Every ICP gets a from-scratch list; a list that would fit two different clients is too generic.

## Tighten over time

After the client has attended 3–5 recommended events, pull the outcomes (leads sourced, meetings booked, pipeline created per event) filtered to each event's tag. Compare actual buyer-conversation yield against the predicted tier. Recalibrate: if P1s underperformed, the Relevance or DM-Access weighting for this client's motion is off; if a "boring" regional or free vendor event outperformed a flagship, raise the weight on density-per-dollar and lower the pull of famous names. Feed the learning back into the locked profile so the next recommendation starts smarter.

---

## What good looks like

A great run returns a short, confidently-ranked list where two different clients would never get the same events — famous names appear only when they survive the audit against a targeted alternative, and the surprises (a free AWS city summit, a 200-person vertical summit, a curated dinner) are there because buyer density justified them. Every row shows its three sub-scores, the descriptions are dense and client-specific in the second sentence, and nothing below 70 padded the list.

Mediocre looks like: the same roster of flagships any fintech (or martech, or devtool) client could have been handed, budget quietly dragging scores around, self-serve app booking mistaken for matchmaking, single-sentence generic descriptions, and a list stretched to 15 with P3 filler.
