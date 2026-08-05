---
name: "account-selection-framework"
title: Account selection framework
description: "Use this skill when building, scoring, or managing a target account list for ABM — reverse-engineering how many accounts you need from revenue targets, ICP fit scoring, tiering, list staging, and ongoing list hygiene."
category: ABM
---

# Account Selection - Framework

How to build, score, stage, and manage target account lists for ABM campaigns.

---

## The Account Selection Principle

ABM starts with accounts, not leads. You're choosing *who* to pursue before anything else. Every dollar of ad spend and every BDR hour gets concentrated on accounts that actually fit your ICP.

**The math matters:** To close $1M in ARR from ABM with a $50K ACV, 25% close rate, and 75% qualification rate, you need ~3,250 target accounts in your campaigns (working backwards through stage conversion benchmarks).

---

## How Many Accounts Do You Need?

### Reverse-Engineering from Revenue Target

```
Revenue Target ÷ ACV = Deals Needed
Deals ÷ Close Rate ÷ Qualification Rate ÷ Considering Rate ÷ Interested Rate ÷ Aware Rate
= Total Target Accounts
```

**Example:**

```
$1,000,000 ÷ $50,000 = 20 deals
20 ÷ 0.25 ÷ 0.75 ÷ 0.20 ÷ 0.30 ÷ 0.55 = ~3,250 accounts
```

### Stage Conversion Benchmarks (ABX Benchmarks)

| Stage | Definition | Conversion to Next |
|---|---|---|
| **Identified** | All accounts targeted in campaign | 55% become Aware |
| **Aware** | 50+ ad impressions | 30% become Interested |
| **Interested/Engaged** | 5+ ad clicks OR 10+ engagements | 20% become Considering |
| **Considering** | Booked a demo / signed up for trial | Close rate applies |
| **Selecting** | Open deal in pipeline | Win rate applies |

**The headline number:** across these stages, roughly **2.5% of targeted accounts convert to pipeline** (an open, qualified opportunity) and about 0.6% close. So a ~3,250-account program produces ~80 opportunities and ~20 deals at a $50K deal size.

---

## Account Selection Criteria

### Layer 1: Firmographic Fit

| Criteria | Example | Source |
|---|---|---|
| **Company Size** | SMB (50-500) or Mid-Market (500-2000) | Clay, Apollo, LinkedIn |
| **Revenue** | $5M+ annual revenue or comparable funding | Clay, Crunchbase |
| **Industry** | Digital-first (SaaS, eCommerce, EdTech, FinTech, HealthTech) | Clay, LinkedIn |
| **Location** | USA, Canada, Australia, NZ, Ireland, Israel, Western/Northern Europe | Clay, Apollo |
| **Business Model** | Product-led growth, B2B SaaS | Manual + Clay enrichment |

### Layer 2: Technographic Indicators

| Criteria | What It Signals | Source |
|---|---|---|
| Currently using a competitor | Active buyer in category | BuiltWith, HG Insights, Clay |
| Using competitor lacking your key feature | Upgrade opportunity | BuiltWith + manual analysis |
| Using redundant tool combo | Consolidation opportunity | BuiltWith |
| Recently changed tech stack | Active buying window | BuiltWith, 6sense |

### Layer 3: CRM Intelligence

