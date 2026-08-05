---
title: Financial
description: "Research sub-page for financial context. Covers funding, revenue indicators, ownership, growth signals, and runway pressure."
---

## Instructions

Don't run this for routine outreach — the `Company` brief is enough. Use this only when the financial angle is the lever.

### Step 1 — What you already have

Cheap first:

1. `swan-search-companies` — Swan's model may already have funding totals, last round, investors.
2. If a CRM is connected, search the CRM for the company — annual revenue and employee count are often in custom fields.
3. `swan-get-memory` for the company — prior briefs may have logged financial context.

If a recent prior brief covers this, use it. Don't redo work.

### Step 2 — Business events (funding history)

`swan-fetch-business-events` filtered to the company domain, event type funding, no time limit. Returns the full known fundraising history with amounts, dates, lead investors.

For each round, capture: stage + amount + date + lead investor. Most recent round matters most — that's their current runway and current valuation pressure.

### Step 3 — Firmographic enrichment

`swan-enrich-company` if Step 1 didn't have enough. Returns employee count, employee growth, industry, year founded. Skip if you already have the data — enrichment costs credits.

### Step 4 — Public revenue indicators

Private companies don't publish revenue. Public signals to infer from:

- **Headcount × industry avg revenue/employee** — rough ARR estimate. For SaaS, $200K–$400K per FTE is typical at scale.
- **Employee growth rate** — `swan-enrich-company` returns 6m/12m growth. Fast growth → recent revenue traction.
- **Funding stage vs age** — a 10-year-old seed-stage company is different from a 2-year-old Series B.
- **Press / earnings** — `swan-fetch-scraped-url` on Google for `"<company>" revenue OR ARR OR "growth rate"`. Founders and execs sometimes drop numbers in press or podcasts.

Run web search only for 1–2 highest-value targets. Skip for the rest.

### Step 5 — Ownership and structure

If the company is part of a larger entity (PE portfolio, subsidiary, public parent), that changes the buying motion entirely. Check:

- `swan-fetch-scraped-url` on the company's "about" / press section for parent mentions
- Funding rounds led by PE firms (Vista, Thoma Bravo, KKR, etc. — almost always means PE-portfolio)
- Recent acquisition events via `swan-fetch-business-events`

If PE-backed, note this prominently. The economic buyer may sit at the portfolio level.

### Step 6 — Runway / pressure signals

Combine the above into a runway and pressure read:

- Last raise + amount → rough runway at current burn (12–24 months typical)
- Headcount growth → spending into growth or holding tight?
- Recent layoffs via `swan-fetch-business-events`
- PE ownership stage → newer hold = invest mode, older hold = exit-prep mode

Three signals are enough to triangulate. Don't try to model their P&L.

### Step 7 — Position the angle

Tie the financial context back to the outreach. Common angles:

| Financial state | Likely buying motivation |
|----------------|--------------------------|
| Recent large round | Investing in growth — capacity tools, headcount-enabling software |
| Late-stage / pre-IPO | Efficiency, predictability, reporting maturity |
| PE-backed early hold | Top-line growth at scale |
| PE-backed late hold | Margin expansion, exit prep |
| Public / earnings pressure | Quarterly visibility, churn defense, efficiency |
| Recent layoffs | Do more with less, consolidation candidates |

Pick the one most relevant to the org's value prop.

### Step 8 — Compose the brief

```
<Company> — Financial context

CURRENT STAGE
  - <stage, total raised, last round date, lead investor>

GROWTH POSTURE
  - <one line: investing / holding / contracting, with evidence>

OWNERSHIP
  - <independent / PE-backed / public / subsidiary, with detail>

PRESSURE
  - <one line — what they're being measured on right now>

OUTREACH ANGLE
  - <one sentence connecting financial state to value prop>
```

End with confidence: high / medium / low based on signal density.

### Step 9 — Update the company model

`swan-update-company` to log: total raised, last round, growth posture, ownership type. Future briefs reuse this.

## Rules

- MUST cite a source for every financial claim. Inferred revenue must be labeled "est."
- NEVER state a revenue or ARR figure as fact for a private company unless it's from press or earnings.
- NEVER blow credits on web search for low-priority targets — pick the 1–2 worth deep digging.
- If the company is bootstrapped with no public footprint, note that and stop. There's no financial story to tell.
- If a tool result is truncated, read the file from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code`.
