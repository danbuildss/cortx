---
title: TechStack
description: "Research sub-page for detected tools and platforms. Use to find replacement opportunities, integration angles, or competitor presence."
---

## Instructions

Targeted enrichment, not a full company brief. Combine with `Company` if you need broader context.

### Step 1 — Frame what you're looking for

Tech stacks are huge. Don't map "everything." Ask: which categories matter to the play?

- Marketing automation (HubSpot, Marketo, Pardot, Customer.io)
- CRM (Salesforce, HubSpot, Attio)
- Sales engagement (Outreach, Salesloft, Apollo, Lemlist)
- Analytics (Segment, Mixpanel, Amplitude, GA4)
- Data warehouse (Snowflake, BigQuery, Databricks)
- Frontend / hosting (Vercel, Netlify, AWS)

Pick the 2–3 categories that map to the user's value prop. Sweeping all of them wastes credits.

### Step 2 — Cheap signals first

In order, before paying for enrichment:

1. **Swan's company model** — `swan-search-companies` for the domain. Tech stack tags may already be present.
2. **Company memory** — `swan-get-memory` keyed to the company. Past research may have noted the stack.
3. **CRM custom properties** — if a CRM is connected, list custom properties on the company object. Tech-stack fields populated by prior tools often live there.

If any of these surface what you need, stop. The question is already answered.

### Step 3 — Job postings (highest-quality public signal)

`swan-fetch-scraped-url` on the careers page or LinkedIn jobs page. Job descriptions explicitly list tools the role will use. Most reliable public signal — companies don't lie about their stack in JDs.

Look at 2–3 active postings in relevant functions (Marketing, RevOps, Data, Engineering). Extract tool names mentioned in "requirements" or "stack" sections.

One pass per role family. Don't read every job posting.

### Step 4 — Website scripts and embedded tools

`swan-fetch-scraped-url` on the homepage and pricing page. Look for:

- Script tags pointing to known SaaS domains (`segment.com`, `hubspot.com`, `hsforms.net`, `analytics.js`, etc.)
- Embedded forms (HubSpot, Marketo, Pardot signatures)
- Chat widgets (Intercom, Drift, Crisp)
- Analytics pixels (Mixpanel, Amplitude, GA4)
- Trust badges or "powered by" links

For each detected tool, record: tool name + source URL + the script/element that proved it.

### Step 5 — LinkedIn engineering posts

`swan-linkedin-social-media-presence` on the company page. Engineering and product posts often name tools ("we just migrated to X," "our team uses Y for Z"). One pass, scan 30–90 days.

### Step 6 — When to enrich

`swan-enrich-company` will sometimes return technographic data from BuiltWith or similar sources. Use it only if Steps 3–5 left a gap and the user specifically needs that category mapped. Don't enrich just to "be thorough" — that's burning credits.

### Step 7 — Aggregate at scale

If profiling > 5 companies in one pass, switch to code:

> Use `swan-execute-code`. Dump the list of company domains. Batch `swan-fetch-scraped-url` calls via `output/actions.json` (≤ 50 per batch) to fetch homepages and careers pages. In the next code call, read all responses from `files/tool-outputs/`, parse with `beautifulsoup4`, regex for known SaaS script domains, build a DataFrame: `company × tool detected × source`. Print top tools by frequency and any per-company anomalies.

### Step 8 — Compose the output

For a single company:

```
<Company> — Tech stack signals

Detected
  - <Tool> (category) — source: <JD link / script tag / LinkedIn post>
  - ...

Not found in this category
  - <Category> — no public signal

Replacement opportunity
  - <one-line take on whether they run a competitor and what to do about it>
```

For multi-company:

```
Top tools across N companies
  - <Tool>: detected at X companies
  - ...

Companies running <competitor>: <list>
Companies with no detected solution in category: <list>
```

### Step 9 — Update Swan's company model

For each company profiled, `swan-update-company` to store the detected tools as tags. Prevents redoing the work next quarter.

## Rules

- MUST cite a source per tool detected. "They use Salesforce" alone is not a finding.
- NEVER report a tool detected without evidence. Inference from "they're enterprise" is not evidence.
- NEVER scan all stack categories — pick the 2–3 that matter to the play.
- If the careers page or homepage is bot-blocked and `swan-fetch-scraped-url` returns nothing useful, note the gap and move on. Don't retry endlessly.
- If a tool result is truncated, read the JSON in `swan-execute-code` from `files/tool-outputs/<toolName>_<callId>.json`.
