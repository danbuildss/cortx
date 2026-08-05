---
title: Domain
description: "Research sub-page for domain and digital footprint analysis. Use for traffic, content, SEO, paid mix, and web presence signals."
---

## Instructions

Lightweight by design. Combine with `GTMmotion` for the full GTM picture.

### Step 1 — Pull traffic data

`swan-website-traffic` for the domain. Returns SEMrush-style metrics: monthly visits, organic share, paid share, top organic keywords, top traffic-driving pages, traffic trend.

If the company is small or niche, traffic data may be sparse or unavailable. Note that and move on — don't burn fetches trying to compensate.

### Step 2 — Classify scale

Use traffic volume to anchor the rest of the analysis:

| Monthly visits | Likely posture |
|----------------|----------------|
| < 5K | Pre-scale, founder-led marketing, sales-led acquisition |
| 5K – 50K | Building marketing function, mixed motion |
| 50K – 500K | Established demand-gen, content + SEO investment |
| 500K – 5M | Mature inbound machine, dedicated growth team |
| > 5M | Brand-scale, likely PLG or massive paid spend |

This single number anchors everything else.

### Step 3 — Top pages reveal what works

From the traffic payload, look at the top 10 organic landing pages. Categorize:

- **Homepage + product pages** dominating → brand-led traffic
- **Blog content** dominating → content/SEO machine
- **Comparison pages** ("X vs Y") → bottom-of-funnel SEO investment
- **Glossary / definition pages** → top-of-funnel SEO play
- **Tool pages / free calculators** → PLG funnel into product
- **Case study pages** → trust-driven conversion

The top pages tell you what their content team prioritizes — and what's working.

### Step 4 — Keyword posture

Top organic keywords from the traffic payload. Look at:

- **Branded vs non-branded** — high non-branded share = real SEO investment
- **Category keywords** — ranking for the category they sell in? If not, big SEO gap
- **Competitor keywords** — ranking for competitor names? Suggests displacement strategy
- **Long-tail vs head** — long-tail dominance = content scale; head dominance = brand-driven

One paragraph summary. Don't dump all 100 keywords.

### Step 5 — Content depth check

`swan-fetch-scraped-url` on `<domain>/blog` or `<domain>/resources`. Quick read on:

- Publishing cadence (weekly, monthly, dead?)
- Content type (long-form thought leadership, short SEO posts, product updates)
- Author depth (single founder writing, content team, guest contributors)

Stop after one fetch. You're checking maturity, not auditing the blog.

### Step 6 — Paid posture

From the traffic payload, paid share matters:

- **0–5% paid** → organic-first, low ad investment
- **5–20% paid** → balanced, performance team in place
- **20–50% paid** → paid-led, heavy spend on demand-gen
- **> 50% paid** → ads-dependent, vulnerable to CAC inflation

High paid share is an inferable budget signal — they're spending on growth and may be open to tools that reduce CAC or improve conversion.

### Step 7 — Trend matters more than absolute

A site at 100K visits/mo going from 200K is a different conversation than one going from 50K. From the traffic payload, look at 6m or 12m trend:

- **Up sharply** → growing investment, momentum to ride
- **Flat** → plateau or limit of current strategy
- **Down sharply** → algorithm hit, team turnover, real opportunity for refresh

### Step 8 — Compose the read

```
<Domain> — Digital Footprint

SCALE
  - <monthly visits>, <trend over 6m/12m>

ACQUISITION MIX
  - <organic / paid / direct split>

WHAT'S WORKING
  - <top organic pages and what they reveal>

GAPS
  - <missing keyword categories, weak content, paid-dependent>

WHAT THIS MEANS
  - <one paragraph on positioning angle>
```

### Step 9 — Use in qualification

`swan-update-company` with the scale tier. For SEO/martech sales, a sub-5K-visits company is unlikely to need enterprise marketing tooling; a 5M-visits company likely already has the basics covered and you'll need to position against incumbents.

## Rules

- MUST cite the metric source. Don't say "they get lots of traffic" — say "120K monthly visits per `swan-website-traffic`."
- NEVER state traffic figures as absolute truth; SEMrush is an estimate. Use "approx" or "est" for precision claims.
- NEVER run this on companies that obviously don't have a web presence (very early-stage or pure offline). Note and skip.
- If `swan-website-traffic` returns no usable data, say so plainly and stop. Don't pivot to web scraping to manufacture metrics.
- If a tool result is truncated, read the JSON from `files/tool-outputs/swan-website-traffic_<callId>.json` in `swan-execute-code`.
