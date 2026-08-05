---
title: Company
description: "Research sub-page for general company context. Covers firmographics, what the company does, recent signals, and basic public footprint."
---

## Instructions

The goal is a tight read on the company: who they are, what they sell, who they sell to, what's happening now. Don't run every facet — that's what the other sub-pages are for. This is the default.

### Step 1 — Check what Swan already has

Cheap before expensive:

1. `swan-search-companies` for the domain or name. Swan's model may have firmographics, funding, tags, prior research.
2. `swan-get-memory` keyed to the company — past briefs may already cover this.
3. If a CRM is connected, check the CRM for the company record — owner, deal history, custom fields.

If a recent brief exists (< 30 days), use it as the base and refresh only what's stale.

### Step 2 — Firmographic frame

If Step 1 didn't surface size, industry, stage, geo: `swan-fetch-businesses` filtered to the domain returns the free firmographic preview. Only call `swan-enrich-company` if the firmographics are missing AND the play needs them — don't blow credits to "be thorough."

Capture: industry, employee count, HQ geo, founded year, funding stage if known.

### Step 3 — What they do — one paragraph

`swan-fetch-scraped-url` on the homepage. Read the H1, the subhead, the first product section, and the top CTA. From those four elements compose one sentence: who they sell to, what they sell, what value they claim.

If the homepage is dense, also fetch `/about` or `/product`. Two fetches max for the company-what-they-do read.

### Step 4 — Recent signals (last 30 days)

`swan-fetch-business-events` for the company domain, last 30 days. Surface only the items that matter for the user's likely angle: funding, leadership change, hiring spike, product launch, partnership, layoffs. Skip the noise.

If the user wants deeper news, route to `News`. This is the brief version.

### Step 5 — Light digital footprint (optional)

If the play depends on digital maturity (SEO sale, demand-gen tool, content tool), `swan-website-traffic` for a one-line scale read. Otherwise skip — for most asks, traffic is irrelevant.

For full digital footprint, route to `Domain`.

### Step 6 — Compose the brief

```
<Company> — Company brief

WHAT THEY DO
  - one sentence: who they sell to, what they sell, value claim.

FIRMOGRAPHICS
  - <industry> · <employee band> · <HQ geo> · founded <year> · <funding stage>

RECENT (last 30 days)
  - <strongest 1–3 signals, dated, source-cited> OR "no notable events"

POSITIONING ANGLE (for our outreach)
  - one sentence on how to frame this account.
```

End with a confidence line if the data was sparse.

### Step 7 — Tag what's durable

`swan-update-company` to log the firmographic frame and any new signals. The next play at this account inherits it.

## Rules

- MUST keep this brief. The full dossier facets live in their own sub-pages — route, don't merge them all here.
- MUST source-cite every claim. "They're a fintech" alone is not enough.
- NEVER pad with generic content from the homepage. The brief is about *this* company, not boilerplate.
- NEVER chain enrichment when Swan + CRM + free preview already answered the question.
- If a tool result is truncated, read the JSON from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code`.
