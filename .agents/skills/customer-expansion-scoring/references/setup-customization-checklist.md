---
title: "Setup & Customization Checklist"
description: (reference)
---

# Setup & Customization Checklist

## 1. How this skill is invoked

This is a **sub-skill, not a triggered skill.** It has no trigger of its
own. Your parent lead-scoring skill loads it when the account's stage is
Closed Won (paying customer), after running the ACV assessment. It scores
and returns.

- [ ] `{{PARENT_SCORING_SKILL}}` exists and: (a) runs the ACV assessment
      before delegating here, (b) branches customers into this skill instead
      of prospect scoring, (c) handles the post-scoring steps (CRM sync,
      tags, alerts) after this returns.
- [ ] Product usage data is reachable by the agent (product event history /
      webhook log / usage tables). Without it, Signal Stack #2 — the
      highest-leverage signal — is blind and every account will look
      shallow.

## 2. The one section you MUST rewrite: product depth

`{{DEPTH_SIGNALS}}` and `{{AUTO_CREATED_ARTIFACTS}}` are the heart of this
skill and are 100% product-specific:

- [ ] List the 3–5 artifacts in YOUR product that a customer only has
      because they deliberately built them (integrations connected,
      workflows authored, API keys used, teammates invited...).
- [ ] List everything your onboarding auto-creates — and exclude it. The
      original deployment learned this the hard way: auto-created objects
      made every account look like a power user until they were explicitly
      excluded from depth scoring.

## 3. Calibration decisions

- [ ] `{{INACTIVITY_CAP}}` — default 30 days → cap at second-lowest tier.
      Match to your product's natural usage cadence (a weekly-use product
      needs a longer window than a daily-use one).
- [ ] **Senior Stakeholder Exception** — the "VP+ at a quality company
      scores Gold regardless of seats" override is aggressive by design.
      Confirm the company-quality bar ($10M+ funded / 100+ employees /
      known brand) matches your market.
- [ ] Persona lists — tune strong/weak to your buying committee.
- [ ] Tier definitions — the Diamond bar ("could 3–5x in ARR") should
      reflect your actual expansion economics.

## 4. Behavioral invariants (do not remove)

- Never re-research ACV dimensions the parent already assessed.
- Inactivity cap beats every positive signal — churn risk outranks
  expansion.
- Auto-created artifacts never count as depth.
- Output is always tier + short reasoning covering all four dimensions
  (depth, persona, headroom, ACV ceiling), then control returns to the
  parent.
