---
title: CompetitorMentions
description: "Research sub-page for finding public mentions of a competitor. Use to surface pain language, switch intent, and displacement outreach angles."
---

## Instructions

This is prospecting research, not a campaign. After running, the user hands the output to the outreach skill for displacement drafting.

The output is sharper when the org has defined its ICP and logged its competitive landscape. Load the ICP segments and check org memory + competition knowledge for the competitor and any aliases. If no ICP is defined, the ICP-fit qualification in Step 7 will be impossible — tell the user the output will be unranked and recommend they sharpen their ICP before relying on this for outreach.

### Step 1 — Confirm the competitor name and aliases

Cheap step but critical. Competitors often have multiple names (parent + product, rebrands, abbreviations). Pull the org's competition notes via `swan-get-memory`. If aliases aren't logged, ask the user once: "Are there variant names or product names I should also search for?"

Build a short list: `["Acme", "AcmeIQ", "acme.io"]`.

### Step 2 — LinkedIn mention sweep

For each alias, run a search on LinkedIn via `swan-fetch-scraped-url` against Google with site filter: `site:linkedin.com/posts <alias>`. Pull the first 1–2 result pages.

For each result, classify in one pass:

- **Switching signal** — "we just migrated off X," "looking to replace X," "X isn't working for us"
- **Pain language** — complaints, frustrations, public asks for alternatives
- **Comparison shopping** — "X vs Y," "evaluating X"
- **Customer reference** — they currently use it (lower priority unless the play is displacement)
- **Noise** — competitor's own employees, fans, irrelevant context. Discard.

Slice size: 20 posts per pass. After each slice, summarize one line per signal-bearing post and drop the rest.

### Step 3 — Review site sweep

`swan-fetch-scraped-url` on G2, TrustRadius, or Capterra pages for the competitor. Look at the lowest-rated recent reviews (≤ 3 stars, last 90 days).

For each: reviewer's title + company + the specific complaint. Lowest-star recent reviews are switch-ready prospects.

One pass, ≤ 20 reviews. If the competitor has hundreds of recent negative reviews, that's a big opportunity — note it and let the user decide whether to run more sweeps.

### Step 4 — Podcast and content mention sweep

`swan-fetch-scraped-url` on a Google search like `"<competitor>" "switched to" OR "moved off" OR "replaced"`. Aim for 2–3 high-signal links: post-mortem blog posts, podcast transcripts, case studies of switchers.

Stop after 3 fetches if nothing surfaces.

### Step 5 — Job posting sweep (for ripping-and-replacing)

Companies hiring for "RevOps lead" or "Marketing Ops manager" with the competitor named in the JD's "current stack" section are mid-migration candidates. `swan-fetch-scraped-url` on a LinkedIn jobs search for the competitor name + relevant role family.

### Step 6 — Aggregate at scale

If across Steps 2–5 you've collected > 20 candidate mentions, switch to code:

> Use `swan-execute-code`. Dump the list of mentions (author name, company domain, signal class, quote, source URL) as a JSON file. With pandas, dedupe by company, rank by signal strength (switching > pain > comparison > customer > noise), filter to ICP-fit companies using firmographic checks against Swan's company model. Print top 20.

If staying small (< 20 candidates), score by hand.

### Step 7 — Qualify against ICP

For each top candidate, quickly verify ICP fit:
- `swan-search-companies` for the candidate's domain
- If not in the model, `swan-enrich-company` (only for top 10)

Drop any that don't match the org's ICP. The mention isn't useful if you can't sell to them.

### Step 8 — Compose the report

```
COMPETITOR MENTION SCAN — <Competitor>

Switching signals (highest priority)
  1. <Person, Title @ Company> — "<exact quote>" — <source>
     Fit: <ICP yes/no> — Next: <one-line action>
  2. ...

Pain language
  ...

Comparison shopping
  ...

Negative reviews
  ...

Hiring for migration
  ...

Scope of opportunity: <one line — e.g. "12 ICP-fit switching candidates surfaced this run">
```

### Step 9 — Hand off

For each top candidate, the next step is outreach with a displacement angle. The user takes the quoted mention as the personalization hook into the outreach skill. Don't draft messages here.

For accounts not in the CRM yet, optionally create the company in the CRM and tag with a competitor-mention tag using `swan-update-company`.

## Rules

- MUST quote the exact mention. "They complained about Acme" isn't a finding; "we're three months in and still can't get reporting working" is.
- MUST verify ICP fit before recommending action. Switching signal at a non-ICP account is noise.
- NEVER pad with low-signal mentions (current customers expressing satisfaction, employee posts).
- NEVER message based on a paraphrased mention — always reference the actual language the prospect used.
- If a tool result is truncated, read from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code` and aggregate with pandas.

GAP: a native LinkedIn post search tool would be more reliable than Google site-filter scraping. For now, `swan-fetch-scraped-url` + site filter is the workaround.
