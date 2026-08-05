# Campaign Group Structures, Naming, Bidding, Formats & Benchmarks

## Account Architecture

Organize campaigns into groups from the start. Even with only 2-3 campaigns, the group structure creates clean reporting and prevents scaling headaches later.

| Level | What It Contains | When to Create |
|-------|-----------------|----------------|
| Ad Account | All campaign groups, billing, Insight Tag | One per business entity (or region at scale) |
| Campaign Group | Related campaigns sharing a funnel stage or theme | When you have 2+ campaigns with a shared purpose |
| Campaign | One audience + one objective + one bid strategy | Each unique audience/objective combination |
| Ads | 4+ creatives per campaign minimum | Always - fewer than 4 limits algorithm optimization |

### Critical Structural Rules

| Rule | Detail |
|------|--------|
| Never mix prospecting and retargeting in the same group | Different funnel stages need separate budget control |
| One campaign objective per group | Do not mix reach and traffic objectives in the same group |
| Separate enterprise and SMB campaigns | Algorithm favors cheaper audiences - enterprise campaigns get starved if mixed |
| Do not mix ad formats in campaign group budgets | Static + video in one group sends 80%+ budget to video |
| LinkedIn does not allow moving campaigns between groups | You must duplicate campaigns to reorganize (losing historical data) |
| New audience segments get their own campaign | Never add new targeting to an existing campaign - contaminates performance data |

## 6 Campaign Group Structure Models

Choose the right structure based on account complexity. For new accounts, start with structures 1-4. Scale to Pick and Mix as the account grows.

### 1. Objective-Based Structure

Organize groups by campaign objective. Makes it easy to measure performance against goals.

| Group | Objective | Example Campaigns |
|-------|-----------|-------------------|
| Awareness | Brand Awareness, Video Views | Brand video campaigns, thought leadership |
| Engagement | Engagement, Website Visits | Content/blog promotion, resource downloads |
| Conversion | Lead Gen, Website Conversions | Demo requests, free trial signups |

**Best for:** Simple accounts with one product/audience, small budgets.

### 2. Audience-Based Structure

Segment groups by target audience. Best when you have diverse markets with different messaging needs.

| Segment Type | Example Groups |
|-------------|----------------|
| Demographic | VP+ Engineering, Director+ Marketing, C-Suite |
| Geographic | US - Marketing, UK - Product, DACH - Engineering |
| Interest-Based | AI/ML Practitioners, DevOps Community |

**Best for:** Companies targeting multiple distinct personas or regions with tailored messaging.

### 3. Funnel Stage Structure

Align groups with the buyer's journey. This is the approach most recommended across all sources.

| Group | Stage | Content Type |
|-------|-------|-------------|
| TOF - Problem Aware | Prospecting cold audiences | Educational content, pain-point validation |
| MOF - Solution Aware | Retargeting engaged users | Case studies, comparisons, demos |
| BOF - Product Aware | Retargeting high-intent | Direct CTA, social proof, Lead Gen Forms |

**Best for:** Most B2B SaaS accounts. This is the default recommendation.

### 4. Product or Service Line Structure

Organize around each product/service for focused messaging and better tracking.

| Segment Type | Example Groups |
|-------------|----------------|
| By Product/Service | Voice AI Platform, Contact Center Analytics |
| By Use Case | Outbound Calling, Inbound Support, Appointment Setting |

**Best for:** Multi-product companies or companies with distinct use cases.

### 5. Testing Structure

Dedicated groups for controlled experiments. Essential for optimizing performance over time.

| Test Type | What You're Testing |
|-----------|-------------------|
| A/B Creative Tests | Different creatives or messaging within the same audience |
| Audience Tests | Comparing performance across different audience segments |
| Offer Tests | Trialling different offers or CTAs to see what resonates |

**Best for:** Mature accounts with enough budget to allocate to experimentation.

### 6. Pick and Mix Structure (Advanced)

For large accounts at scale, combine elements from multiple structures into one unified approach.

**Group naming data points:** Region, Persona, Seniority, Company Size, Product Line, Objective

**Example:** `US | VP+ Engineering | Enterprise | Voice AI | TOF`

Each group contains multiple campaigns. This is the only way to manage campaigns at scale without losing control.

**Best for:** Accounts spending $10K+/month with multiple products, regions, and personas. For starters, structures 1-4 are enough.

## Naming Convention System

Consistent naming is critical for reporting, filtering, and management at scale.

### Campaign Group Naming

Two conventions in use. Choose based on how you're structuring:

**Convention A - Stage + Awareness (5-Stage Demand Engine template):**
Format: `[Region] - [Stage] - [Awareness] - [Type] - {Detail}`