| Criteria | What It Signals | Source |
|---|---|---|
| **Closed-Lost (past 6-12 months)** | Had the problem, bad timing/price | CRM export |
| **Lost to competitor (missing feature you now have)** | Re-engagement opportunity | CRM closed-lost reason field |
| **Previously engaged outbound (didn't convert)** | Aware of you, recycle into ABM | CRM + outbound logs |
| **Churned customers** | Circumstances may have changed | CRM churn data |

### Layer 4: Lookalike Modeling

Build lookalikes from your best customers:
1. Export top enterprise/growth customers from CRM
2. Identify shared attributes (industry, size, tech stack, funding stage)
3. Use Clay to find similar companies that match the pattern
4. Cross-reference with BuiltWith for technographic match

---

## List Building Process

### Step-by-Step

```
1. Define ICP criteria (firmographic + technographic)
   → Use win-loss analysis from CRM to identify patterns

2. Build initial account list
   → Clay + BuiltWith API for technographic targeting
   → Apollo for firmographic + contact discovery
   → CRM export for recycled/closed-lost accounts

3. Enrich accounts
   → Clay enrichment (revenue, tech stack, funding, headcount)
   → BuiltWith for technology detection
   → ICP scoring (0-100)

4. Score and tier
   → A-tier (80-100): Perfect fit + strong signals
   → B-tier (60-79): Good fit
   → C-tier (40-59): Okay fit - maybe for 1:many only
   → D-tier (<40): Exclude

5. Import to CRM (HubSpot)
   → Create company records
   → Set ABM Campaign Name property
   → Set ABM Stage = "Identified"
   → Add to ABM campaign active list

6. Sync to LinkedIn Campaign Manager
   → Push company lists from HubSpot to LinkedIn
   → Filter by persona using LinkedIn's native targeting
   → Wait ~48 hours for audience to be ready
   → Minimum 300 LinkedIn members required to start a campaign
```

### Tools for List Building

| Tool | Role | Notes |
|---|---|---|
| **Clay** | Primary enrichment + list building | Firmographics, technographics, ICP scoring |
| **BuiltWith** | Technographic detection | API integration with Clay for tech stack data |
| **Apollo** | Contact discovery + firmographics | Used for initial contact lists for matched audiences |
| **HubSpot** | CRM + audience management | Lists, workflows, audience sync to LinkedIn |
| **LinkedIn Campaign Manager** | Ad targeting | Native persona filters on company lists |
| **Crunchbase** | Funding data | For funding-based targeting |

---

## Account Scoring Model

### Keep It Simple

**Critical lesson from real ABM programs:** Teams that overcomplicate scoring by adding website visits, page-level intent signals, and weighted scores across multiple data sources struggle to execute because:

- Website visitor de-anonymization is unreliable (in one test, a de-anonymization tool identified only 1 company out of 300 visitors - itself)
- Complex scoring models break in practice

**What actually works:** Use **quantitative ad engagement data from LinkedIn** pushed to CRM, plus **qualitative campaign engagement data** for personalizing outreach.

### Recommended Scoring Approach

| Data Type | How It's Used | Source |
|---|---|---|
| **Quantitative** | Impressions, engagements, clicks → stage progression | LinkedIn → ZenABM/Fibbler → HubSpot |
| **Qualitative** | Which campaigns they engaged with → intent detection | LinkedIn → ZenABM → HubSpot company properties |

### Stage Thresholds

| Stage | Threshold | Content Shown |
|---|---|---|
| **Identified** | Added to campaign list | - |
| **Aware** | 50+ ad impressions | Awareness content ads |
| **Interested** | 5+ ad clicks OR 10+ engagements | Solution-oriented ads |
| **Considering** | Booked demo / signed up for trial | Product-oriented ads + BDR outreach |
| **Selecting** | Open deal in CRM | Personalized sales engagement |

---

## HubSpot Configuration for ABM

### Company Properties to Create

| Property | Type | Purpose |
|---|---|---|
| `ABM Campaign Name` | Dropdown (custom) | Which ABM campaign the account belongs to |
| `ABM Stage` | Dropdown (custom) | Identified / Aware / Interested / Considering / Selecting |
| `LinkedIn Ad Engagements - 7d` | Number (custom) | Rolling 7-day engagement count (from ZenABM/Fibbler) |
| `LinkedIn Ad Engagements - 30d` | Number (custom) | Rolling 30-day engagement count |
| `LinkedIn Ad Engagements - 90d` | Number (custom) | Rolling 90-day engagement count |
| `LinkedIn Ad Clicks - 7d` | Number (custom) | Rolling 7-day click count |
| `LinkedIn Ad Clicks - 30d` | Number (custom) | Rolling 30-day click count |
| `LinkedIn Ad Clicks - 90d` | Number (custom) | Rolling 90-day click count |
| `ABM Intent` | Multi-checkbox (custom) | Which intents detected (from campaign engagement) |
| `ICP Score` | Number (custom) | 0-100 firmographic/technographic fit |
| `ICP Tier` | Dropdown (custom) | A/B/C/D |

### Active Lists Setup

Create separate active lists for each stage of each campaign:
- `[Campaign Name] - Identified` (ICP score ≥ threshold, ABM Campaign = X)
- `[Campaign Name] - Aware` (cumulative impressions ≥ 50)
- `[Campaign Name] - Interested` (cumulative clicks ≥ 5 OR engagements ≥ 10)
- `[Campaign Name] - Considering` (demo booked OR trial signup)
- `[Campaign Name] - Selecting` (deal stage = open)

### Workflow: Stage Progression

```
Trigger: Company property "LinkedIn Ad Clicks - 30d" changes

IF Clicks ≥ 5 AND ABM Stage = "Aware":
  → Update ABM Stage = "Interested"
  → Remove from Aware LinkedIn audience
  → Add to Interested LinkedIn audience
  → Trigger BDR notification workflow

IF Impressions ≥ 50 AND ABM Stage = "Identified":
  → Update ABM Stage = "Aware"
  → Content changes automatically via audience list updates
```

---

## Account Engagement Tracking Tools

| Tool | What It Does | Cost | Key Feature |
|---|---|---|---|
| **ZenABM** | Pushes LinkedIn engagement data + intent to CRM, account scoring, ABM stage management, analytics dashboards | ~$59/mo+ | Bi-directional CRM sync, qualitative + quantitative data, auto-updates ABM stages |
| **Fibbler** | Pushes LinkedIn ad engagement data to CRM | Lower cost | Quantitative engagement data (impressions, clicks, engagements) per account |
| **Factors.ai** | Account identification + engagement tracking | $$ | Impression capping per account, cross-channel attribution |
| **HubSpot (native)** | CRM + workflow automation | Included | Lists, workflows, audience sync - but no native LinkedIn engagement push (as of early 2025) |

**Note:** As of early 2025, HubSpot cannot natively pull company-level engagement data from LinkedIn Campaign Manager. You need a connector tool (ZenABM, Fibbler, or custom API).

---

## Campaign Duration and Pacing

| Parameter | Recommendation |
|---|---|
| **Campaign duration** | 12 weeks (3 months) per campaign |
| **Monitoring cadence** | Weekly account stage progression vs. benchmarks |
| **When to assess** | Pipeline per $ spent becomes meaningful after week 6-8 |
| **Pipeline expectation** | $10+ in pipeline per $1 ad spend = healthy |
| **When to adjust** | If stage progression falls below 50% of benchmark after week 4 |

---

## Illustrative Program Economics

The figures below are illustrative of a well-run program. They show the shape of ABM economics over time rather than a guaranteed result.

### First Campaign (roughly 90 days)

| Metric | Illustrative Result |
|---|---|
| Accounts touched | ~1,400 |
| Total cost | ~$52K (ads + tools) |
| Pipeline generated | ~$655K |
| Pipeline per $ spent | ~$12 |
| Team | ~4.5 FTE |

### Mature Program (cumulative, 12-18 months)

| Metric | Illustrative Result |
|---|---|
| Accounts touched | ~26,000 |
| Total LinkedIn ad spend | ~$490K |
| Pipeline generated | ~$5.3M |
| Pipeline per $ spent | ~$11 |
| ROAS (Closed Won) | ~2x |
| Team | ~4.5 FTE |

**Versus cold outbound:** a mature ABM program typically reaches the same pipeline faster and at a lower cost than cold outbound alone.

---

> By Ivan Falco - Frontal
