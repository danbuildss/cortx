---
title: New business scoring
description: "Scoring sub-page for non-customer accounts. Handles anonymous signals, named inbound, warm re-entry, and active pipeline rescoring."
---

## Instructions

Use the parent's Q1/Q2 frame. Core question: how strong is the buying intent, and how large is the potential deal?

---

### Warm-context mode (prior warm engagement + new signal)

If called with a warm-context flag from the parent's routing step, the account has prior positive engagement on record — past outreach reply, webinar registration, event attendance, or similar. This is not a cold first touch.

- Pull the prior engagement from CRM or account memory. Surface it explicitly as a named signal alongside the new signal.
- Weight the combination: a new first-party signal from an account that previously replied or attended is meaningfully stronger than the same signal from a cold account.
- Adjust outreach framing — the recommended next action should acknowledge the prior relationship, not open as if the account has never heard of the org.

Return the warm-context flag in the output so downstream steps (sequence drafting, CRM note) can use it.

---

### Refresh mode (in-pipeline rescoring)

If called in refresh mode — account is in active pipeline, or rescore triggered by new intel from a meeting, rep note, or business event:

- Use the full data set: CRM notes, meeting transcripts if available, rep-logged intel.
- Intel confirmed directly (e.g. rep learned there are 50 sellers, not 5) overrides public data — note the discrepancy explicitly.
- Return a **change delta**: prior tier → new tier + what drove the change.
- If no meaningful new intel is present, return the same tier with `Score unchanged — no new material intel.` Parent skips Steps 2–5; log in memory; notify rep only if prior score was Gold.

---

### Step 1 — Assess intent (Q1)

Use the parent's default signal hierarchy (or the signal-weight preferences baked in by Setup).

**Named person behind the signal.** Assess persona quality by likely authority over the buying decision.
- A **strong persona** has budget authority or decision-making power — economic buyers, heads of function, leaders who would champion or use the product directly.
- A **weak persona** is an individual contributor, low-authority influencer, or someone whose title suggests they're unlikely to drive a purchase.

Use seniority, function, and proximity to the buying decision as the guide; org-specific persona definitions come from Setup.

- Strong persona + first-party signals → high intent.
- Weak persona → requires stronger signals elsewhere to compensate.
- Multiple strong personas engaged simultaneously → significant positive multiplier.

**Anonymous or third-party signal only.** Company-level signals have inherently lower confidence than person-level. Third-party signals alone (business events, social engagement) can reach Silver but require at least one first-party signal to reach Gold. Stack depth matters — multiple independent signals from different sources outweigh one strong signal.

When assessing confidence in who is behind a signal, weight it proportionally. A signal from someone who appears to be at the company is stronger than one with no verifiable connection.

---

### Step 2 — Assess deal size (Q2)

Form a judgment using available research:
- Team size relevant to the product's use case.
- Maturity signals: funding stage, relevant tools in tech stack, growth trajectory, leadership present.
- Any confirmed intel from refresh mode.

Reason from research until org-specific deal-size thresholds are baked in by Setup.

---

### Step 2.5 — Firmographic & technographic assessment

Separate from deal size — serves two distinct functions.

**Function 1 — ICP gate validation.**
Use firmographics (headcount, industry, geography, funding stage, revenue signals) to confirm the account genuinely belongs inside the ICP. Sense-check, not full re-qualification — the hard floor check in Step 0 already ran, but firmographic research here may surface new data (e.g. a company that appeared mid-market is actually a small division of a larger enterprise). Flag any discrepancy explicitly.

**Function 2 — Intent multiplier via technographics.**
Check the tech stack. The presence of certain tools is itself a signal of buying maturity and readiness — it tells you how sophisticated the operation is and whether they're likely to be a real buyer.

- Tools in the same category as the product → active evaluation or displacement potential.
- Complementary tools (integrations, adjacent stack) → existing investment in the problem space. Strong positive.
- Absence of any relevant tooling → the account may not be there yet. Temper the tier accordingly.

Tech-stack signals alone do not override intent signals — they're a multiplier:
- Strong tech stack + first-party intent → stronger confidence in the tier.
- Strong tech stack + no intent → note it, do not inflate the tier.

Org-specific tool combinations come from Setup.

---

### Step 3 — Apply the scoring frame

Use the parent's 2×2:

- Strong intent + Large deal → **Gold**
- Strong intent + Small deal → **Silver**
- Weak intent + Large deal → **Silver**
- Weak intent + Small deal → **Bronze**

When borderline, err toward visibility — a rep reviewing a Silver-quality Gold is better than missing a real one.

---

### Multi-contact signal aggregation

When multiple individuals from the same company are engaging, do not simply add signals — interpret what the pattern means.

Two people engaging from the same company is a meaningful positive. How meaningful depends on context:

- **Different functions** (e.g. RevOps and VP Sales, or Head of Engineering and a founder) engaging independently → org-wide momentum. Qualitatively stronger than one person with the same total signal volume.
- **Same title or function** → team evaluation. Still positive but less indicative of cross-functional buy-in.
- **A senior persona + any second engaged contact**, regardless of seniority → upward pressure on the tier.

Use judgment on whether the multi-contact pattern reflects genuine organizational interest or coincidence. Surface the interpretation in the return:

`Two contacts engaged: [Name/Title] and [Name/Title] — assessed as [org-wide momentum / team evaluation / coincidence].`

Let the rep decide if the read is wrong. Do not apply a formula — the goal is to make the pattern visible and reasoned, not to calculate a number.

---

### Return to parent

Return:
- Tier
- Mode (New Business or Refresh)
- Signal stack, ranked strongest first
- Persona quality (Strong / Weak / Mixed / Unknown + one-line reason)
- Deal size assessment (one sentence)
- Hard caps or reasoning applied
- Change delta (prior tier → new tier + what changed, or N/A)
- Warm-context flag (if entered in warm-context mode)