Examples:
- `NA - Capture - Solution Aware - Prospecting - {Persona}`
- `NA - Capture - Product Aware - Remarketing (Offers)`
- `NA - Activate - Offer Aware - Remarketing (Free Users)`
- `NA - Revive - Offer Aware - Remarketing (Closed Lost)`

**Convention B - Product/Persona focused (simpler):**
Format: `[Region] | [Product/Persona] | [Funnel Stage]`

Examples:
- `US | Voice AI | TOF - Prospecting`
- `UK | Contact Center | MOF - Retargeting`
- `Global | Brand | BOF - Conversion`

Convention A is better for accounts using the 5-Stage Demand Engine model. Convention B is simpler for basic 3-layer funnels. Group naming should grow in layers as the account scales - add data points (content type, region, company size, audience segment) one at a time. The full layered progression is in the Scaling the Group Structure section below.

### Campaign Naming

Format: `[Audience Type] - [Targeting Detail] - [Objective]`

Examples:
- `Cold - VP+ Engineering - Engagement`
- `Retarget - Website Visitors 30d - Lead Gen`
- `Lookalike - Converted Users - Website Conversions`

### Ad Naming

Format: `[Persona]_[Format]_[Creative#]_[CopyVariant]_{Date}`

| Component | Example Values |
|-----------|---------------|
| Persona | SalesDirector, VPEngineering, CTO, CMO |
| Format | Image, Video, Carousel, Document, TLA |
| Number | 1, 2, 3 (creative variant number) |
| CopyVariant | TextA, TextB, TextC (copy version) |
| Date | 2026-02 (launch month) |

Examples:
- `SalesDirector_Image1_Text1_2024-01`
- `VP_Engineering_Video2_TextA_2024-02`
- `CTO_Carousel1_TextB_2024-03`

This naming system enables:
- Quick filtering by any dimension in Campaign Manager
- Clean data exports for reporting tools (Looker Studio, etc.)
- Easy identification of what's running and what needs rotation

## Budget Allocation by Monthly Spend

| Monthly Total Budget | Recommended Campaign Split |
|---------------------|---------------------------|
| $500 - $1,000 | 1-2 campaigns. Skip TOF, focus on highest-intent audience. |
| $1,000 - $2,500 | 2-3 campaigns. Light TOF + focused BOF. |
| $2,500 - $5,000 | Full 3-layer funnel. 3-5 campaigns. |
| $5,000 - $10,000 | Full funnel + creative testing. 5-7 campaigns. |
| $10,000 - $20,000 | Full funnel + niche campaigns + ABM. 7-10+ campaigns. |
| $20,000+ | Full funnel + multi-region + format testing. 10+ campaigns. |

## 7. The Five Campaign Groups (Advanced Scaling)

At scale, organize campaigns into five purpose-driven groups. This replaces the simple awareness/retargeting split when you have enough budget and campaigns.

| Group | Purpose | Content Type | Priority Order |
|-------|---------|-------------|----------------|
| Product Value | Showcase what your product does and why it matters | Product demos, feature highlights, use cases | 1st (start here) |
| Remarketing | Re-engage people who already interacted | Demo offers, case studies, testimonials | 2nd |
| Content | Drive traffic with valuable knowledge | Reports, guides, blog posts, educational content | 3rd |
| Social Proof | Build trust through third-party validation | Customer testimonials, case studies, awards, reviews | 4th |
| Thought Leadership | Build brand affinity through expertise | Founder insights, industry analysis, opinion pieces | 5th (add last) |

**Funnel mapping:**
- Awareness stage -> Thought Leadership + Product Value groups
- Consideration stage -> Content + Social Proof groups
- Conversion stage -> Remarketing group

**Priority order matters.** Start with Product Value and Remarketing - they drive the most direct revenue. Add Content and Social Proof as budget allows. Thought Leadership is the last group to add because it takes the longest to show ROI.

**Group-specific notes:**
- **Thought Leadership:** Can use LinkedIn influencer collaborations (content, podcasts, videos promoted to cold audiences) or internal employees. LinkedIn launched the TLA format in early 2023 specifically for this.
- **Content:** Critical rule - content ads should promote content that CANNOT be consumed in-feed on LinkedIn. The purpose is to drive users to your website. If the content can be fully consumed in the LinkedIn feed, it should be a Thought Leadership or Product Value ad instead.
- **Social Proof:** B2B buyers are skeptical and risk-averse. They don't want to pay thousands for an unknown product. Showcasing success stories with recognizable logos brings high-intent traffic.
- **Remarketing:** Captures demand from website visitors, ad engagers, company page visitors. Reduces friction in the sales funnel by re-engaging people at a more purchase-ready moment.

**Best for:** Accounts with 5+ campaigns and $5K+/month budget. Start with Product Value + Remarketing, add the others as budget grows.

## Splitting Campaigns by Type

