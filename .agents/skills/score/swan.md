---
title: Readme
description: "Read-only guide for qualification setup. Configures ICP gates, signal weights, tier rules, decay cadence, and alert routing."
---

## Instructions

Works in two modes equally:
- **First-time setup** — no prior context exists. Researched assumptions feed user validation.
- **Ongoing refinement** — updates configuration as the org's GTM evolves.

The parent skill's two-pass credit gate (Step 0.3) runs automatically — no need to configure it here. Setup focuses on the per-org rubric the gate reads from.

---

### Onboarding context

When Setup runs during onboarding, history is thin: no prior CRM data, no prior executions, no signal samples. That's expected.

- Skip Step 1 sections that require CRM history (closed-won/lost patterns, prior execution samples). Note what was skipped and why.
- Rely on ICP and persona skills, public company research, and the user's direct answers.
- Pre-fill from research as much as possible. The goal is to reach the 3-question checkpoint with a working draft the user refines — not a blank slate.

**3-question onboarding checkpoint.** When called during onboarding, compress Step 2 into exactly three questions — the ones where assumptions are most subjective and most consequential if wrong:

1. Who is your ideal buyer persona? (title, function, seniority — who actually owns the buying decision)
2. What makes a deal "large" for you? (headcount band, revenue threshold, seat count, or deal value — whatever they use to think about deal size)
3. Any hard disqualifiers we should know — company types, industries, or situations you always walk away from?

Everything else gets pre-filled from research and flagged as "Swan's best guess — refine anytime." Do not extend onboarding past this. Real usage sharpens the rubric better than upfront perfection.

---

### Step 1 — Research & assume

Before asking the user anything, pull everything that already exists and form concrete, traceable assumptions. Every assumption must have a reason.

**1. Understand what scoring drives in this org's GTM.**
Scoring is two things at once: a qualification gate and a resource allocation engine.

- Qualification gate — determines whether the account is worth engaging at all. Non-ICP exits immediately. No resources spent, no sequences opened.
- Resource allocation — for accounts that pass, tier dictates how much to invest and how assertively to engage. Gold = lean in (faster follow-up, multi-threading, exec involvement). Bronze = conserve (lighter touches, automation-first).

Both failure modes cost real pipeline: overscore burns effort on weak signals; underscore lets real opportunities go cold; let non-ICP through and the pipeline fills with noise. Every configuration choice should sharpen the org's ability to qualify correctly and allocate proportionally.

**2. Pull ICP and persona knowledge.**
Load the ICP definition and the personas / buying committee. Extract:
- Who is clearly IN the ICP (segments, firmographics, must-haves).
- Who is clearly OUT (hard disqualifiers, excluded types, excluded geos).
- Which personas carry the most buying authority — titles, functions, seniority.
- How authority is distributed across the buying committee.
- Any known win/loss patterns tied to ICP or persona fit.

If these are thin or absent, make conservative assumptions and flag every one: "Assuming X because Y was found in Z."

**3. Pull GTM motion and positioning.**
Review positioning and org memory. Is this org primarily inbound, outbound, or product-led? The motion shapes signal weighting — PLG weights product engagement highest; outbound weights business events and persona authority more heavily. If unclear, assume mixed and flag it.

**4. Review CRM patterns (if connected).**
Look at a sample of closed-won and closed-lost records. What company types, sizes, and personas appear consistently on the winning side? On the losing side? These patterns are the most reliable input for hard floor rules and deal-size calibration. If the CRM isn't connected or has limited data, skip and note it.

**5. Sample recent scoring executions sparingly.**
If scoring has run before, pull no more than 5–8 executions, most recent first. Look for: signals that were missing but would have changed the tier; tier assignments that look wrong in hindsight; patterns where scoring misfired. If no executions, skip.

**6. Consider available signal sources.**
Think through what data is actually available. Swan's native enrichment and research are the default. Also consider CRM relationship/history data, website visitor identification (if connected), product usage data (if available), business event data, and any integrations connected. Form a reasoned preference and surface it in Step 2 for validation.

**Synthesize.**
Consolidate into a clear set of assumptions:
- Who clearly fails ICP (hard floor candidates).
- What "large deal" looks like for this org.
- Which personas carry the most buying authority.
- How to weight signals given the motion.
- Whether standard tier names fit or need renaming.

Each assumption traces to a reason. Flag genuine guesses.

---

### Step 2 — Surface & validate

Present a structured brief of Step 1's output:

- **Found** — facts pulled from ICP, org memory, CRM, executions. Name the source for each.
- **Inferred** — assumptions derived from what was found. One explicit "because" per assumption.
- **Unknown** — real gaps, named specifically. "No hard geo exclusions found" not "ICP definition is thin."

