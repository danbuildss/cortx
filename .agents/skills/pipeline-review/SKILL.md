---
name: "pipeline-review"
title: Pipeline review
description: "Reviews pipeline health before forecast calls or recurring check-ins. Flags stuck, skipped, regressing, or at-risk deals and recommends one concrete action per issue."
category: Deals
---

## Instructions

**Setup state.** Not yet configured for this org. Load the `Setup` sub-page and walk the user through mapping their CRM stages to the Swan funnel model, recording per-stage SLAs, and setting the review cadence before running a review. (After setup is performed, rewrite this paragraph via `swan-update-skill` to describe the current state — funnel stages mapped from CRM, required field mappings, per-stage SLAs in days, review cadence and delivery channel, and last-refreshed date — so future runs see the current configuration without re-checking.)

### What this skill does

Walk the user's pipeline. Surface deals that need attention: stalled in stage, regressed in stage, missing key activities, or showing risk signals. Output: a short prioritized list with one action per item. Not a forecast — that's a separate verb.

---

### Step 1 — Scope the review

Ask once:
- Whose pipeline (a specific AE, a team, the whole org)?
- Which stages (mid-funnel only by default — exclude early discovery and closed)?
- Time horizon (default: deals expected to close this quarter, plus anything aging > 30 days regardless of close date).

If the user hasn't said which AE, default to all open mid-funnel deals.

---

### Step 2 — Pull the deal slice

`hubspot-search-objects` (object: deals) filtered to the chosen owner(s), open stages, and the date window. Page size 20. Pull associated company and amount.

If the result is > 40 deals, switch to `swan-execute-code`: dump the deals query result and aggregate from disk.

---

### Step 3 — Flag anomalies per deal

For each deal in the slice, check three things (cheap, no enrichment):

| Flag | Check | How |
|------|-------|-----|
| **Stalled** | No engagement / activity update > 21 days | Deal `hs_lastmodifieddate` > 21 days ago |
| **Regressed** | Stage went backwards | Check stage history if available; or compare to prior pipeline snapshot in memory |
| **Risk: low engagement** | < 3 distinct contacts engaged in last 30 days | `hubspot-get-engagements` on the deal — count distinct contacts |
| **Risk: champion gone** | Primary contact left the company | `swan-search-companies` for the contact's current company vs deal company |
| **Risk: amount missing** | Deal in late stage with no amount | Deal `amount` field empty + stage past discovery |
| **Risk: close date stale** | Close date in the past or > 90 days out for a "this quarter" deal | Compare to today |

Keep one line per flagged deal: `<deal name> — <flag> — <evidence>`. Discard the rest.

If a deal has multiple flags, list them comma-separated on the same line.

---

### Step 4 — Pull fresh signals for at-risk deals only

For each flagged deal, check one source: `swan-fetch-business-events` on the associated company in the last 30 days. If a fresh signal exists, note it — it's the angle to act on.

Skip signal lookup for unflagged deals. Most pipeline reviews are about the at-risk subset.

---

### Step 5 — Recommend one action per flag

Lightest first:

| Flag | Default action | Tool |
|------|----------------|------|
| Stalled, fresh signal exists | Draft a signal-based re-engagement | hand off to `reach-out` |
| Stalled, no fresh signal | Create a CRM task for the owner to call/email manually | `hubspot-create-task` + `hubspot-create-note` |
| Regressed | Create a task to schedule a deal review with the owner | `hubspot-create-task` |
| Low engagement | Hand off to `multi-thread-deals` to identify missing personas | `multi-thread-deals` |
| Champion gone | Hand off to `champion-tracker` to find the champion's new role | `champion-tracker` |
| Amount missing / close date stale | Create a task for the owner to update the deal | `hubspot-create-task` |

Don't auto-execute. List the recommendation. Ask which to proceed with.

---

### Step 6 — Surface the report

```
PIPELINE REVIEW — <date>, <scope>

<N> deals reviewed. <M> flagged.

STALLED (X)
  1. <deal> — <amount> — last activity Y days ago — fresh signal: <yes/no>
     → <action>

REGRESSED (X)
  ...

RISKS (X)
  ...
```

End with a bottom line: "X actions recommended. Want me to create the CRM tasks for the top N?" Wait for approval before writing anything to CRM.

---

### Rules

- MUST process deals in slices of 20. Don't load the whole pipeline into context.
- MUST cite specific evidence per flag (days, dates, counts).
- MUST end with an explicit approval gate before creating CRM tasks.
- NEVER recommend more than 10-15 actions in a single review. Bigger lists won't get acted on. If more deals are flagged, surface top 10 and offer to do the rest in a follow-up pass.
- NEVER flag deals as stalled if they're in a stage where 21 days is normal (custom stages — confirm the org's stage SLAs from memory before flagging).