Different campaign types (static, video, document, carousel, conversation, message ads) have different auctions on LinkedIn. Diversifying ad types is an auction strategy, not just a creative one.

**Key insight:** Static ads have the most competition. Document ads targeting the same audience will have less auction competition, leading to cheaper cost per reach.

**When to introduce a new campaign type:**
- Current campaign meeting/exceeding KPIs (audience is receptive, test more)
- Current campaign underperforming with no obvious issues (audience not receptive to format, try different)

**Campaign group budget option:** LinkedIn's campaign group budget lets the algorithm split budget between campaigns in a group. Caveat: LinkedIn favors video ads - you may see 80%+ of budget go to video when mixing static + video. For full budget control, use separate campaigns. See the Group Budget Optimization section below.

## Scaling the Group Structure

As you scale, group naming should evolve in layers:

**Level 1 - Persona + Intent:**
- `Marketing - Awareness`
- `Marketing - Remarketing`
- `Sales - Awareness`
- `Sales - Remarketing`

**Level 2 - Add campaign group type:**
- `Sales - Awareness - Product Value`
- `Sales - Awareness - Content`
- `Sales - Remarketing - Demo`
- `Sales - Remarketing - Case Studies`

**Level 3 - Add region:**
- `Sales - Awareness - EMEA - Content`

**Level 4 - Add company size:**
- `Sales - Awareness - Product Value - Enterprise`

**Level 5 - Add audience segment:**
- `Sales - Awareness - Product Value - Enterprise - Decision Makers`

Under each group: individual campaigns with different creative types (static, video, document campaigns).

**When to split groups:** Start right away. Even with only 4 campaigns, put them in separate groups by persona and intent. Waiting creates a mess where group-level metrics mask individual performance. One strong retargeting campaign can make the entire mixed group look healthy while awareness campaigns silently fail.

**Moving campaigns between groups:** LinkedIn doesn't allow it. You must duplicate the campaign (losing historical data). Short-term pain, long-term clarity.

---

## Bidding Strategy

### Bidding Options Overview

LinkedIn offers four bidding strategies. Each has a specific use case - choosing the wrong one wastes money.

| Bid Type | How It Works | Best For | Risk |
|----------|-------------|----------|------|
| Maximum Delivery (Automated) | LinkedIn optimizes to spend full budget at lowest cost | New campaigns, learning phase, small audiences | Low control, can overspend on poor clicks |
| Cost Cap | Sets a target cost per result - algorithm stays near that target | Lead gen forms, conversion campaigns with known CPL targets | May underspend if cap is too low |
| Manual CPC | You set the max CPC - LinkedIn bids up to that amount | Mature campaigns with CPC history, cost control | Requires monitoring, can underdeliver if bid is too low |
| Manual CPM | You set the max cost per 1,000 impressions | Brand awareness, video views, reach campaigns | No click optimization - pay for impressions regardless |

### Phase 1: Automated Bidding (Week 1)

Every new campaign starts with Maximum Delivery. This is non-negotiable.

| Rule | Detail |
|------|--------|
| Duration | Run automated for the full first week (7 days minimum) |
| Budget | Set daily budget at the level you plan to maintain long-term |
| Do not adjust | No bid changes, no audience tweaks, no creative swaps during this phase |
| Monitor only | Track CPCs, CTR, and spend pacing - do not intervene |
| Record baseline | Note the average CPC at end of week 1 - this is your transition number |

**Health signals during Phase 1:**
- **Healthy:** Spending 80-100% of daily budget with consistent CPCs
- **Warning:** Spending less than 50% of budget - audience may be too small or targeting too narrow
- **Red flag:** CPCs wildly inconsistent day to day - audience quality may be mixed

### Phase 2: Manual CPC Transition (Week 2+)

After week 1, switch to Manual CPC. This is where significant cost savings happen.

**The formula:**
```
Manual CPC Bid = Average CPC from Phase 1 x 0.80
```

Set your manual bid at 20% below your average CPC from the automated phase. This works in the vast majority of cases.

### Bid Adjustment Rules

| Scenario | Action | Adjustment |
|----------|--------|------------|
| Spending full budget, CPCs stable | Hold | No change needed |
| Spending full budget, CPCs rising | Lower bid by 5-10% | Prevents cost creep |
| Underspending (below 70% of budget) | Raise bid by 10-15% | Increase competitiveness |
| Severely underspending (below 40%) | Raise bid by 20-25% or return to automated | Audience may need higher bids |
| CTR declining while spend is stable | Refresh creative, not bid | Bidding is not the problem |
| CPCs consistently below bid | Lower bid to match actual CPCs + 10% buffer | You are overbidding |

### When NOT to Switch to Manual

