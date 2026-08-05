# Bidding Strategy & Weekly Optimization

## Bidding Approach

### Phase 1: Automated (Week 1 of any new campaign)

Start every new campaign with automated/maximum delivery bidding. This lets LinkedIn's algorithm learn who engages and at what cost. Don't touch bids during this phase.

### Phase 2: Manual (Week 2+)

After week 1, switch to manual CPC bidding at **20% below your average CPC** from the automated phase. This works ~99% of the time for significant CPC reductions.

### Exceptions

- **Small retargeting/ABM audiences:** Keep automated bidding - manual bidding on tiny audiences causes underdelivery
- **New campaign objectives:** Reset to automated for the first week when changing objectives
- **Undersized audiences (<10K):** May not spend full budgets regardless of bid amounts

### Bid Strategy by Objective

| Objective | Recommended Bid Type | Notes |
|-----------|---------------------|-------|
| Engagement (TOF) | Start automated, switch manual | Optimize for lowest cost per engagement |
| Video Views (TOF) | Automated usually fine | Video views are typically cheap on LinkedIn |
| Website Visits (MOF/BOF) | Start automated, switch manual | Monitor CPC closely |
| Lead Gen Forms (BOF) | Cost cap or manual | Set cap at target CPL |
| Conversions (BOF) | Automated for small audiences, manual for large | Depends on audience size |

## Weekly Optimization Checklist

Most advertisers underestimate the power of weekly demographic audits. Do this every week:

### Step 1: Check Demographics Report

Open Campaign Manager, Demographics tab for each active campaign. Review:
- **Job Title:** Are irrelevant titles consuming budget? Exclude them.
- **Job Function:** Aligned with ICP?
- **Seniority:** Any unpaid/training/entry slipping through? Exclude.
- **Industry:** Are off-target industries showing up? Exclude the ones with impressions but no engagement.
- **Company Size:** Aligned with target?
- **Company Name:** Any competitors showing up? Exclude.

**The job function approach:** If using job function + seniority targeting (instead of specific titles), treat the demographics report like a negative keyword list. Exclude every irrelevant title that shows up. After 6-8 weeks, the noise stops.

### Step 2: Review Performance Metrics

| Metric | Check | Action if failing |
|--------|-------|-------------------|
| CTR (TOF) | Above 0.44% avg? | Refresh creative or widen audience |
| CTR (BOF) | Above 3-5%? | Strengthen CTA or tighten retargeting |
| CPE | Below $5? | Good. Above $5 = review targeting |
| Frequency | Below 3/week per person? | Above 3 = rotate creative or expand audience |
| Audience penetration | Above 10% in first 2 weeks? | Below 10% = audience too large or budget too low |
| Spend pacing | Spending full daily budget? | Underspending = audience too small or bid too low |

### Step 3: Creative Health

- Any ad running for 3+ months? Refresh it
- Are there 4+ active ads per campaign? If not, add more
- Check for creative fatigue: declining CTR over 2+ weeks, rotate
- **Ad rotation scheduling:** New ads should start with even rotation (equal budget per ad). After 7-10 days of data, switch to auto rotation so the algorithm favors winners. This prevents premature "winner" selection before enough data is collected.

### Step 4: Budget Reallocation

- Shift budget from underperforming campaigns to outperformers
- Don't make more than 20% budget changes at once (algorithm needs stability)
- If a campaign has less than 10 results/week, it lacks enough data to optimize

### Step 5: Check Audience Penetration

Review audience penetration data to determine if budgets need adjusting:

| Timeframe | Penetration Threshold | Action |
|-----------|----------------------|--------|
| 30 days | Below 25% of audience | Increase budget |
| 60 days | Below 40% of audience | Increase budget |
| Target | 35%+ penetration | Healthy - maintain |

**Key insight:** Doubling budget typically boosts penetration by 50-70%, not 100%. One well-budgeted campaign at 35%+ penetration outperforms three underfunded campaigns at 12% each.

## Demographic Audit Process (Monthly Deep Dive)

Beyond the weekly demographic check, run a deep audit monthly.

**1. Company Demographics**

| Dimension | Look For | Action |
|---|---|---|
| Company name | Top spenders that are competitors or existing customers | Exclude immediately |
| Company size | Budget going to wrong company sizes | Exclude off-target sizes |
| Industry | Non-ICP industries eating budget | Exclude low-engagement industries |

**2. Professional Demographics**

| Dimension | Look For | Action |
|---|---|---|
| Job title | Titles with high spend but zero conversions | Exclude them |
| Job function | Functions that don't match ICP | Exclude or create separate campaigns |
| Seniority | Entry-level, training, unpaid consuming budget | Exclude from all campaigns |

**3. Geography (if multi-region)**

| Dimension | Look For | Action |
|---|---|---|
| Country/Region | Expensive regions with low conversion rates | Split into separate campaigns or exclude |
| Cost disparities | US CPCs 2-3x higher than EMEA | Set separate budgets per region |

### The Negative Title List

When using job function targeting, build a running exclusion list.

**Common irrelevant titles that consume B2B SaaS budget:**
- Regional Managers, Branch Managers
- Call Center Supervisors, Customer Service Reps
- Fashion Designers, Interior Designers (if targeting "design" function)
- Telemarketers, Retail Associates
- Teachers, Professors (if targeting "training" function)

Add to exclusions weekly. After 6-8 weeks of consistent exclusions, the noise drops significantly.

## Campaign Group Budget Optimization

