---
name: score
title: Score
description: "Qualifies and scores accounts against ICP and buying signals. Use for account fit, lead tiering, inbound signals, pipeline rescoring, re-engagement, and expansion potential."
category: Deals
---

## Instructions

**Setup state.** Not yet configured for this org. Load the `Readme` sub-page and walk the user through configuring the qualification gate, persona authority, deal-size signals, tech-stack signals, signal weights, tier naming, and alert channels before scoring any accounts. (After setup completes, rewrite this paragraph via `swan-update-skill` to capture the configured rules so future runs proceed without re-checking state.)

---

### The scoring frame

Every scoring run answers two questions:

**Q1 — How strong is the intent or engagement?**
Assess signal quality, persona authority, and whether signals are first-party (the account doing something directly) vs third-party (external data about them). Person-level signals outweigh company-level signals. Recency matters.

**Q2 — How large is the potential deal?**
Assess size, maturity, and expansion headroom against the org's deal-value signals. Reason from research until org-specific thresholds are baked in by Setup.

The tier is the intersection:

|                              | Large deal | Small deal |
| ---------------------------- | ---------- | ---------- |
| **Strong intent/engagement** | Gold       | Silver     |
| **Weak intent/engagement**   | Silver     | Bronze     |

**Bias toward visibility.** When signals or deal size are ambiguous, default to the higher tier. Confidence in the lower tier should be explicit — not assumed. Reps refine from there; the agent's job is not to filter too aggressively.

Non-ICP accounts do not receive a tier — they exit before scoring.

---

### Default signal hierarchy

Soft hierarchy — guides weighting, not numeric scoring. Override via signal weight preferences captured by Setup.

Key principle: first-party signals outweigh third-party. Person-level outweighs company-level. Weight signals in proportion to confidence that the person behind them is actually at the company and acting with intent.

1. **Direct inbound intent** — form fill, demo request, direct reply to outreach. Deliberate and person-level.
2. **Meeting completed** — both parties showed up. Extract topics, objections, stakeholder roles, new company intel not in public data.
3. **Product engagement** — active usage. Proves behavior, not interest. Weight highest for product-led motions.
4. **Website visit** — pricing and demo pages carry significantly more weight than blog posts. Depth and recency matter.
5. **Prior warm engagement** — positive outreach reply, webinar/event registration, conference booth visit, hosted-event attendance. Stronger than a cold website visit; weaker than a demo request. Full weight within 90 days of the engagement; diminished beyond. A positive outreach reply sits at the strong end of this band; event registration at the weak end.
6. **Conversational interaction** — weight by commercial specificity. A pricing question is strong; a generic intro is weak.
7. **Business event (third-party)** — funding, leadership hire, tech-stack change, job postings. Signals a moment of change, not confirmed intent. Weight rises sharply when stacked with first-party signals.
8. **Social engagement** — lowest weight. Meaningful only when stacked with other signals.

**Stacking rule:** two lower-hierarchy signals can outweigh one higher-hierarchy signal.

---

### Step 0 — Pre-scoring checks

**0.0 — ICP field sync.** Every run, before anything else, set `isInAnyTargetMarket` on the company record. Pass → set true with the matched target market ID. Fail → set false. This keeps Swan's native qualification field aligned with the latest score — the company record stays the source of truth even as accounts are rescored over time.

**0.1 — Vendor / partner check.** If tagged vendor, partner, or equivalent non-prospect: stop. No score, no alert, no update.

**0.2 — Hard floor check.** Does the account fail a hard-floor rule baked in by Setup (bot traffic, no plausible use case, excluded industry/geo)? If yes: tag Non-ICP, write memory "Non-ICP — [reason]", sync to CRM, stop. Ambiguous cases pass through to the sub-skill.

**0.3 — Credit efficiency gate (two-pass model).** Before any enrichment, contact research, or sequence drafting:

- **Pass 1 — cheap qualification.** Use only data already in hand: existing Swan company record, account memory, CRM record, the signal that triggered this run. Do not call enrichment tools. Make a preliminary ICP / Non-ICP call and rough tier estimate (Gold / Silver / Bronze / unlikely).
- **Pass 2 — full scoring.** Run enrichment, contact research, and the relevant sub-skill. Only happens when the account is ICP-likely AND preliminary signals suggest Silver or above.