| Scenario | Why | Keep |
|----------|-----|------|
| Small retargeting audiences (under 10K) | Manual bidding causes severe underdelivery | Automated permanently |
| ABM audiences (under 5K) | Too small for manual bid constraints | Automated permanently |
| Video views objective | Video views are typically cheap - manual adds little benefit | Automated or Manual CPM |
| New campaign objective change | Algorithm needs a fresh learning phase | Automated for week 1 again |

### Bid Strategy by Campaign Objective

| Objective | Phase 1 | Phase 2 | Notes |
|-----------|---------|---------|-------|
| Engagement (TOF) | Maximum Delivery | Manual CPC at 80% of avg | Optimize for lowest cost per engagement |
| Video Views (TOF) | Maximum Delivery | Stay automated or Manual CPM | Manual adds little benefit for video |
| Website Visits (MOF/BOF) | Maximum Delivery | Manual CPC at 80% of avg | Monitor CPC closely - can get expensive |
| Lead Gen Forms (BOF) | Cost Cap at target CPL | Manual CPC once you have data | Set cap at realistic CPL based on historical data |
| Conversions (BOF) | Maximum Delivery | Manual CPC for large audiences, keep automated for small | Conversion optimization needs volume to learn |

### Budget Pacing

LinkedIn's ad day starts at UTC midnight (8:00 PM Eastern). This affects budget distribution.

| Time Zone | LinkedIn Ad Day Starts |
|-----------|----------------------|
| UTC | 12:00 AM (midnight) |
| Eastern (ET) | 8:00 PM previous day |
| Pacific (PT) | 5:00 PM previous day |
| Central European (CET) | 1:00 AM |

**Recommended ad schedule:** Run ads 5:00 AM to 2:00 PM Eastern (peak professional engagement hours). Concentrating spend during peak hours delivers more efficient results than spreading budget across 24 hours.

### Budget Change Rules

| Change Type | Maximum Adjustment | Why |
|-------------|-------------------|-----|
| Daily budget increase | +20% at a time | Larger jumps destabilize the algorithm |
| Daily budget decrease | -20% at a time | Sharp cuts can crash delivery |
| Frequency of changes | Once per week maximum | Algorithm needs stability to optimize |
| Emergency pause | Acceptable anytime | Pausing does not hurt future performance |

### Ad Rotation Strategy

| Phase | Duration | Rotation Type | Purpose |
|-------|----------|--------------|---------|
| Launch | Days 1-7 | Even rotation (equal budget per ad) | Prevents premature winner selection |
| Optimization | Day 8+ | Auto rotation (algorithm favors winners) | Let LinkedIn push budget to top performers |
| Refresh | Every 3 months | Swap underperformers | Prevent creative fatigue |

When launching new ads within a campaign, start with even rotation so each ad gets equal budget. After 7-10 days, check the data to see which ads perform best, then switch to auto rotation so the algorithm optimizes delivery toward winners. This prevents the algorithm from prematurely picking a "winner" before enough data is collected.

### Budget-Constrained Rotation Trick

If budget is tight and you need to run 6 campaigns but can only afford $30/day each:

- **Set A (3 campaigns):** Run Monday, Wednesday, Friday
- **Set B (3 campaigns):** Run Tuesday, Thursday, Saturday

This gives each campaign a $30/day budget on active days while halving daily spend. Campaigns still build reach over time at a 3-day-per-week pace.

### Bidding Quick Reference - Decision Tree

```
New campaign?
  YES --> Maximum Delivery (automated) for week 1
  NO --> Has the campaign run for 7+ days?
    NO --> Keep automated, wait for data
    YES --> Is the audience under 10K?
      YES --> Keep automated permanently
      NO --> Switch to Manual CPC at 80% of average CPC
        Is it a lead gen campaign with a CPL target?
          YES --> Consider Cost Cap at target CPL
          NO --> Manual CPC is correct
```

### Key Bidding Numbers

| Number | What It Means |
|--------|--------------|
| 0.80 | Multiplier for Phase 1 to Phase 2 CPC transition (20% below average) |
| 20% | Maximum budget change in a single adjustment |
| 10K | Minimum audience size for manual bidding |
| 4 | Minimum active ads per campaign |
| 3 | Maximum frequency per week per person before rotation |
| 35% | Target audience penetration for healthy campaigns |
| 7 days | Minimum automated phase before switching to manual |
| 10 results/week | Minimum data threshold for meaningful optimization |

---

## Group Budget Optimization

LinkedIn's campaign group budget feature lets the algorithm allocate budget across campaigns within a group. Instead of setting individual campaign budgets, you set one budget at the campaign group level, and LinkedIn's algorithm splits it between campaigns based on performance.

**Note:** Campaign Groups on LinkedIn = Campaigns on Google. Campaigns on LinkedIn = Ad Groups on Google.

### Impact