LinkedIn's group budget feature lets the algorithm allocate budget across campaigns within a group instead of setting individual campaign budgets.

### Test Results

| Metric | Group Budget | Campaign Budget |
|--------|-------------|----------------|
| Cost per reach | ~10% cheaper | Baseline |
| Audience penetration | Nearly 2x higher | Baseline |
| In-platform metrics (CTR, engagement) | Marginally better (~1%) | Baseline |

**Key finding:** One month's audience penetration with group budget = two months' audience penetration without. The algorithm is better at distributing spend for maximum reach.

### Caveats

- **One objective per group** - can't mix reach + traffic objectives
- **Algorithm favors cheaper audiences** - non-enterprise campaigns get the lion's share of budget in mixed groups
- **Video bias** - if mixing static + video in one group, 80%+ budget may go to video
- **Recommendation:** Be as granular as possible. Don't mix enterprise + SMB campaigns, or static + video campaigns, in the same group

### When to Use Group Budget

| Scenario | Use Group Budget? |
|---|---|
| All campaigns in group target same audience type | Yes |
| Mix of enterprise and SMB campaigns | No - algorithm starves the expensive enterprise audience |
| Mix of static and video campaigns | No - 80%+ budget goes to video (cheaper) |
| All campaigns share one objective | Yes |
| Campaigns have different objectives | No - one objective per group required |

### Budget Approach for New Campaign Types

- **Given extra budget:** Start new campaign at half the original campaign budget, increase in 2 weeks if performance is good ("smoke testing")
- **No extra budget:** Use campaign group budget option, but expect LinkedIn to prioritize the cheapest campaign type

## Budget Allocation and Reallocation

### Budget Allocation by Funnel Stage

| Stage | Budget Share | Objective |
|---|---|---|
| **TOF (Cold Awareness)** | 30-50% | Build brand, fill retargeting pool |
| **MOF (Retargeting/Nurture)** | 18-25% | Build trust, deepen engagement |
| **BOF (Conversion)** | 20-30% | Drive demos, trials, conversions |

**Key insight:** Product Aware retargeting often gets the single biggest budget allocation - larger than either TOF stage. Once someone knows you, the highest-ROI move is converting that awareness into pipeline.

### Budget Reallocation Cadence

| Frequency | What to Adjust |
|---|---|
| **Weekly** | Shift 10-20% between campaigns based on performance |
| **Bi-weekly** | Assess campaign group budget splits |
| **Monthly** | Full budget review - reallocate between funnel stages |
| **Quarterly** | Strategic budget review - persona and region allocation |

## Ad Scheduling and Rotation Tactics

### LinkedIn Ad Scheduling

LinkedIn's ad day starts at UTC midnight, which is 8:00 PM Eastern. This matters for budget pacing and scheduling.

**Recommended schedule:** Run ads from 5:00 AM to 2:00 PM Eastern (business hours when professionals are most active on LinkedIn). Pause during afternoons and evenings when engagement drops and CPMs remain high.

**Why this works:** LinkedIn's algorithm resets daily budget at UTC midnight. By concentrating spend during peak engagement hours, you get more efficient delivery than spreading budget across 24 hours where much of it is wasted on low-engagement times.

### Ad Rotation Trick for Budget-Limited Accounts

If budget is tight and you need to run 6 campaigns but can only afford $30/day each:

- **Set A (3 campaigns):** Run Monday, Wednesday, Friday
- **Set B (3 campaigns):** Run Tuesday, Thursday, Saturday

This gives each campaign a $30/day budget on its active days, costing $30/day total instead of $60/day to run all six simultaneously. The campaigns still build reach over time, just at a 3-day-per-week pace instead of 7.

**When to use:** Budget-constrained accounts that need to test multiple audiences or creative approaches without doubling their daily spend.

## Sales Alignment and Lead Feedback

### Monthly Sales Alignment Meeting

Hold a monthly meeting between the ads team and sales to review:
- Which leads from LinkedIn are converting into pipeline
- Lead quality feedback by campaign and creative
- Which personas and messages are generating the best conversations
- Upcoming product launches or events to coordinate with ad campaigns

### Automated Lead Alerts via Slack

Set up real-time lead notifications using Zapier (or similar automation):
- When a new lead comes in from LinkedIn Lead Gen Forms, send to dedicated Slack channel
- Include key fields: company name, job title, form responses
- Sales team gives thumbs up (good lead) or thumbs down (bad lead) emoji reactions
- Track thumbs up/down ratio per campaign to measure lead quality over time

This creates a continuous feedback loop between paid ads and sales without requiring manual reporting.

## Bi-Weekly Review (Every Other Friday)

- Campaign group performance review
- Ad format mix assessment - shift budget to best-performing formats
- Review retargeting pool sizes - is TOF feeding the funnel?

## Monthly Review

- Review full-month ROAS and conversion data
- Assess strategic shifts needed
- Check retargeting pool growth (is TOF feeding the funnel?)
- Evaluate if audience segments need expanding or contracting
- Plan next month's creative rotation
- Full demographic audit (deep dive) - see Demographic Audit Process above
- Budget-to-persona alignment check
- Pipeline per $ spent calculation
- Pipeline attribution review with sales team

## Quarterly Review

- Full performance audit across the account
- Strategy evaluation: is the funnel structure still right?
- Benchmark comparison: are we above/below industry?
- Budget planning for next quarter
- ICP refinement based on conversion data

---

> By Ivan Falco - Frontal
