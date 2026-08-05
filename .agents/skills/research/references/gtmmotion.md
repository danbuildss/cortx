---
title: GTMmotion
description: "Research sub-page for how a company sells. Infers outbound, inbound, PLG, channel, or enterprise motion from public signals."
---

## Instructions

This is positioning intelligence, not company research. Run after the `Company` brief if you need firmographic context.

### Step 1 — What you're inferring

Answer:
1. **Who do they sell to?** SMB, mid-market, enterprise — and what verticals.
2. **How do they acquire?** Outbound, inbound, PLG, channel, events.
3. **Who closes?** Self-serve, AE-led, sales-assisted, account team.
4. **What's their pricing posture?** Public pricing, "talk to sales", freemium, usage-based.
5. **What's the rep org structure?** SDR/AE split, dedicated CSMs, RevOps maturity.

You won't get all of this. Get what's available, label what you can't infer.

### Step 2 — Pricing page = motion fingerprint

`swan-fetch-scraped-url` on `/pricing`. The page itself tells you most of what you need:

- **Public tiered pricing** → product-led or SMB/mid-market focus
- **"Contact us" only** → enterprise sales, custom pricing
- **Freemium / free trial up front** → PLG motion
- **"Book a demo" CTAs everywhere** → AE-led, gated acquisition
- **Usage-based / per-seat** → pricing tells you their value metric

No public pricing page is itself a signal: pure enterprise / sales-led.

### Step 3 — Homepage CTAs and primary path

`swan-fetch-scraped-url` on the homepage. Capture the top-of-page CTA:

- "Get started free" → PLG
- "Book a demo" → sales-led
- "Talk to sales" → enterprise
- "Start free trial" → PLG with self-serve conversion
- "Watch a tour" → top-of-funnel education, longer cycle

Note any case study companies featured prominently — that's their public customer mix. Sub-$50K ARR shape vs Fortune 500 logos tells you their target tier.

### Step 4 — Job postings reveal the rep org

`swan-fetch-scraped-url` on the careers page or a LinkedIn jobs search. Look at open sales roles in the last 60 days.

| Role pattern | Motion signal |
|--------------|---------------|
| SDR / BDR + AE openings | Outbound + inbound motion |
| AE only, no SDR | Mostly inbound; SDRs may be offshore |
| Enterprise AE | Top-down enterprise |
| Mid-market AE | Standardized sales process |
| Solutions Engineer openings | Technical sale, longer cycle |
| Sales Engineer + AE pairs | High-touch enterprise |
| Customer Success openings (heavy) | Land-and-expand emphasis |
| Channel / Partner Manager | Indirect sales motion |
| Growth Marketing / SEO / Performance | PLG / inbound emphasis |
| Demand Gen / Content / ABM | Sales-led, longer pipeline cycle |

Read 5–10 postings, not all of them. Patterns surface fast.

### Step 5 — LinkedIn company page signals

`swan-linkedin-social-media-presence` on the company page. Look at:

- What do their reps and execs post about? (customer wins, product launches, hiring, thought leadership)
- Do they post case studies? (land-and-expand emphasis)
- Public outbound posts? ("we just opened our SF office")
- Public hiring numbers? ("we just hired 20 SDRs" = aggressive outbound build)

### Step 6 — Tech stack as motion signal

If you've already run `TechStack`, the stack reveals motion:

| Detected tool | Motion signal |
|---------------|---------------|
| Outreach, Salesloft, Apollo, Lemlist | Active outbound |
| HubSpot Marketing Hub Pro / Enterprise | Inbound funnel maturity |
| Mutiny, Default, Demandbase | ABM / segmentation |
| Common Room, Pocus, Endgame | PLG signals on top of self-serve |
| Customer.io, Iterable | Lifecycle marketing → recurring revenue motion |
| Gainsight, Vitally, Catalyst | Mature CS function → retention focus |
| Pendo, Mixpanel, Amplitude | Product analytics → PLG signals |

### Step 7 — Compose the read

```
<Company> — GTM Motion

TARGET CUSTOMER
  - <ICP segment + size + vertical, evidence-backed>

ACQUISITION MOTION
  - <primary motion + secondary, evidence>

REP ORG (inferred)
  - <SDR+AE / AE-only / enterprise / channel + headcount estimate>

PRICING POSTURE
  - <public / private / freemium / usage-based, evidence>

WHAT THIS MEANS FOR US
  - <one paragraph on positioning angle and risk>
```

The "what this means" section is the value. Examples:
- "Pure PLG — pitch them as a tool that boosts product-led conversion, not as a sales-team enabler."
- "Enterprise sales-led with no outbound stack detected — strong candidate for outbound enablement."
- "Heavy CS hiring + mature retention stack — they care about expansion. Position retention/expansion features."

### Step 8 — Tag the account

`swan-update-company` with the inferred motion type. Future plays at this account inherit the context.

## Rules

- MUST cite evidence per inferred claim. "They run outbound" alone is not enough; "Outreach detected on pricing page + 4 SDR openings in last 60 days" is.
- NEVER force-fit a motion the evidence doesn't support. Some companies are mixed — say so.
- NEVER state a motion as fact when only weak signals are present. Use "looks like" / "likely" for hedge.
- If the company is fewer than 30 employees, most motion signals are noise. Note that and keep the read short.
- If a tool result is truncated, read from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code`.