| Metric | Group Budget | Individual Campaign Budget |
|--------|-------------|---------------------------|
| Cost per reach | Lower (roughly 10% cheaper) | Baseline |
| Audience penetration | Higher - the group penetrates its audience faster (nearly double in testing) | Baseline |
| In-platform metrics | Marginally better (~1%) | Baseline |

**Test findings:**
- In-platform metrics dipped initially across test accounts (algorithm learning period)
- After 4 weeks with historical data, cost per reach decreased by an average of 10%
- Audience penetration with group budget was nearly double that of original campaigns - one month of group budget can equal two months of campaign-level budget in penetration
- Sustained testing (2+ months): in-platform metrics got marginally better (~1%, not statistically significant); cost per reach remained consistently cheaper

### Group Budget Rules

- One objective per group - you cannot mix reach and traffic objectives under one group
- Do not mix audience tiers (enterprise gets starved if mixed with SMB - the algorithm favors the cheaper audience)
- Do not mix formats (80%+ budget goes to video if mixed with static)
- Be granular - separate by audience tier, format type, and objective

**Important caveat:** Group budget optimization tends to favor cheaper audiences. Non-enterprise campaigns often get the lion's share of budget because the audience is cheaper to reach, which can starve enterprise campaigns.

### Budget Approach for New Campaign Types

- **Given extra budget:** Start the new campaign at half the original campaign budget, increase in 2 weeks if performance is good ("smoke testing")
- **No extra budget:** Use the campaign group budget option, but expect LinkedIn to prioritize the cheapest campaign type (80%+ to video if mixing static + video)

---

## Ad Formats

### Format Performance Comparison

| Format | Auction Competition | CTR Range | CPC Range | Best Funnel Stage | When to Use |
|--------|-------------------|-----------|-----------|-------------------|-------------|
| Single Image | Highest | 0.35-0.50% | $8-$22 | All stages | Default workhorse, versatile |
| Thought Leader Ads | Lower | Higher than standard formats | $4-$8 | TOF + BOF | Priority format - add first |
| Video (10-30s) | Moderate | 0.20-0.35% | $6-$15 | TOF | Awareness, retargeting pool building |
| Document Ads | Lower | 0.40-0.60% | $5-$12 | TOF + MOF | Top-of-funnel value + nurture, less auction competition |
| Carousel | Moderate | ~0.30-0.45% | $7-$18 | MOF/BOF | Multi-point storytelling, feature showcases |
| Conversation Ads | Different auction (per-send) | 1-5% click rate | $8-$25 | MOF/BOF | Interactive engagement, events, ABM |
| Text Ads | Lowest | 0.02-0.05% | $3-$8 | Always-on | Ultra-cheap brand reinforcement |
| Spotlight Ads | Low | Low CTR | $4-$8 CPM | MOF | Much cheaper CPM than single image |

**Key insight:** Different formats compete in different auctions. Adding document ads targeting the same audience as your single image ads will have less auction competition, meaning cheaper cost per reach on the same audience.

### Document Ads

**Format specs:**

| Spec | Detail |
|------|--------|
| Slide dimensions | 1080 x 1080px (square) or 1080 x 1350px (portrait 4:5) |
| Recommended slide count | 5-7 slides for mid-funnel content |
| Maximum slide count | 10 slides (LinkedIn limit) |
| File format | PDF upload (each page becomes one slide) |
| File size limit | 100 MB maximum |
| Gating options | Gated (Lead Gen Form) or Ungated (free to swipe) |

**The 7-Slide Formula:**

| Slide | Role | Content |
|-------|------|---------|
| 1 | Hook | Strong headline + subtitle - this is your ad |
| 2-3 | Pain / Cost | What the audience is dealing with (different framing per segment) |
| 4 | Principle / Shift | The "aha" moment - a reframe that changes how they see the problem |
| 5 | Solution (Generic) | What any capable system needs (generic requirements) |
| 6 | Solution (Specific) | What your product uniquely delivers (unique differentiators) |
| 7 | CTA | Demo booking or next step - clean, minimal, brand-consistent |

**Critical rule:** Slides 5 and 6 must not be redundant. Slide 5 describes what any solution needs. Slide 6 describes what THIS product uniquely does. If both say the same thing with different words, merge or differentiate.

**Content types that work:**

| Content Type | Slide Count | Best For | Gated or Ungated |
|-------------|-------------|----------|-------------------|
| Industry reports | 7-10 | TOF awareness, thought leadership | Gated |
| How-to guides | 5-7 | MOF education, building trust | Ungated |
| Checklists | 5-6 | MOF/BOF practical value | Either |
| Case studies | 5-7 | BOF social proof, conversion | Ungated |
| Framework breakdowns | 5-7 | MOF positioning as expert | Ungated |
| Comparison guides | 5-7 | MOF/BOF differentiation | Gated or ungated |

