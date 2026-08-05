---
title: Readme
description: Setup page for contact mapping. Confirms persona model and available sources so future account maps know which data to mine.
---

## Instructions

### Step 1 — Confirm the persona model is defined

Load the org's ICP and personas. If no personas are saved, route the user to ICP setup first — this skill maps a buying committee, and without a defined committee there's nothing to map. Do not proceed past this step on an empty persona model.

If personas exist but feel thin (only one role, generic titles), suggest a pass through ICP persona refinement before relying on this skill at scale.

### Step 2 — Confirm the CRM is connected

Check whether a CRM is connected. Today this is HubSpot in practice; the agent should say "check the CRM" and degrade gracefully if nothing is wired. CRM is the spine of relationship history — without it, the map collapses to email-only plus net-new.

### Step 3 — Confirm at least one email sender is connected

List the org's senders. The sent-items search is the second pillar of relationship history — people emailed without ever entering the CRM. If no sender is connected, note the gap; the map will skew to CRM-known contacts only.

### Step 4 — Confirm optional sources

- **Fireflies (meeting transcripts).** Big lift on who actually showed up to meetings, including names that never made it into the CRM.
- **LinkedIn data access.** Needed to check current employer for past contacts (the "did our champion move" play). Confirm `swan-linkedin-social-media-presence` is usable.
- **Prospect search.** Always available — used to fill role gaps with net-new.

### Step 5 — Save the source inventory

Save an org memory note `map-contacts-sources: [crm, email, fireflies, linkedin, prospect-search]` listing which of the five are actually available. The parent skill reads this and skips missing sources without prompting again.

### Step 6 — Rewrite the parent skill's Setup state paragraph

Call `swan-update-skill` on the parent `map-contacts` skill and rewrite its `**Setup state.**` paragraph so it describes what was just configured. The rewritten paragraph should confirm the persona model is loaded (with persona count), list which of the five data sources are available (CRM, email, Fireflies, LinkedIn, prospect search) and flag any gaps that will degrade the map, and include today's date as last-refreshed. Drop the "Not yet configured" wording entirely.

Future invocations of this skill will read the rewritten paragraph and proceed without re-checking state.

## Recommended companion skills

- `/icp` — defines the buying-committee personas this skill maps to.
- `/reach-out` — the natural next step after the map is composed.
