# Campaign Structure for B2B Meta Ads - High-ACV SaaS

How to structure Meta campaigns for B2B SaaS with $30K+ ACV. Covers the three phases (ABO to CBO to Advantage+), account architecture, offer logic by ACV, the 12-month scaling roadmap, budget allocation, settings, naming conventions, and exclusions.

---

## The Three Phases of Campaign Structure

Meta campaigns for B2B follow a strict progression. Each phase has a specific purpose. Do not skip phases.

### Phase 1: Audience Validation (ABO - Ad Set Budget)

**Purpose:** Determine which audience sources produce quality leads before spending on creative testing.

**When to use:** Starting Meta for the first time, launching a new offer, entering a new market segment.

**Structure:**
```
Campaign: [Product] - Prospecting - ABO - Audience Validation
-- Ad Set 1: 1% CRM Lookalike          [$X/day]
-- Ad Set 2: Third-Party Data (Primer)  [$X/day]
-- Ad Set 3: Interest + Job Titles      [$X/day]
-- Ad Set 4: Broad Targeting            [$X/day]
   -- Same 3-4 ads in every ad set (isolate the audience variable)
```

**Critical settings:**
- **Use Ad Set Budget (ABO), NOT CBO** - guarantees each audience gets dedicated budget. CBO would let Meta shift budget away from expensive-but-quality audiences.
- Same ads across all ad sets - you are testing audiences, not creative
- Equal budgets per ad set for fair comparison
- Run for 2-4 weeks minimum
- Turn off Advantage+ audience expansion - click "Further limit the reach" and select your specific audience per ad set

**Validation criteria (check in CRM, not Ads Manager):**

| Criteria | What to Check | Why It Matters |
|---|---|---|
| **Job title match** | Do leads match your ICP titles? | Bad titles = wrong audience |
| **Company match** | Do companies match target firmographics? | Right person at wrong company is still wrong |
| **Lead-to-MQL rate** | What percentage of leads qualify? | Raw CPL means nothing without quality |
| **Cost per qualified lead** | Spend divided by MQLs, not raw leads | This is your real CPA |
| **Pipeline rate** | Are these leads becoming opportunities? | Ultimate validation of audience quality |
| **Quality score from sales calls** | How sales rates lead fit | Direct read on lead quality |

**After validation:**
- Kill ad sets producing low-quality leads (even if CPL is cheap)
- Take winning audience(s) to Phase 2
- Document what worked and what did not

**Alternative (simpler test for smaller budgets):** Two ad sets only - open/broad targeting vs interest-based. After 2-4 weeks, compare which brings better results. Use the winner going forward.

### Phase 2: Creative Scaling (CBO - Campaign Budget Optimization)

**Purpose:** Scale winning audiences through creative concept testing.

**When to use:** After validating audience quality in Phase 1.

**Structure (Option A - by concept):**
```
Campaign: [Product] - Prospecting - CBO - [Winning Audience]
-- Ad Set 1: UGC Concept                [CBO distributes budget]
   -- 3-4 UGC variations
-- Ad Set 2: Before/After Concept
   -- 3-4 Before/After variations
-- Ad Set 3: Problem/Solution Concept
   -- 3-4 Problem/Solution variations
```

**Structure (Option B - by batch):**
```
Campaign: [Product] - Prospecting - CBO - [Winning Audience]
-- Ad Set 1: Creative Batch 1 (mix of concepts)
-- Ad Set 2: Creative Batch 2 (iterations from Batch 1 winners)
-- Ad Set 3: Creative Batch 3 (double down on winners)
```

**Critical settings:**
- Use **Campaign Budget Optimization (CBO)** - let Meta shift budget to winning creative concepts
- Target only the validated winning audience from Phase 1
- Give each batch/concept 7-10 days minimum before judging
- When a concept wins, create more variations of that concept
- When a concept dies, replace with a dramatically different concept

**Transition trigger to Phase 3:** Once you have 50+ conversions/week consistently with a proven offer and audience.

### Phase 3: Automated Scaling (Advantage+)