**Design rules:**
- One lead-in sentence + one bullet list per slide (ideal density)
- Give key statistics a standalone visual break slide (big number, accent color, large type)
- Every slide needs a design note specifying hierarchy, colors, elements
- Provide two options for product slides: real UI screenshot or designed mockup
- Use flow diagrams over text descriptions for processes
- Post body: tease content, do not summarize (2-4 lines, create reason to swipe)

### Conversation Ads

**Format specs:**

| Spec | Detail |
|------|--------|
| Subject line | Max 60 characters - the ONLY thing prospects see before opening |
| Message body | Up to 8,000 characters per message |
| CTA buttons | Up to 5 total (1 mandatory "Not Interested" = 4 custom CTAs max) |
| Branching | Follow-up messages based on which CTA is clicked |
| Companion banner | 300 x 250px (desktop only), JPG/PNG, max 2 MB |
| Lead Gen Form | One per conversation (can be attached to any CTA) |
| Sender | Must be a real LinkedIn member (employee or partner) |

**Basic decision tree structure:**

```
Opening Message
  +-- CTA 1: "Yes, show me" --> Lead Gen Form or Scheduling Link
  +-- CTA 2: "Tell me more first" --> Second Message (USPs + social proof)
  |     +-- CTA 2a: "Ok, I'm in" --> Lead Gen Form
  |     +-- CTA 2b: "Send me a resource" --> Content download
  +-- CTA 3: "Not right now" --> Soft close + resource offer
  +-- "Not Interested" (mandatory) --> Conversation ends
```

**Decision tree rules:**
- Maximum 3 levels deep (more feels like a maze)
- Every branch must end somewhere useful (no dead ends)
- Put the primary action first (position 1)
- Include a soft exit ("Not right now" with a resource converts better than binary yes/no)
- Use action language: "Yes, let's do it" outperforms "Book a Demo"

**The Walkthrough Format (high-performing structure):**
1. Open with the pain (1-2 lines stating the specific problem)
2. Name the product as the solution (1 line)
3. Frame the demo as learning: "In a 20-minute walkthrough, I can show you:"
4. 3 specific bullets (what they will see - be concrete)
5. Personalized close: "Want to see if it's relevant for %COMPANYNAME%?"
6. Casual CTAs: "Yes, let's do it" / "Tell me more first" / "Not interested"

**Sender selection:**

| Sender Type | Effectiveness | When to Use |
|-------------|--------------|-------------|
| Founder / CEO | Highest trust and open rates | ABM campaigns, high-value accounts |
| VP / Director | High credibility | Industry-specific campaigns |
| Subject matter expert | High relevance | Technical audiences |
| SDR / junior rep | Low trust | Avoid unless prior interaction exists |

**Frequency rules:**
- Each member receives max one conversation ad per 30 days (platform-enforced)
- Use 2-3 senders to increase total send volume
- Minimum 1,000 members in target audience (LinkedIn requirement)

**When to use conversation ads:**
- ABM campaigns targeting named accounts
- Complex B2B buying journeys with multiple stakeholder paths
- Qualification before demo (branch logic separates ready-to-buy from researching)
- Event promotion with multiple sessions
- Retargeting warm audiences who engaged with content

**When NOT to use:**
- Single clear goal with one action (use Message Ads)
- Cold audiences with zero brand awareness (warm them up first)
- Budget under $2,000/month for this format (not enough data)

### Video Ads

| Spec | Recommendation |
|------|---------------|
| Length | 10-30 seconds for TOF, 1-2 minutes for MOF |
| Orientation | Horizontal (16:9) for highest view and completion rates |
| Hook | Must capture attention in first 3 seconds |
| Subtitles | Required - most users scroll with sound off |
| CTA | Clear end card with specific action (last 3-5 seconds) |

**Orientation performance:**
- Horizontal (16:9): Highest view rates and completion rates
- Vertical (9:16): Sub-3% completion rates - significantly worse on LinkedIn
- Square (1:1): Middle ground, works for mobile

### Single Image Ads

| Element | Spec |
|---------|------|
| Primary text | 60-120 characters ideal, 150 max before truncation |
| Headline (below image) | 70 characters max, CTA-focused |
| Description | 100 characters max |
| Image text | Less than 20% of image area (LinkedIn penalizes text-heavy images) |
| CTA button | Must match ad message and landing page |

### Text and Spotlight Ads

| Element | Text Ads | Spotlight Ads |
|---------|----------|---------------|
| Headline | 25 characters | 50 characters |
| Description | 75 characters | 70 characters |
| Image | 100 x 100px thumbnail | Company logo + member profile |
| CPM | $2-$6 (cheapest) | $4-$8 (much cheaper than single image) |
| Best use | Always-on brand presence | Always-on brand reinforcement |
| CTR expectation | 0.02-0.05% (low is normal) | Low CTR is normal |