If Pass 1 lands at Non-ICP → sync `isInAnyTargetMarket = false`, log, stop.
If Pass 1 lands at Bronze with no strong new signal → tag Bronze, log, stop. No enrichment, no contact research, no drafts.
Otherwise → proceed to Pass 2.

Bronze and Non-ICP accounts never trigger enrichment. Credits are reserved for accounts worth the investment.

---

### Step 1 — Route to a sub-skill

Route to exactly one. When ambiguous, route to the most downstream sub-skill the account qualifies for.

- **Customer or on trial** → `Expansion/PLG scoring`. Trial accounts use the same frame as customers — usage depth replaces engagement depth; expansion headroom is the same question.
- **Prior closed-lost deal + new signal** → `Re-engagement scoring`.
- **Prior warm engagement in CRM + new signal (not closed-lost)** → `New business scoring` with a **warm-context flag**. The sub-skill should treat the account as a re-entry: surface the prior engagement as a named signal alongside the new signal, factor the prior relationship into intent assessment and outreach framing.
- **Any other account** — first signal, inbound, or in-pipeline rescore — → `New business scoring`. For in-pipeline rescores: pull CRM notes, meeting transcripts if available, and rep-logged intel before handoff. The sub-skill returns a change delta vs the prior score.
- **No stage set, or earliest funnel stage with no engagement** → `New business scoring` (default).

---

### Step 2 — Apply tier tag

Remove any existing tier tag. Apply the new one.

- ICP-eligible accounts: Bronze is the minimum. Never leave an ICP account untagged.
- Non-ICP accounts: tag `Non-ICP`, not Bronze.

---

### Step 3 — Sync to CRM

If a CRM is connected and a tier field is configured, write the tier there. **Always** write a structured note to the CRM company record regardless:

`[SCORE: Tier] [Mode] [Date] — [1-sentence reasoning]. Top signals: [2-3]. Deal size: [1 sentence].`

The note is the human-readable audit trail.

---

### Step 4 — Update account memory

Prepend a snapshot to the top of account memory. Preserve all history below.

```
[SCORE: Tier] [Mode] — [date]
Signals (strongest first): [type] — [description]
Persona: [Strong / Weak / Mixed / Unknown] — [reason]
Deal size: [1 sentence]
Change delta: [prior tier → new tier + what changed, or N/A]
```

Update the state summary: `[SCORE: Tier] [Mode] — [what drove the score]`.

---

### Step 4.5 — Score decay check

Before applying a new tier, check the last score date in account memory. If a prior score exists and no meaningful new signal has arrived since, apply lazy decay:

- **Gold scored >60 days ago, no new signals** → downgrade to Silver. Memory note: `Score decayed Gold → Silver — 60+ days, no new signals.`
- **Silver scored >90 days ago, no new signals** → downgrade to Bronze. Memory note: `Score decayed Silver → Bronze — 90+ days, no new signals.`
- **Bronze** — no further decay. Bronze is the ICP floor.

**Lazy means:** this check only runs when the skill is triggered by a real new signal. No scheduled batch rescore. Dormant accounts age in place at zero cost.

**Staleness flag.** If the prior score was Gold or Silver and the account has been silent past the threshold, add to state summary: `Score may be stale — last scored [X] days ago, no new signals`. Surfaces visibility to reps without triggering a rescore.

---

### Step 5 — Alert

- **Non-ICP / Bronze** — no alert. Log only.
- **Silver** — QA-style alert to the configured Silver channel: full signal stack and reasoning. Purpose is score verification, not action.
- **Gold** — full alert to the configured Gold channel: tier, reasoning, signal stack, deal-size assessment, recommended next action.

---

### Step 6 — Recommended next play

If the org has defined plays or GTM motions, surface the recommended next play based on tier and scenario. Otherwise: Gold → immediate rep notification or outreach; Silver → monitor or light follow-up; Bronze → log only.

---

## Rules

- MUST sync `isInAnyTargetMarket` on every run, before any other write.
- MUST run the two-pass credit gate before any enrichment.
- MUST drop Non-ICP and Bronze accounts before contact enrichment or sequence drafting.
- MUST bias toward the higher tier when ambiguous. Visibility over filtering.
- MUST write the memory snapshot and the CRM note — the audit trail is how reps and future scores reason about the account.
- NEVER score before loading the rubric (ICP, persona authority, deal-size signals, signal weights, hard floors).
- NEVER tag an ICP-eligible account as untagged. Bronze is the floor.
- NEVER batch-rescore on a schedule — decay is lazy, triggered only by new signals.