**Purpose:** Maximum scale with full automation.

**When to use:** Proven offer, proven audience, strong tracking (Pixel + CAPI), 50+ conversions/week.

**Structure:**
```
Campaign: [Product] - Advantage+ Leads
-- Ad Set: Broad with audience suggestions
   -- 5-10 proven creative assets + new test variations
   -- Advantage+ Creative enabled
```

**Settings:**
- Campaign objective: Leads
- Advantage+ Audience ON (provide custom audiences and lookalikes as suggestions - not hard limits)
- Campaign Budget Optimization (automatic)
- Work email validation + SMS verification on lead form
- 3-5+ creative variations minimum

**Important:** Most B2B SaaS with $30K+ ACV will not reach Phase 3 quickly. That is fine. Phase 2 (CBO) with validated audiences and strong creative is where most B2B companies will operate long-term.

---

## The Recommended Account Architecture

For a B2B SaaS running full-funnel Meta:

```
-- Campaign 1: Remarketing (Start Here - Month 1)
   -- Ad Set: Website visitors (30/90/180 day)
   -- Ad Set: Video viewers (50%+)
   -- Ad Set: Cross-channel UTM retargeting
   -- Budget: $20-50/day (small audience)
   -- Objective: Leads or Conversions

-- Campaign 2: Prospecting - ABO (Testing - Month 2-3)
   -- Ad Set: 1% CRM Lookalike
   -- Ad Set: Third-party data audience
   -- Ad Set: Interest + Job Titles
   -- Budget: Equal per ad set
   -- Objective: Leads

-- Campaign 3: Prospecting - CBO or Advantage+ (Scaling - Month 3+)
   -- Ad Set: Winning audience from testing
   -- Multiple creative concepts
   -- Budget: Main prospecting budget here
   -- Objective: Leads or Conversions

-- Campaign 4: ABM (If Applicable - Month 4+)
   -- Ad Set: Tier A accounts
   -- Ad Set: Tier B accounts
   -- Budget: ABO (control per tier)
   -- Objective: Awareness or Video Views

-- Campaign 5: Acceleration (If Applicable - Month 4+)
   -- Ad Set: Open pipeline (high-value)
   -- Ad Set: Stalled deals
   -- Budget: ABO
   -- Objective: Awareness
```

---

## Offer Logic by ACV Tier

How you structure campaigns changes with deal size. As ACV increases, Meta's role shifts from a conversion channel to an influence channel.

| Segment | ACV | Cold Offer | Warm Offer | Hot Offer | Meta's Role |
|---|---|---|---|---|---|
| **SMB** | $5-15K | Free trial, quick guide | Product tour, case study | Demo, sign up | Can drive full funnel |
| **Mid-Market** | $15-50K | Benchmark report, calculator, webinar | Comparison guide, workshop | Strategy session, custom assessment | Education + retargeting |
| **Enterprise** | $50-250K+ | Industry report, executive briefing | Detailed case studies, product tours | Custom ROI analysis, pilot | Awareness + remarketing only |

**Key rule:** You cannot sell a $30K+ contract from a cold Meta ad. You sell the click. The landing page sells the next step. The next step sells the meeting. The meeting sells the deal. For enterprise, Meta creates awareness and stays top-of-mind while the conversion happens through sales-led motions.

---

## The 12-Month Roadmap: Build in This Order

| Phase | Timeline | Focus | Budget Split |
|---|---|---|---|
| **1. Remarketing** | Month 1 | Prove Meta works for your brand. Cross-channel retargeting. | $500-2,000/month |
| **2. Audience Validation** | Month 2-3 | ABO testing of audience sources. Find which produce quality leads. | $2,000-5,000/month |
| **3. Creative Scaling** | Month 3-6 | CBO with winning audiences. Test creative concepts at volume. | $5,000-15,000/month |
| **4. Scaling + ABM** | Month 4-12 | Advantage+ for broad. Manual for ABM. Acceleration campaigns. | $10,000-30,000/month |
| **5. Expansion** | Month 12+ | Expand beyond top 5% of in-market buyers. Story-based ads for colder audiences. | $20,000+/month |

