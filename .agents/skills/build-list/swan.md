---
title: Readme
description: "Read-only guide for list-building setup. Defines the org column plan, elimination filters, enrichment policy, and activation routing."
---

## Instructions

Setup is a product flow, not a checklist. Walk the user through it. The goal is to make every future list call short — the org has a column plan and a credit policy; only campaign-specific deltas need a conversation.

---

### Step 1 — Confirm ICP is loaded

List-building is downstream of ICP. Load the ICP via `swan-get-icp-segments`.

- **No segments defined** → stop here. Route the user to ICP setup. Don't fake a list template against a non-existent ICP.
- **Segments exist** → confirm the segment(s) and personas the user wants this list template to default to. If they have multiple segments with materially different motions, note that the template might branch by segment later (sub-page accretion).

---

### Step 2 — Define the default column plan

Branch on what evidence the org can supply. Push for the best path.

#### Path A — CRM + sequencer connected (best)

Reverse-engineer from what's actually winning.

- Pull recent prospect lists that produced replies or booked meetings (last 90 days). Look at the source lists feeding the org's best sequences. Check the CRM for the contacts on those threads.
- For each winning list, capture the columns that were present — what data did the rep have when they wrote the outreach that worked? Subject line referenced a recent raise → funding column mattered. Opener referenced a hire → hiring signal column mattered. CTA referenced their tech stack → technographic column mattered.
- The columns that *consistently* show up across winning outreach are the schema. The ones that don't ever surface in the copy are noise.

#### Path B — sequencer connected, no CRM

Mine the sequencer directly. Pull recent campaigns that got replies; read the merge fields actually used in the body copy. Those are the columns that mattered.

#### Path C — user-told

Ask the user to describe their best outbound list — what columns were on it, what data the rep had. Capture verbatim. Don't editorialize.

#### Path D — cold start (Swan default)

The opinionated default if no evidence is available:

- **Company columns:** domain, name, employee band, industry, geo, one signal column (funding / hiring / intent — pick the one that fits the org's motion), ICP tier.
- **Contact columns:** name, title, persona role, seniority, LinkedIn URL, verified email. Phone only added when a cold-call motion exists.

Save the agreed column plan as org memory via `swan-update-memory` keyed `list-column-plan`. Tell the user this is the default — campaign-specific overrides at call time are allowed.

---

### Step 3 — Define sourcing tiers and enrichment policy

The credit policy. This is what separates a Clay-style operator from someone burning through credits on everything.

**Sourcing tier order.** Confirm with the user, biased to what's connected:

1. Swan native (free preview) — always step one.
2. The CRM — closed-lost, churned, dormant. Highest signal at zero cost.
3. Apollo, if connected — international and non-tech coverage.
4. Apify scrape — niche directories, conference lists, local businesses, vertical-specific sources.

If the org has a specialty source connected that's better than Swan native for their motion (e.g. they live in Crunchbase data for funded startups), reorder accordingly. Capture the order to memory.

**Enrichment policy.** Capture as memory the answers to:

- "Every paid column runs only on rows where `icp_pass = true`." Default ON. Non-negotiable.
- "Free elimination (domain dedupe, hard size/geo re-filter, CRM exclusion, LLM sniff test) runs before any paid call." Default ON. Single biggest credit save.
- "Email waterfall — A and B-tier only." Default ON. C-tier nurture lists skip the waterfall until engagement appears.
- "Phone enrichment — only when cold-calling motion exists." Default ON.
- "Cap contacts per company by play type." Cold-blast = 1, ABM = 3–5. Confirm the cap.
- "Drop D-tier before contact discovery." Default ON.
- "Pilot every new AI research column on 10 rows before scaling." Default ON.

Save the policy to memory keyed `list-enrichment-policy`.

---

### Step 4 — Define the activation defaults

Where do finished lists go? Confirm and save:

- **Swan list** — always tagged with segment + source. Default ON.
- **Sequencer push** — if a sequencer is connected, A-tier rows go to outreach sequence; B-tier to nurture; C-tier content-only. Confirm channel preference (email, LinkedIn, multichannel).
- **CRM push** — if the CRM is connected and the user wants pipeline visibility upstream of Swan outreach, push to CRM with tier tags. Confirm whether to create new records or only enrich existing ones.
- **Approval gate.** Every push requires explicit user approval of list size + estimated credit cost. Default ON; this should not be turn-off-able.

Save as memory keyed `list-activation-defaults`.

---

### Step 5 — Preview sub-page accretion

Close setup by setting expectations:

> "Right now `build-list` has your default schema, sourcing tiers, enrichment policy, and activation routing. As the org adopts specific list motions — lookalike to closed-won, competitor displacement, event follow-up, funding-triggered, job-posting-triggered, local-business prospecting — I'll grow this skill with situation-specific sub-pages. None of those are written today. Each one comes when you run that motion for real."

Setting this expectation early prevents the skill from feeling incomplete on day one — and prevents the temptation to over-author sub-pages before there's evidence of the motion.

---

### Step 6 — Rewrite the parent skill's Setup state paragraph

Call `swan-update-skill` on the parent `build-list` skill and rewrite its `**Setup state.**` paragraph so it describes what was just configured. The rewritten paragraph should list the saved column plan, the sourcing tier order (e.g. Swan native → CRM closed-lost → Apollo / Apify), the enrichment policy (what gets enriched, what doesn't), the activation defaults (Swan list / sequencer / CRM push) with approval gate state, and today's date as last-refreshed. Drop the "Not yet configured" wording entirely.

Future invocations of this skill will read the rewritten paragraph and proceed without re-checking state.

---

## Recommended companion skills

- `icp` — must be set up before list-building can target. If it isn't, set it up first.
- `score` — pairs with list-building to tier companies before contact enrichment. Without it, tiering is rough-and-ready instead of rubric-based.
- `reach-out` — the standard activation path for A/B-tier rows.

---

## Success criteria

After setup, the user can say "build me a list of ~200 [segment] companies hiring for [role]" and get back, in one pass: a deduped, tiered list with the org's default columns filled in, sourced from the right tier order, enriched only on the slice that matters, with size and credit cost shown before activation. The user reads the summary once and approves, not rewrites the brief.