### Format Scaling Priority

Add formats in this order when scaling:

| Priority | Format | Expected Impact |
|----------|--------|-----------------|
| 1 | Thought Leader Ads | Higher CTR, lowest CPC |
| 2 | Video (10-30s) | Builds retargeting pools, strong awareness |
| 3 | Document Ads | Less auction competition, strong for nurture |
| 4 | Carousel | Multi-point storytelling for MOF/BOF |
| 5 | Conversation Ads | Interactive format for specific CTAs and events |
| 6 | Text + Spotlight Ads | Ultra-low-cost brand reinforcement layer |

---

## Benchmarks

### CTR Benchmarks by Funnel Stage

LinkedIn reports two CTR metrics:
- **CTR (all)** - includes reactions, comments, profile clicks, post expansions
- **CTR to Landing Page (CTRTLP)** - only clicks that leave LinkedIn to your URL

Always use CTRTLP for apples-to-apples comparison.

| Funnel Stage | Audience Type | CTRTLP Range | Strong Performance |
|-------------|--------------|-------------|-------------------|
| TOF | Cold prospecting | 0.30-0.55% | Above 0.44% |
| MOF | Warm retargeting | 0.55-0.80% | Above 0.70% |
| BOF | High-intent retargeting | 0.80-1.30% | Above 1.00% |

Above 1.0% CTRTLP is genuinely strong.

### CPC Benchmarks by Format

| Ad Type | CPC Range |
|---------|-----------|
| Thought Leader Ads | $4-$8 |
| Text ads | $3-$8 |
| Document ads | $5-$12 |
| Video ads | $6-$15 |
| Carousel ads | $7-$18 |
| Single image | $8-$22+ |
| Conversation ads | $8-$25 |

### CPM Benchmarks by Format

| Ad Type | CPM Range |
|---------|-----------|
| Text ads | $2-$6 |
| Spotlight ads | $4-$8 |
| Thought Leader Ads | $20-$45 |
| Document ads | $20-$40 |
| Video ads | $25-$55 |
| Single image | $33-$65 |

### Cost Per Lead Benchmarks

| Metric | Range | Context |
|--------|-------|---------|
| Cost per engagement | $2-$5 | Below $3 is strong |
| Cost per Lead Gen Form completion | $15-$50 | Depends on offer and audience warmth |
| Cost per lead (Lead Gen Form) | $50-$200 | Standard B2B SaaS range |
| Cost per website form submission | $200-$500 | Higher friction than native forms |
| Cost per SQL | $200-$500+ | Depends on ACV and qualification |
| Cost per demo booked | $150-$400 | Varies by industry |

### Lead Gen Form Fill Rate

| Performance Level | Fill Rate |
|------------------|-----------|
| Below average | Under 8% |
| Average | 8-12% |
| Strong | 12-20% |
| Excellent | Above 20% |

### Benchmarks by Industry

| Industry | Avg CPC | Avg CPL | CPM Range | Competition |
|----------|---------|---------|-----------|-------------|
| SaaS / Software | $10-$20 | $80-$200 | $35-$60 | High |
| Financial Services | $12-$25 | $100-$300 | $40-$70 | Very High |
| Healthcare / Life Sciences | $15-$30 | $120-$350 | $45-$80 | High |
| Cybersecurity | $12-$22 | $100-$250 | $40-$65 | High |
| HR / Recruiting Tech | $8-$18 | $60-$180 | $30-$55 | Moderate |
| Marketing / AdTech | $8-$16 | $50-$150 | $28-$50 | Moderate |
| Manufacturing / Industrial | $10-$20 | $80-$220 | $35-$60 | Moderate |
| Education / EdTech | $6-$14 | $40-$120 | $25-$45 | Lower |
| Professional Services | $10-$22 | $90-$250 | $35-$65 | Moderate-High |

### Benchmarks by Company Size

| Company Size | CPC Multiplier | CPM Multiplier |
|-------------|---------------|---------------|
| 1-50 employees | 0.7x | 0.6x |
| 51-200 employees | 0.8x | 0.75x |
| 201-500 employees | 1.0x (baseline) | 1.0x |
| 501-1,000 employees | 1.2x | 1.15x |
| 1,001-5,000 employees | 1.4x | 1.3x |
| 5,001-10,000 employees | 1.6x | 1.5x |
| 10,001+ employees | 1.8-2.5x | 1.7-2.2x |

### Benchmarks by Geography