### Why Start with Remarketing (Month 1)

- Lowest risk, highest ROI
- People already know you - just stay top of mind
- Cross-channel remarketing amplifies existing LinkedIn/Google investment
- Small budget required (audience is small)
- Proves Meta works for your brand before committing prospecting budget
- Creates the "they're everywhere" perception with minimal spend

### Month 2-3: Prospecting (Audience Validation to Creative Scaling)
- Phase 1: ABO audience validation (2-4 weeks)
- Phase 2: CBO creative scaling on winning audiences
- This is where the majority of budget eventually goes
- Score ads against revenue quality (not vanity metrics) to find true top ads

### Month 4+: Scaling + ABM + Acceleration
- Phase 3: Advantage+ for proven offers (if 50+ conversions/week)
- Add ABM campaigns if running LinkedIn ABM
- Add acceleration campaigns against open pipeline (if applicable)

### Month 12+: Expansion
After ~12 months of focused prospecting, your top 5% of in-market buyers will either be customers or know about you. Next stage:
- Expand outside top 5% in-market buyers
- Repeat validation process for new, colder audiences
- Story-based ads work well for prospects who are not actively looking
- Message shifts from "solve your problem now" to "here's what companies like yours are doing"

---

## Budget Allocation and Scaling

### Budget Formula

```
Minimum Daily Budget = (Target CPA x 50 conversions) / 7 days
```

| Target CPA | Minimum Daily Budget | Monthly Budget |
|---|---|---|
| $20 | $143/day | $4,300/month |
| $50 | $357/day | $10,700/month |
| $100 | $714/day | $21,400/month |

### Minimum Budget Requirements

| Campaign Type | Minimum Monthly | Why |
|---|---|---|
| **Remarketing** | $500-1,500 | Small audience, low CPMs |
| **Prospecting (ABO testing)** | $2,000-5,000 | Need equal budgets per ad set for fair comparison |
| **Prospecting (CBO scaling)** | $5,000-15,000 | Algorithm needs budget to optimize creative |
| **Advantage+** | $5,000+ | Requires volume to exit learning phase |
| **ABM** | $3,000+ | Minimum to reach target accounts with meaningful frequency |

### Budget Reallocation Signals

| Signal | Action |
|---|---|
| Ad set hitting target CPA with strong quality | Increase ~20% per step maximum (bigger jumps reset the learning phase); every 3-5 days once stable, or ~20% per week on low-volume B2B |
| Ad set at 2x+ target CPA after 30 days | Decrease budget, investigate root cause |
| Audience exhausted (frequency above 4.0) | Refresh creative or expand audience |
| One audience producing 3x better quality | Shift budget from weak audiences to strong |
| Learning phase not exiting after 2 weeks | Consolidate ad sets, increase budget, or optimize for upper-funnel event |

### Cross-Channel Budget Split (When Running Multiple Platforms)

| Total Budget | Recommended Split | Notes |
|---|---|---|
| **$5K-10K/month** | 100% one channel | Pick highest-impact channel, do not spread thin |
| **$10K-25K/month** | 60-70% primary + 30-40% secondary | Example: 70% LinkedIn + 30% Meta remarketing |
| **$25K-50K/month** | 3 channels | Example: 40% LinkedIn + 35% Google + 25% Meta |
| **$50K+/month** | Full mix + testing | All channels active + experimentation budget |

---

## Key Campaign Settings Reference

### Optimization Events

| Event | When to Use | Min Volume Needed |
|-------|-----------|-------------------|
| **Lead** | Lead form submissions, demo requests | 50/week per ad set |
| **Landing Page Views** | Low conversion volume, need more events for learning | 50/week per ad set |
| **CompleteRegistration** | Webinar signups, trial signups | 50/week per ad set |
| **Custom: MQL** | Sending qualified lead events via CAPI | 50/week per ad set |
| **Custom: Opportunity** | Sending pipeline events via CAPI (advanced) | Lower volume OK if pipeline-focused |

