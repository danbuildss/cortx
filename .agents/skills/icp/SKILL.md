---
name: icp
title: ICP
description: "Defines and refines who the org sells to. Use for ICP discovery, segment refinement, new segment creation, persona definition, and tightening the rubric used by scoring and outreach."
category: Prospecting
---

## Instructions

**Setup state.** Configured Jun 8, 2026 via website/case-study evidence (Path B — no CRM connected). 3 segments: **Cloud-Native B2B SaaS Engineering Teams** (100–1,000 emp, B2B SaaS, AWS-first, post Series B), **Fintech & Payments Infrastructure** (50–500 emp, fintech/payments, cloud-native, compliance-driven), **Digital Media, Streaming & Gaming** (200–2,000 emp, high-traffic consumer platforms). 4 personas: SRE/Platform Engineer (Champion), VP/Director of Engineering (Economic Buyer), Head of DevOps/Infrastructure Lead (Champion/Evaluator), Engineering COO/CTO (Economic Buyer, Fintech segment). Next refinement: connect CRM to validate against real win/loss data.

### What this skill does

Two day-to-day jobs:
1. **Refine** — pull what's actually winning, find patterns the current ICP misses or overstates, propose tightenings the user approves before saving.
2. **Add a segment** — define an additional ICP segment alongside the current ones when a distinct motion has emerged.

First-time discovery lives in `Setup` — load it if the state check tells you to.

---

### Refine flow

#### Step 1 — Load and show what's defined

Pull the current segments, personas, target markets, value prop. Print them back to the user in one or two lines each so they remember what they're refining. Ask: "Anything specific that feels off, or should I scan recent deals broadly?"

#### Step 2 — Pull recent closed deals

Start narrow: closed-won and closed-lost deals from the last 6 months. Check the CRM if one is connected — pull the deal stage history, the associated company, the close date, the win/loss reason if populated. Page size 20.

If there are more than 60 closed deals in the period, switch to `swan-execute-code`: dump the deals query result to a file and aggregate there. Don't load 200 deal records into context.

If no CRM is connected, ask the user to name their last 5–10 closed-won and closed-lost deals — work from the named list. If they can't, refinement isn't possible yet; recommend they connect the CRM or come back when more deals have closed.

#### Step 3 — Pull firmographics for each deal's company

Search Swan's company records first. If size, industry, or stage is missing on more than 20% of records, flag the gap — don't enrich-everything to fill it. The analysis will be partial without that data; say so.

#### Step 4 — Find the patterns

In `swan-execute-code` (or by hand if ≤ 20 deals), group wins vs losses by:
- industry — which industries skew won?
- employee band (1-50, 51-200, 201-1000, 1000+) — where's the win rate highest?
- funding stage / company stage — same question.
- geo — same question.
- if win/loss reasons are populated, top 5 most common per side.

Print a short table per dimension. Don't paste raw deal data.

#### Step 5 — Propose refinements

Compare patterns to the current ICP. Look for:
- **Boundaries too wide** — wins concentrate in a narrower band than the segment claims.
- **Boundaries too narrow** — wins span outside the stated range.
- **Missing exclusions** — a dimension where losses cluster but wins don't ("we keep losing in healthcare — should that be out of scope?").
- **New segments** — a cluster of wins doesn't fit any current segment.
- **Persona drift** — the actual signers / champions in won deals don't match the saved personas.

For each proposed change, write one line: "tighten size band to 50-300 (current: 50-1000). wins concentrate in 50-300, losses spike above 500."

Present 3–5 proposed changes. More than that means the ICP needs full discovery — route to `Setup`.

#### Step 6 — Confirm and save

Ask the user which changes to apply. For each confirmed change:
- Segment boundary changes → `swan-update-knowledge-segment` on the existing segment.
- New segment → `swan-create-icp-segment`.
- New or sharpened persona → `swan-create-knowledge-persona` or `swan-update-knowledge-persona`.
- Sharpened value prop the user articulated mid-refine → `swan-update-knowledge-value-prop`.

Confirm what was saved. Recommend running scoring on the next batch of unscored accounts to validate the refinement.

---

### What good looks like

A great refine pass:
- **Catches the contradiction first.** The single most important output is the place where actual wins disagree with the stated ICP. Lead with that.
- **Names what's overlooked.** Losses cluster on a dimension the current ICP doesn't even mention — surface the dimension, not just the count.
- **Stays grounded in real deals.** Every proposed change cites the specific pattern ("8 of 12 wins are sub-200, 5 of 7 losses are 500+"). Opinion without evidence doesn't make it into the proposal.
- **Knows when to stop.** If the data says the current ICP is correct, the right output is "no meaningful drift, the ICP holds." Inventing changes to look productive is failure mode #1.
- **Treats personas as part of ICP, not separate work.** The signers on won deals shape persona refinement in the same pass — never punt personas to a different skill.

Failure modes to avoid:
- Proposing 8 changes because the data was noisy. The user can't act on 8; pick the 3 that matter.
- Recommending a full rewrite on a single contrarian quarter. Drift is patterned across multiple slices.
- Skipping the show-back step before saving. The user must approve each change.
- Treating "the user says we have a new ICP" as license to delete the old one. Ask before destroying state.

---

### Rules

- MUST ground every proposed change in deal data, not opinion. Cite the specific pattern.
- MUST keep proposed changes to 3–5. Bigger overhauls go through `Setup`.
- MUST confirm with the user before saving.
- NEVER refine without at least 10 closed deals to look at. Below that, the signal is noise.
- NEVER auto-save. The user approves each change.
- NEVER treat personas as a separate skill — they live inside `/icp`.

---

## Specificity sub-pages this skill will grow

Add over time as the org's GTM motion sharpens:

- **`SegmentDeepDive.md`** — when the org has 2+ segments with materially different motions, capture per-segment refinement playbooks (which dimensions matter most for that segment, which losses are noise).
- **`PersonaSharpening.md`** — when the persona work goes beyond title + responsibilities into career-stage signals, activity signals, and disqualifiers (the old `ideal-buyer-profile` territory).
- **`Drift.md`** — drift report flow once the org has 4+ quarters of history (folded in from `icp-evolution` if/when consolidated).
- **`SegmentBirth.md`** — process for spinning up a fresh segment when one wins cluster is materially different from the rest.
