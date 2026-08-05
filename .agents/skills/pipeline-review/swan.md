---
title: Readme
description: "Setup page for pipeline review. Maps CRM stages, key fields, stall rules, and review cadence so future reviews are consistent."
---

## Instructions

### Step 1 — Confirm what CRM is connected

Check what CRM tooling the org has wired in. If a CRM is connected (HubSpot today; other backends as they come online), the rest of setup pulls from there. If no CRM is connected at all, this is the blocker — tell the user plainly: pipeline review without a CRM is guesswork. Push hard on connecting one before continuing.

If the user runs pipeline out of a spreadsheet or a non-CRM tool, the fallback is to ingest a CSV of open deals via the code sandbox. Treat this as a stopgap; flag that everything downstream (forecast, multi-thread, stalled revival) will work better once a CRM is wired.

### Step 2 — Map the CRM's deal stages to Swan's funnel model

Pull the deal stage list from the CRM. Pull Swan's existing funnel stages. Walk the user through aligning them.

The opinionated framing: a clean funnel has 4–6 stages, not 12. If the CRM has 10 stages that nobody can tell apart, suggest consolidating into the canonical shape:

| Funnel stage | What it means |
|--------------|----------------|
| **Discovery / Qualified** | First conversation has happened; fit confirmed; mutual interest. |
| **Demo / Evaluation** | Buyer has seen the product; comparing or piloting. |
| **Proposal / Pricing** | Commercial conversation; pricing on the table. |
| **Negotiation / Contract** | Terms being worked; legal/procurement engaged. |
| **Verbal yes / Committed** | Buyer has said yes; signature pending. |

Reverse-engineer from closed-won deals if possible: look at how the org's recent wins actually moved through stages, and let the real pattern shape the model rather than the CRM admin's wishlist. Persist the mapping by creating funnel stages with the appropriate Swan knowledge tool.

### Step 3 — Pick the fields that drive the review

Don't try to use every field on the deal object. The review needs a focused set. Confirm each is populated reliably in the CRM:

- **Close date** — drives "this quarter" filters and stale-date flags.
- **Amount** — drives prioritization and forecast weighting.
- **Owner** — drives per-AE scope and task routing.
- **Deal source / lead source** — drives debrief context (signal-led vs inbound vs outbound).
- **Last activity / modified date** — drives stalled detection.
- **Stage** — already mapped above.
- **Stage history** — ideal for velocity analysis. If the CRM doesn't track it natively, suggest enabling it; otherwise the velocity skill degrades to total-cycle-only.

If a critical field is missing or unreliable for a meaningful share of deals, surface this — pipeline review on broken data is worse than no review. Recommend a CRM hygiene pass first.

### Step 4 — Set stage SLAs

For each stage in the mapped funnel, ask the user: how long should a healthy deal sit here? Capture as memory ("Discovery: 14 days. Demo: 21 days. Proposal: 14 days. Negotiation: 21 days."). These are the thresholds the parent skill uses to flag stalled deals — without them, the review falls back to a flat 21-day default that fits no org well.

Reverse-engineer from closed-won median time-in-stage if data exists. If the org doesn't know, suggest reasonable defaults to start; the SLA tightens over time as evidence accumulates.

### Step 5 — Define the review cadence

Be opinionated. The right answer for most orgs is **weekly, per-AE, Monday morning**. The review answers "what do I work this week" — that question is asked weekly, not monthly.

For very small teams or single-founder GTM, a **personal weekly** review still beats nothing. For very large teams, **per-AE weekly + a manager rollup monthly** is the shape.

Wire the trigger:
- Type: `SCHEDULE`.
- Cadence: weekly (default Monday 8am org-local).
- Scope: one run per pipeline owner.
- Delivery: chat by default; Slack DM if Slack is connected; email digest as backup.

### Step 6 — Save a baseline snapshot

Take a snapshot of the current open pipeline (deals, stages, amounts, close dates) and append it to org memory. Next week's review compares against it — that's how stage regression and slow drift get caught.

### Step 7 — Seed follow-on configuration

Suggest the user also configure:
- **Forecast** — same stage probabilities can feed forecasting; offer to set that up next.
- **Win/loss debriefs** — recommend running one on the org's most recent closed deal as a learning loop.
- **Stalled deal revival** — schedule it monthly as a deeper companion to the weekly review.

### Step 8 — Rewrite the parent skill's Setup state paragraph

Call `swan-update-skill` on the parent `pipeline-review` skill and rewrite its `**Setup state.**` paragraph so it describes what was just configured. The rewritten paragraph should list each Swan funnel stage with its CRM-stage mapping and SLA in days, the required deal fields that must be populated, the review cadence (frequency, day, scope), the delivery channel (chat / Slack / email), and today's date as last-refreshed. Drop the "Not yet configured" wording entirely.

Future invocations of this skill will read the rewritten paragraph and proceed without re-checking state.

## Recommended companion skills

Pipeline forecast (same funnel, different verb). Stalled deal revival (deeper than the weekly flag pass). Deal velocity analyzer (diagnostic when stage SLAs feel wrong).

## Success criteria

- Funnel stages exist in Swan and align to how the org actually sells.
- Every open deal has the required fields populated.
- Stage SLAs are recorded and used by the review.
- The recurring review fires on schedule and the user/AE acts on flagged items within 48 hours.
- Average days-in-stage trends down over the quarter as the review converts to action.