| Region | CPC Range | CPM Range | CPL Range |
|--------|-----------|-----------|-----------|
| United States | $10-$25 | $40-$75 | $80-$250 |
| United Kingdom | $8-$22 | $35-$65 | $75-$220 |
| Canada | $8-$20 | $30-$60 | $70-$200 |
| Australia / New Zealand | $8-$20 | $30-$60 | $70-$210 |
| Western Europe (DACH, Nordics) | $7-$18 | $30-$55 | $65-$200 |
| France / Southern Europe | $6-$15 | $25-$50 | $55-$180 |
| Middle East (UAE, Saudi) | $6-$18 | $25-$55 | $60-$180 |
| Eastern Europe | $4-$12 | $15-$35 | $35-$120 |
| Southeast Asia | $3-$10 | $12-$30 | $30-$100 |
| Latin America | $3-$12 | $10-$35 | $30-$120 |
| India | $2-$8 | $8-$25 | $20-$80 |

### Seasonal Patterns

| Quarter | Cost Trend | Notes |
|---------|-----------|-------|
| Q1 (Jan-Mar) | Lower costs | New budgets ramping. January cheapest. Good for testing. |
| Q2 (Apr-Jun) | Rising costs | Peak B2B buying season. Budget approvals, fiscal year spend. |
| Q3 (Jul-Sep) | Moderate dip | Summer slowdown. August cheapest summer month. Good for testing. |
| Q4 (Oct-Dec) | Highest costs | Year-end budget flush. Plan 20-40% higher CPMs vs Q1. |

**Weekly patterns:**
- Tuesday through Thursday: Peak engagement days
- Monday: Strong (professionals catch up on feeds)
- Friday: Moderate decline
- Saturday-Sunday: Lowest engagement but cheapest CPMs (can be cost-efficient for awareness)

**Launch timing:** Start new campaigns Tuesday or Wednesday to maximize initial learning during peak days.

### Video Ad Benchmarks

| Metric | Floor | Average | Strong |
|--------|-------|---------|--------|
| View rate (starts / impressions) | 25% | 35-45% | Above 40% |
| Completion rate (completions / starts) | 5% | 8-15% | Above 15% |
| Cost per 50% view | $5+ | $2-$4 | Below $2 |

### Conversation Ad Benchmarks

| Metric | Below Average | Average | Good | Excellent |
|--------|--------------|---------|------|-----------|
| Open rate | Below 30% | 30-40% | 40-50% | Above 50% |
| CTA click rate | Below 1.5% | 1.5-3% | 3-5% | Above 5% |
| Cost per send | Above $1.50 | $0.50-$1.50 | $0.30-$0.50 | Below $0.30 |
| Lead gen form completion | Below 5% | 5-10% | 10-20% | Above 20% |

### Document Ad Benchmarks

| Metric | Below Average | Average | Good | Excellent |
|--------|--------------|---------|------|-----------|
| Slide-through rate | Below 15% | 15-25% | 25-40% | Above 40% |
| CTR to landing page | Below 0.30% | 0.30-0.45% | 0.45-0.60% | Above 0.60% |
| Engagement rate | Below 1.0% | 1.0-2.0% | 2.0-3.5% | Above 3.5% |

### Key Ratios to Monitor

| Ratio | Healthy Range | What It Tells You |
|-------|--------------|-------------------|
| Engagement rate | Above 1.0% | Creative resonates with audience |
| CTRTLP / Engagement rate | Above 0.15 | People clicking through, not just engaging |
| Video view rate | Above 40% | Hook captures attention |
| Video completion rate | 8-15% | Content holds interest |
| Form fill rate | Above 8% | Offer-audience alignment |
| Frequency (monthly) | 2-5x | Balanced exposure |
| Audience penetration (30 days) | 25-35% | Budget adequacy |

### ROAS and Pipeline Context

Direct-response ROAS is not the right primary metric for LinkedIn. The platform drives pipeline through brand awareness over extended timeframes.

| Metric | Benchmark |
|--------|-----------|
| Direct ROAS (last-click) | Understates LinkedIn's real impact - misses influenced and assisted pipeline |
| Pipeline attribution window | 3-6 months |
| BOF conversion rate | Above 5% |
| Retargeting pool growth rate | 10-20% monthly (TOF doing its job) |

**Better metrics:** Pipeline influenced by LinkedIn touchpoints, cost per SQL, assisted conversions, brand search lift.

### Budget Planning Formulas

**Lead generation campaigns:**
```
Daily budget = Target CPL x Target leads per week / 7
Example: $150 CPL x 10 leads/week / 7 = $214/day
```

**Awareness campaigns:**
```
Daily budget = Target audience size x Target penetration / 1000 x CPM / 30
Example: 100,000 x 30% / 1000 x $45 / 30 = $45/day
```

**Minimum viable budget per campaign:**
```
Min daily budget = Target CPA x 10 results/week / 7
Example: $50 CPA x 10 / 7 = ~$72/day minimum
```

---

> By Ivan Falco - Frontal
