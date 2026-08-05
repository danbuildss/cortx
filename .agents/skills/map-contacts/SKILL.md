---
name: "map-contacts"
title: Map contacts
description: "Maps the buying committee at a named account using CRM history, past interactions, LinkedIn, and prospect search. Produces persona coverage, relationship strength, gaps, and next moves."
category: Prospecting
---

## Instructions

**Setup state.** Not yet configured for this org. Load the `Setup` sub-page to confirm the persona model (buying-committee shape) is defined and identify which relationship-history data sources are available (CRM, email sender, Fireflies, LinkedIn, prospect search) before mapping anything. (After setup is performed, rewrite this paragraph via `swan-update-skill` to describe the current state — persona model loaded, which of the five data sources are available, and last-refreshed date — so future runs see the current configuration without re-checking.)

### Step 1 — Confirm the target account + intent

Get the company domain or name. Get the intent in one line: net-new ABM mapping, renewal prep, champion-tracking, or expansion of a single-threaded deal. Each shifts priority slightly (renewal leans heavy on current users + economic buyers; champion-tracking leans heavy on past contacts who moved).

### Step 2 — Pull the persona model

Load the org's defined personas. Hold the named roles, their title aliases, and their JTBDs as the schema for the map. Do not invent personas — the map is keyed to what the org has saved.

### Step 3 — Mine known relationships first (highest signal)

Lead with data the org already has. Each source is checked if connected; skip and note if not.

- **CRM.** Search Companies / Contacts / Deals for the account. Capture every named contact with role, last activity, owner, and status (still here, departed, dormant).
- **Sent email.** For each connected sender, search sent items for the account's domain. Pull every person ever emailed, last-touch date, and the thread topic in one line.
- **Meeting transcripts.** Use `FIREFLIES_GET_TRANSCRIPTS` filtered by participant email domain matching the account. Capture who joined, when, and what was discussed.
- **Prior sequences.** Use `swan-search-sequences` filtered to the account. Note who was reached, who replied, who booked.

Aggregate by person before moving on — one row per human, even if they appear across all four sources.

### Step 4 — Find people who moved (the high-value bit most skills miss)

For every past contact across CRM and email who is no longer at the account, check current employer. A closed-lost champion now at a new target account is the highest-signal person to reach this quarter. For every current contact at the account, check if they joined recently — new-to-role plus a prior history elsewhere is a warm path that didn't exist before.

Use `swan-linkedin-social-media-presence` on a known LinkedIn URL to confirm current employer. Reach for `swan-enrich-contact` only when the user is about to act on a specific person — credits matter.

### Step 5 — Fill gaps with net-new prospect search

After known-relationship data is exhausted, run `swan-search-employees` for the persona roles still missing from the map. Net-new contacts join the map but flagged explicitly as "no relationship history" — they read differently from a warm contact and the next move should reflect that.

### Step 6 — Compose the structured map

Format as a tight per-persona section (or a single table). For each persona role (Champion / Economic Buyer / Technical Evaluator / End User / Blocker), list each named person with: full name, title, current employer (called out if different from the account), relationship strength (cold / warm-via-X / former-X-now-here / current-with-history / net-new), last touch (date + channel + who), recommended next move.

Flag role gaps — personas with no candidate or only weak coverage — at the top of the map, not buried at the end.

Not a wall of names. The map's value is the relationship signal per person, not the count.

### Step 7 — Hand off

Recommend the next move in plain verbs: who to outreach first (warm paths first), which gaps to close via further prospecting, which moved-contact play to activate this week. One paragraph.

## What good looks like

- Every persona role in the org's model has at least one named candidate OR an explicit gap flag. No silent absences.
- The map distinguishes "current contact with history" / "former contact still at the account" / "former contact who moved" / "net-new no history" — these have very different next-move implications and the format makes that obvious at a glance.
- Past relationships are surfaced front-and-center, not buried under net-new prospect rows. That's the whole point of going beyond decision-maker hunting.
- Recommends next moves by persona, not just a list of names. A reader can decide what to do without a second pass.
- A closed-lost champion now at the target shows up as the top recommended outreach. If it doesn't, the skill missed the highest-value signal it exists to surface.

What gets overlooked: treating warm and cold contacts identically; ignoring former contacts who moved companies (the single highest-signal hook); listing net-new prospects without flagging the absence of any relationship; missing role gaps because the map only shows what was found.

## Rules

- MUST use the org's defined persona model. Never invent personas for this skill.
- MUST search known-relationship sources (CRM, sent email, transcripts, prior sequences) before prospect-search for net-new.
- MUST surface relationship history per person — strength, last touch, who — as a first-class column, not a footnote.
- MUST flag former-contact-now-elsewhere candidates explicitly. These are usually the highest-signal hooks in the entire map.
- MUST flag role gaps — personas with no candidate or weak coverage — at the top of the map.
- NEVER enrich every net-new contact. Enrich only the slice the user is about to act on.
- NEVER replace or override the persona model. The org's saved buying committee is the schema.
- NEVER drop former contacts because they no longer work at the account. They're the reason this skill exists.

## Specificity sub-pages this skill will grow

Add over time as the org's mapping motion sharpens:

- **`RenewalPrep`** — mapping for an upcoming renewal. Heavier weight on current users and the economic buyer; surfaces churn risk in the committee (champion left, EB changed, user base attritted).
- **`ChampionTracker`** — track when a known champion changes companies. Watches LinkedIn for the employer change; surfaces the new account as a fresh target the moment the move lands.
- **`MultiThreadExpansion`** — expand the map for an existing deal that's single-threaded. Diffs the current map against the persona model and recommends specific multi-thread additions with warm paths where they exist.
