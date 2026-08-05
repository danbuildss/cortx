---
name: "customer-expansion-scoring"
title: Customer expansion scoring
description: "Use this skill when scoring a paying customer (closed-won account) for expansion. It evaluates product usage depth, persona quality, and expansion headroom to produce an expansion tier with short actionable reasoning. Designed as a sub-skill of your lead-scoring methodology — the parent runs the ACV assessment first and this returns a tier to it."
category: Deals
---

## Template placeholders

Replace every `{{...}}` before enabling. See the setup checklist reference for the full setup list.

- `{{PRODUCT}}` — Your product name
- `{{PARENT_SCORING_SKILL}}` — The parent lead-scoring skill this returns to (runs ACV assessment before this)
- `{{CRM}}` — Your CRM (e.g. HubSpot)
- `{{DEPTH_SIGNALS}}` — Your product's REAL usage-depth indicators (see Signal Stack #2 — must be replaced)
- `{{AUTO_CREATED_ARTIFACTS}}` — Objects your onboarding auto-creates for every account (excluded from depth)
- `{{FOUNDER_CONTENT}}` — Whose LinkedIn content signals post-conversion advocacy (usually a founder)
- `{{TIER_SCALE}}` — Tiers, low→high (default: Bronze / Silver / Gold / Diamond)
- `{{INACTIVITY_CAP}}` — Inactivity window that caps the tier (default: 30 days → cap at Silver)


Use when the account is a paying customer (Closed Won stage).

Goal: How deeply are they using {{PRODUCT}}, and how much bigger could this
account get?

The parent skill ({{PARENT_SCORING_SKILL}}) has already run the ACV
assessment and applied the ACV tag. Reference those results here — do not
re-research ACV dimensions covered there.

---

### Signal Stack (highest to lowest weight)

Gather all available signals from account memory, product event history, and
{{CRM}}.

1. **Meeting** — a completed call signals active relationship depth.
   Extract: topics discussed (expansion, new use cases, additional team
   members mentioned), questions and objections, action items, attendee
   roles. A meeting that surfaces new departments, budget conversations, or
   advanced use cases = strong expansion signal.

2. **Product depth** — the real indicators of depth for {{PRODUCT}} are
   {{DEPTH_SIGNALS}}.

   *Reference implementation (an AI GTM platform) used:*
   - *Integrations/tools connected beyond defaults — each = deliberate
     setup effort*
   - *Automations/triggers created beyond the default one — variety and
     count signal how much the user is actually building on the product*
   - *Usage credits consumed (volume = active usage)*
   - *Multiple team members active*

   > **What does NOT count as product depth:** {{AUTO_CREATED_ARTIFACTS}} —
   > anything your onboarding auto-creates is present on virtually every
   > account. Do NOT treat these as engagement or power-user signals. Judge
   > depth only by artifacts the customer deliberately built.

3. **Chatbot / support interactions** — technical or advanced use-case
   questions signal active exploration

4. **Website visits (post-signup)** — return visits to docs, pricing (plan
   upgrade signal?), or feature pages

5. **LinkedIn engagement** — post-conversion engagement with
   {{FOUNDER_CONTENT}} signals advocacy or a deepening relationship

---

### Persona Quality

**Strong:** CRO, VP Sales, Head of Sales, RevOps, GTM Engineer, Growth
Lead, CEO (small co), Agency Owner *(tune to your buying committee)*
**Weak:** Product, Engineering, Finance — requires stronger product signals
to compensate
**Multiple strong personas actively using {{PRODUCT}}** = significant
positive multiplier for the top tier

Persona quality reflects expansion potential. A VP Sales actively building
on {{PRODUCT}} is a more valuable expansion signal than a junior IC doing
the same. Always note the persona role in your reasoning.

---

### Expansion Headroom

Assess how much room this account has to grow:
- Current seat count vs. total relevant org size (from the parent ACV
  assessment)
- Teams or divisions not yet using {{PRODUCT}}
- Growth signals: recent funding, active hiring, new leadership joins
- Are they approaching credit, usage, or seat limits?

---

### Hard Caps

**No product usage signals in the last {{INACTIVITY_CAP}}** → cap at the
second-lowest tier (churn risk takes priority over expansion scoring). Note
explicitly: "[window] inactivity — capped, churn risk flagged."

**Senior Stakeholder Exception (overrides seat-count limitations):**
If the registered user is a very senior stakeholder (VP, SVP, C-suite, or
equivalent Director-level executive) AND the company is high-quality
($10M+ funded OR 100+ employees OR well-known brand with a clear motion in
your market), score the second-highest tier **regardless of team size or
seat count**. Seniority + company quality is itself a strong expansion
signal — this person can unlock budget and teammates.

---

### Tier Definitions

*(Defaults shown for a Bronze/Silver/Gold/Diamond scale — remap to
{{TIER_SCALE}}.)*

**Diamond:**
Deep product usage (multiple integrations connected, multiple deliberate
automations active, multi-user) + high ACV potential (per parent
assessment) + clear expansion headroom. This account could 3–5x in ARR.

**Gold:**
Meaningful usage (1–2 integrations connected, active workflows running) +
medium-to-high ACV potential + some expansion headroom. Nurture toward
deeper adoption.

**Silver:**
Active customer but shallow usage (minimal integrations, few automations,
limited engagement) OR low ACV potential with limited expansion ceiling.

**Bronze:**
Barely active — minimal or no usage in recent weeks, no integrations, low
ACV potential. Prioritize re-engagement or churn prevention before
expansion.

---

### Output

Produce: tier + 2–3 sentence reasoning (usage depth, persona quality,
expansion headroom, ACV ceiling from parent).
Then return to {{PARENT_SCORING_SKILL}} and continue its remaining steps.

---

## What good looks like

A great output is a tier plus two-to-three sentences a CSM can act on immediately, citing all four dimensions: usage depth (deliberately built artifacts only), persona quality, expansion headroom, and the ACV ceiling from the parent assessment. Inactive accounts get capped with the churn risk flagged explicitly, and senior-stakeholder exceptions are called out as such.

Mediocre looks like: a tier derived from seat count alone, depth credited for onboarding auto-created objects, ACV re-researched when the parent already assessed it, or essay-length reasoning nobody reads.