**The 50-event threshold:** Meta needs 50 optimization events per ad set per week to exit learning phase. If you cannot hit 50 demos/week, optimize for a higher-volume event (lead form submissions, landing page views) and retarget converters toward demos.

---

## Cross-Channel Remarketing

Retarget traffic from validated channels (LinkedIn, Google) on Meta at lower cost:

1. Run ads on LinkedIn - traffic lands on website with LinkedIn UTMs
2. In Meta: Audiences - Create - Custom Audience - Website - URL contains `utm_source=linkedin`
3. Retarget your LinkedIn-validated audience on Meta at 50-70% lower CPM
4. Same works for Google traffic: `utm_source=google&utm_medium=cpc`

**Why it works:** LinkedIn's precision targeting validates who the right people are. Meta's cheap retargeting keeps you in front of them. Result: LinkedIn-quality audience at Meta-level costs.

**Requires:** Sufficient traffic volume from those channels to build a usable audience size.

---

## Campaign Naming Conventions

### Standard Format

```
[Product] - [Campaign Type] - [Budget Type] - [Audience/Detail]
```

### Components

| Element | Options | Examples |
|---|---|---|
| **Product** | Product or brand name | LeadRouter, DataSync, AcmeCRM |
| **Campaign Type** | Prospecting, Remarketing, ABM, Acceleration | Prospecting |
| **Budget Type** | ABO, CBO, ASC (Advantage+ Shopping/Leads) | CBO |
| **Audience/Detail** | Audience source or specific detail | 1% CRM Lookalike, Website 90d, Tier A Accounts |

### Campaign Name Examples

```
LeadRouter - Prospecting - ABO - Audience Validation
LeadRouter - Prospecting - CBO - 1% CRM Lookalike
LeadRouter - Remarketing - CBO - Website 90d
LeadRouter - Remarketing - CBO - Cross-Channel UTM
LeadRouter - ABM - ABO - Tier A Accounts
LeadRouter - ABM - ABO - Tier B Accounts
LeadRouter - Acceleration - ABO - Open Pipeline
LeadRouter - Advantage+ Leads - Broad
```

### Ad Set Naming

```
[Audience Source] - [Targeting Detail]
```

**Examples:**
- `CRM Lookalike 1% - Closed Won Customers`
- `Primer - VP Marketing SaaS 200-500`
- `Interest - B2B Marketing + SaaS`
- `Broad - US 25-65`
- `Website Visitors - 90 Day`
- `Video Viewers - 50%+ Completion`

### Ad Naming

```
[Format] - [Concept] - [Offer] - [Date]
```

**Examples:**
- `Static - Problem/Solution - Benchmark Report - Jan2026`
- `Video - UGC Testimonial - ROI Calculator - Feb2026`
- `Carousel - Before/After - Webinar Invite - Mar2026`

---

## Exclusion Strategy

Always exclude from prospecting campaigns:

- **Closed-won customers** (waste of prospecting budget)
- **Recent converters** (7-30 day suppression after form fill)
- **Employees and internal traffic** (skews data)
- **Disqualified accounts from CRM** (already vetted and rejected)

This keeps attribution clean, prevents budget waste, and focuses spend on accounts that matter.

---

## What to Avoid

| Mistake | Why It Hurts |
|---|---|
| **Mixing ABM and broad prospecting in one campaign** | Completely different targeting logic - separate them |
| **Running CBO during audience validation** | CBO shifts budget to cheapest audience, not best quality |
| **Changing campaign settings during learning phase** | Any significant edit resets the 50-conversion counter |
| **More than 5-6 ad sets per campaign** | Dilutes signal, slows learning |
| **Optimizing for Link Clicks** | Vanity metric - optimize for leads or conversions |
| **Launching campaigns on Friday** | Weekend has lower B2B engagement, wastes initial learning budget |
| **No conversion tracking before launch** | Flying blind - install Meta Pixel + CAPI first |
| **Judging campaigns before 2 weeks of data** | Algorithm needs time to learn - do not panic-pause |

---

> By Ivan Falco - Frontal