Keep it tight. Showing reasoning lets the user correct before questions.

Then use `ask-questions` to validate and fill gaps. Never freeform prompt. Validate even confident assumptions — a wrong one baked into four skills is expensive to undo.

Cover these, in order, skipping any Step 1 already answered:

1. **ICP gate sharpness** — is the ICP definition sharp enough for hard in/out decisions, or are there grey-zone types (edge-case sizes, adjacent industries, specific geos) that need explicit rules?
2. **Hard floor rules** — absolute disqualifiers beyond the ICP definition that should trigger immediate Non-ICP.
3. **Persona authority** — which titles/functions are the strongest buying signals? Which are present but weak on their own?
4. **Deal size signals** — what makes a deal "large" — headcount band, revenue threshold, seat count, product tier interest?
5. **What scoring drives** — website visitor routing, rep prioritization, sequence gating, or all of the above? Determines signal weight hierarchy.
6. **Tier naming** — Gold / Silver / Bronze, or something else?
7. **CRM tier field** — exact field name where the tier should be written, if any.
8. **Score decay cadence** — parent applies lazy decay (Gold → Silver at 60 days, Silver → Bronze at 90 days) by default when a new signal arrives. Validate whether these thresholds fit the sales cycle. Long cycles (enterprise, 6+ months) may warrant extending Gold decay to 90 days. Short cycles (transactional, under 60 days) may want tighter thresholds. If defaults fit, just confirm.
9. **Tech stack signals** — which tools in a company's stack are meaningful for this org? Which combinations indicate high intent or readiness? Which indicate the account isn't mature enough yet? These get baked into `New business scoring`'s firmographic/technographic section.
10. **Alert channels** — confirm where Silver-tier QA alerts and Gold-tier full alerts should land (Slack channels, email).

Never skip this step — the user must confirm before anything is rewritten.

---

### Step 3 — Propose the revision plan

Load all four skills now: the parent and three sub-skills (`New business scoring`, `Re-engagement scoring`, `Expansion/PLG scoring`). Read each before forming the plan.

Present a summary of what will change in each, built from confirmed context. Name actual personas, actual floor rules, actual deal-size signals. The user needs to recognize their org.

Keep each entry brief but don't force it to one line:

- **Parent** — what changes in the qualification gate and signal hierarchy.
- **New business scoring** — what changes in persona authority and deal-size framing.
- **Re-engagement scoring** — what "materially changed" will mean for this org.
- **Expansion/PLG scoring** — what product depth and expansion signals will be named.

This is a confirmation gate, not a walkthrough. Wait for explicit user confirmation before proceeding. Do not rewrite anything until the user says yes.

---

### Step 4 — Rewrite

With confirmed context, rewrite each skill in sequence. Load each one immediately before editing — do not work from memory of what was read earlier.

For each skill:
- Find every section where org-specific context should live. Look for placeholders, generic examples, and "this org" language.
- Rewrite those sections so confirmed context is embedded in how the skill operates. Do not append answers to placeholders — replace the logic.
- Leave core structure, routing, and universal principles intact. Only change what context touches.

After all rewrites, present a brief summary per skill — specific enough for the user to verify correctness without re-reading any of the four skills.

---

### Step 5 — Rewrite the parent skill's Setup state paragraph

Call `swan-update-skill` on the parent `Company qualification & scoring` and rewrite its `**Setup state.**` paragraph so it describes what was configured. The rewritten paragraph names the hard-floor rules, persona-authority defaults, deal-size signals, tech-stack signals, signal-weight overrides (if any), tier naming, alert channels, decay cadence, and today's date as last-refreshed. Drop the "Not yet configured" wording entirely.

Future invocations read the rewritten paragraph and proceed without re-checking state.

---

## Recommended companion skills

- `icp` — must be set up first. Scoring without an ICP is incoherent.
- `personas` — defines who has buying authority. Setup leans on this for persona-quality judgment.
- `reach-out` — A/B-tier accounts route here for outreach.

---

## Rules

- MUST load ICP and personas before generating any assumption.
- MUST surface assumptions with sources before asking the user questions.
- MUST validate assumptions even when confident — wrong ones bake into four skills.
- MUST rewrite all four skills (parent + three sub-skills) when context changes — never leave them out of sync.
- MUST rewrite the parent skill's Setup state paragraph at the end so future runs skip setup.
- NEVER configure the credit gate manually — it runs automatically from the parent.
- NEVER extend the onboarding checkpoint past 3 questions.
