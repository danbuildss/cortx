---
title: News
description: "Research sub-page for recent account news. Produces a short, dated, source-cited timeline for prep or outreach context."
---

## Instructions

Lightweight by design. If the user wants a full company brief, route to `Company`. If they want executive history, route to `Person`.

### Step 1 — Time-bound the scan

Default window: last 30 days. For pre-meeting prep, that's the right freshness. The user can override (e.g. "last 90 days" for a quarterly account review).

### Step 2 — Pull business events

`swan-fetch-business-events` filtered to the company domain, last 30 days. Returns funding, hiring, leadership, partnerships, product launches in one structured call.

Group by event type:
- **Leadership** — VP+/C-suite hires or departures
- **Funding** — any round
- **Product** — launches, pricing changes, integrations
- **Partnership** — announcements, joint ventures
- **Hiring** — significant role family expansions (e.g. "+8 sales hires in 30 days")
- **Other** — acquisitions, layoffs, office openings

If the result is more than 20 events, switch to `swan-execute-code`: read `files/tool-outputs/swan-fetch-business-events_<callId>.json`, group by `eventType` with pandas, print count + 2 most-recent items per group.

### Step 3 — Quick LinkedIn pass

`swan-linkedin-social-media-presence` on the company page. Scan posts from the last 30 days for anything not surfaced by business events: customer wins, milestones, comments by execs, public hiring posts, product teasers.

One pass, keep only signal-bearing posts. Drop the rest.

### Step 4 — Web headline check

`swan-fetch-scraped-url` on a Google news search: `"<company>" last 30 days`. Aim for 2–3 headlines that aren't already covered by business events or LinkedIn.

Stop after 2 fetches if nothing new surfaces. This is a quick scan, not a deep dig.

### Step 5 — CRM activity cross-check (optional)

If a CRM is connected and the call is pre-meeting, pull engagement history for the company in the last 30 days. Surface: most recent rep activity, last reply, open tasks.

Catches "we already talked to them about this on the 14th" so the user doesn't walk into a meeting blind.

### Step 6 — Compose the timeline

Reverse-chronological. One line per item, dated, source-cited.

```
<Company> — Last 30 days

2026-05-08 — New VP Marketing hired (Jane Doe, prior at Acme) [business event]
2026-05-03 — Series B announced, $40M led by Bessemer [business event]
2026-04-28 — Posted Q2 customer milestone on LinkedIn [linkedin]
2026-04-22 — Featured in TechCrunch on AI infra strategy [web]
2026-04-15 — Last rep call: discovery with CMO Sarah Lee [crm]

WHAT TO USE IN THE MEETING
  - <one sentence — the strongest hook>

WHAT TO AVOID
  - <one line if the CRM shows a recent sensitive thread, e.g. paused outreach>
```

### Step 7 — Hand off

This sub-page produces context, not action. The user reads the timeline and decides what to do with it.

## Rules

- MUST date every item.
- MUST cite the source per item (`[business event] / [linkedin] / [web] / [crm]`).
- MUST stay within the time window. A 6-month-old funding round doesn't go in a 30-day scan, even if it's "still relevant."
- NEVER pad with generic firmographic info ("they're a 500-person fintech"). This is news, not a brief.
- NEVER spend more than 2 web fetches if business events and LinkedIn covered the surface area.
- If the company had no significant events in the window, say so plainly ("no notable events in last 30 days"). Don't manufacture findings.
- If a tool result is truncated, read the JSON from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code` and summarize.
