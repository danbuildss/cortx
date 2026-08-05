# Meta Creative System - B2B SaaS

The complete, standalone system for B2B Meta creative: what to build, when to build it, how to iterate, how to validate against revenue quality, and when to retire it. Covers creative strategy, the production pipeline, testing methodology, message validation, and fatigue management.

---

## Key Terms

Several parts of this system reference a two-campaign account structure:

- **Testing Campaign** - receives ~20% of total budget. Every new concept and iteration launches here first.
- **Scaling Campaign** - receives ~80% of total budget. Only proven ads (graduated from testing) run here.
- **TCPL** - Target Cost Per (qualified) Lead. The economic threshold the whole system optimizes toward.
- **Graduation** - an ad moves from Testing to Scaling only after it passes both evaluation stages (delivery + quality) and meets all graduation criteria (see Testing Protocol).

---

## Core Principle: Creative IS Targeting

Creative is the #1 variable for Meta Ads success in B2B. Post-Andromeda (Meta's ad delivery engine), creative does double duty: it is both your ad AND your targeting signal. The algorithm processes creative - copy, images, video transcripts, carousels - and uses it as the primary signal for who to serve your ads to. Targeting inputs are suggestions; creative is the real filter.

**What this means in practice:**
- The people who engage with your ads signal to the algorithm who to find more of
- If your creative attracts the wrong people, the algorithm optimizes for the wrong audience
- If your creative is specific enough to repel non-ICP and attract ICP, the algorithm becomes your best targeting tool

Directionally, creative now accounts for the majority of what drives Meta ad performance - more than targeting or bidding.

**Your creative is your targeting. Your hook is your filter. Your iteration velocity determines your scaling ceiling.**

---

## Buyer Situation Mapping (Before Creating Any Ads)

Before touching design tools or writing copy, list 15-25 buyer situations your ICP faces. Each situation becomes a unique creative angle.

### Example: B2B Cash Flow SaaS ($30K+ ACV)

1. CFO who just took over a multi-entity company and has no visibility across subsidiaries
2. Finance director spending 3 days every month compiling cash position reports
3. Treasury manager forecasting cash flow in spreadsheets across 5 bank accounts
4. Controller who discovered a cash shortfall only after missing a payment deadline
5. VP Finance whose board is demanding real-time cash visibility next quarter
6. CFO dealing with foreign currency exposure across multiple regions
7. Finance leader whose team manually reconciles bank statements every morning
8. Controller at a PE-backed company being asked for daily cash position reports
9. Treasurer managing liquidity across 10+ legal entities with no central view
10. Finance director who lost a week reconciling intercompany transfers

### Example: B2B CRM SaaS ($30K+ ACV)

1. Founder who just raised Series A and needs to professionalize sales
2. VP Sales fighting data hygiene problems across their team
3. Sales leader whose reps spend 40% of time on manual data entry
4. CRO frustrated by pipeline reporting that takes 3 days to compile
5. Revenue leader being asked by the board for better forecasting
6. Sales manager whose team switched CRMs twice in two years
7. VP Ops losing deals because notes aren't captured after calls
8. CMO who can't prove marketing's pipeline contribution
9. Sales director managing 20+ reps with no visibility into activity
10. CFO asking why sales tools cost $200K/year but pipeline is still unpredictable

**Why 15-25:** Most B2B companies test 3-4 generic concepts. The winners test 15+ specific situations and find the 2-3 that resonate with the top 5% of in-market buyers.

### Where to Source Buyer Situations (Priority Order)

| Source | Method | Quality Signal |
|--------|--------|----------------|
| Organic content winners | Audit LinkedIn/blog/webinar content from the last 12 months. High engagement = validated message. | Market already told you it works |
| Customer interviews | "What triggered your search?" "What almost stopped you?" "What surprised you?" | Direct from ICP |
| Sales call recordings | Objections, "aha" moments, specific pain language | Real buyer language |
| Support tickets | Problems driving upgrades or churn | Active pain points |
| Meta Ad Library | Search competitors. Ads running 3+ months = likely profitable. Note angles and formats, not exact creative. | Competitor-validated |
| Community discussions | What your ICP complains about, asks about, celebrates on LinkedIn, Slack groups, forums | Authentic community language |

---

## The Hook-First Approach

The hook (first 3 seconds of video, first line of copy) is the single highest-leverage creative variable. Most viewers decide in the first few seconds whether to engage - the hook determines who stays, and therefore who the algorithm reaches next.

### Iteration Priority Hierarchy

When iterating on a winning ad, change elements in this order. Each element has decreasing impact on performance.

| Priority | Element | Impact | Reasoning |
|----------|---------|--------|-----------|
| 1 | **Hook** (first 3s / first line) | Highest | Most viewers decide in the first few seconds whether to engage. Changing the hook changes who your ad reaches - the single highest-leverage variable. Changing the hook on a winning concept can extend its lifespan by 2-4 weeks. |
| 2 | **Visual treatment** | High | Human faces tend to lift engagement. 4:5 aspect ratio generally delivers higher CTR and lower CPA than square or landscape. The visual is what stops the scroll. |
| 3 | **Format** (static/video/carousel/UGC) | Medium | Format determines the consumption pattern. Format change reads as a "new ad" to the algorithm. |
| 4 | **Body copy / CTA** | Lower | Once someone is hooked, body copy matters less than the initial capture. CTA changes produce marginal differences unless the CTA is fundamentally mismatched. |

### Why Hook-First

- Most people bounce if not captured in the first 3 seconds (video) or 1-2 seconds (static)
- Target hook rate: 20-25% (people who watch past 3 seconds / total impressions)
- Hook rate below 15% = the ad will never perform, regardless of body quality
- Changing the hook on a winning concept can buy an extra 2-4 weeks of life

### Hook Types That Work for B2B

| Hook Type | Example | When to Use |
|-----------|---------|-------------|
| **Provocative question** | "Why are 73% of CFOs still using spreadsheets for cash flow?" | Challenge assumptions |
| **Specific pain** | "Your finance team spends 15 hours/week on manual reconciliation." | Name the pain directly |
| **Counterintuitive claim** | "The best ERPs are making your cash flow worse." | Pattern interrupt |
| **Social proof lead** | "[Company] cut their close time from 14 days to 3." | Authority and proof |
| **Number-first** | Lead with specifics. Numbers in headlines tend to improve CTR. | Data-driven audiences |

---

## Creative as Targeting: The Mosquito Repellent Principle

When running broader audiences (especially post-Andromeda), your creative must do the targeting:

- Name the job role: "For B2B marketing leaders managing $100K+ in ad spend"
- Name the company type: "SaaS companies with 50-500 employees"
- Name the specific problem: "Tired of manually qualifying every inbound lead?"
- Use industry-specific language only your ICP understands
- Show product UI that only your ICP would recognize as relevant

**The test:** If someone outside your ICP sees the ad, would they immediately scroll past? If yes, your creative targeting is working. The goal is to be "mosquito repellent" for non-ICP.

---

## Creative Concept Types

Test dramatically different concepts, not micro-variations. Testing blue vs green buttons or a slightly different headline produces marginal gains and wastes budget. Each concept below is a fundamentally different approach to communicating value.

| Concept Type | Description | Best For | Iteration Potential |
|--------------|-------------|----------|---------------------|
| **Problem/Solution** | Name specific pain, show the fix | Cold traffic, problem-aware | High - many pain points to explore |
| **Before/After** | Show the transformation | Visual products, clear outcomes | Medium |
| **UGC/Founder Video** | Customer or founder talking naturally | Trust building, cold audiences | High - different people |
| **Meme/Humor** | Industry-specific humor | Pattern interrupt, cold audiences | Low - hard to iterate |
| **Data/Statistics** | Lead with a compelling stat | Authority building | Medium - different stats |
| **Testimonial** | Real customer quote with photo/video | Social proof, warm audiences | High - different customers |
| **Case Study** | "[Company] achieved [specific result]" | Proof of concept, warm audiences | High - different companies |
| **Comparison** | Your solution vs status quo or competitors | Solution-aware, competitive markets | Medium |

### Creative Angles by Funnel Stage

**Prospecting (Cold Audiences)**
- Problem/solution hooks naming specific pain
- Industry-specific stats or benchmarks
- "How [Company Type] solves [Specific Problem]"
- Founder/CEO talking directly to camera (B2B UGC)
- Counterintuitive takes that challenge conventional wisdom

**Remarketing (Warm Audiences)**
- Case studies with specific metrics ("43% reduction in churn")
- Customer testimonials (video or quote cards)
- Demo walkthroughs showing the product solving their problem
- Social proof (logos, G2 ratings, customer count)
- Direct CTA: "You visited our pricing page - ready to see a demo?"

**Pipeline Acceleration (Open Opportunities)**
- Competitive comparison content
- ROI calculators or value assessments
- Customer success stories from similar companies/industries
- Product announcements or new features
- Executive thought leadership (builds trust during evaluation)

---

## The Three Pillars of Creative

Every ad must pass three tests before it goes live.

### 1. Messaging - Does the Copy Drive Action?

**"Sell the click, not the product."** You are not selling a $30K contract in an ad. You are selling the click. The landing page sells the next step. Each step only needs to earn the NEXT step.

Urgency and motivation are the two most underused levers in B2B Meta ads. Create urgency through specificity:
- Bad: "How to Get Started with LinkedIn Ads" - optional, no urgency
- Good: "How to Fix Your LinkedIn Ads ROAS in the Next 60 Days" - urgent, specific, motivated

The more specific you narrow in on a problem, the more urgency you create by proxy.

### 2. Design - Does the Design Support the Message?

The biggest creative mistake on Meta: design that does not support the message. Beautiful ads that make no sense - the visual says one thing, the copy says another.

- The visual must reinforce the copy's message, not just look good
- Optimize for placement size - 1080x1080 in a 9:16 Story placement looks terrible
- Build creative versions for each major placement: Feed (1:1 or 4:5), Stories/Reels (9:16)
- Legibility test: can someone understand the message in 2 seconds while scrolling?
- Pattern interrupts beat polished designs - the job is to stop the scroll

### 3. Analysis - Is the Concept Working?

Do not just look at metrics - understand WHY:
- High CTR + low lead quality = creative is attracting the wrong people
- Low CTR + high lead quality = creative is too niche (good problem - scale the audience)
- Track creative performance by concept, not just by individual ad
- Score ads against revenue quality using the urgency/budget/fit framework (see Message Validation)

---

## Creative Formats for B2B

### Format Selection Matrix

| Format | Best For | Typical Lifespan | Key Specs |
|--------|----------|------------------|-----------|
| **Static image** | Fast testing, any message, direct response | 14-28 days | 4:5 (1080x1350) for Feed, 9:16 for Stories |
| **Video** | Demos, testimonials, brand building | 21-35 days | Under 30s for prospecting, up to 60s retargeting. Captions always on. |
| **Carousel** | Multi-feature showcase, step-by-step, before/after | 21-35 days | 3-5 cards (10 max). First card must stand alone as hook. |
| **UGC / Testimonial** | Trust building, cold audiences | 28-42 days | Must include credibility markers (job title, company, specific result) |

### Format-Specific Playbooks

**Static Images**
- 4:5 (1080x1350) for Feed, 9:16 for Stories. 4:5 generally delivers higher CTR and lower CPA than other ratios.
- Keep text under 20% of image area - the old hard rule was removed but the algorithm still penalizes text-heavy images
- Human faces tend to increase engagement
- Lifespan 14-28 days - people register static images quickly, then scroll past (fatigues fastest)
- Refresh tactic: change hook text/headline while keeping the visual = buys 7-14 extra days. A different color scheme reads as "new" to the algorithm.
- Duplication warning: Meta's visual recognition flags similar images as duplicates - changes must be visually distinct

**Video**
- First 3 seconds are everything - most viewers bounce if not captured
- Hook rate target 20-25% (ThruPlay-to-impression); below 15% = never performs
- Always include captions - most users watch with sound off
- 9:16 vertical for Stories/Reels, 4:5 for Feed. 9:16 vertical with audio tends to convert better.
- Length: under 30s for prospecting, up to 60s for retargeting
- Lifespan 21-35 days - more engaging, fatigues slower than static
- Swap opening hook while keeping the body = extends lifespan significantly
- Production styles: founder talking, customer testimonial, screen recording, animation. Different styles = different audience signals.

**Carousel**
- 3-5 cards (10 max). First 3 cards do most of the work.
- First card must stand alone as a hook - some placements show only the first card
- Lifespan 21-35 days - multiple cards give built-in variety
- Rearranging card order reads as a "new" ad to the algorithm
- Adding 1-2 new cards while keeping the best cards = efficient refresh
- Best for step-by-step processes, multiple benefits, before/after comparisons

**UGC / Testimonial**
- Fatigues slowest of all formats (28-42 days) - authenticity has staying power
- UGC outperforms polished content, but B2B needs credibility markers (job title, company, specific result)
- Video > quote card for cold audiences; quote cards work for retargeting
- Record 3-5 customers at once, edit into 10+ variations with different hooks and cuts
- When it fatigues: switch to a different customer, not a different concept. Multiple UGC videos from different people = a built-in rotation system.

---

## The Ad Copy Formula

Proven 7-step structure for B2B SaaS Meta ads.

| Step | Purpose | Example |
|------|---------|---------|
| 1. **Direct Offer** | State the value proposition clearly | "Stop losing pipeline to dirty CRM data." |
| 2. **Pain** | Name the specific problem your ICP has | "Your reps spend 15 hours/week on manual data entry." |
| 3. **Solution** | Show how you solve it | "[Product] auto-captures every touchpoint in real-time." |
| 4. **Pain Explained** | Deeper on the consequences of not solving | "Deals slip through because notes aren't updated. Your forecast is wrong because the data is wrong." |
| 5. **Solution Explained** | Deeper on the benefits of solving | "No manual entry. No missing data. No bad forecasts." |
| 6. **Social Proof** | Customer quote, stat, or logo | "'We went from 3 days to 30 seconds.' - VP Sales, mid-market SaaS" |
| 7. **CTA** | Clear next step with motivation | "Calculate how much pipeline you're leaking." |

### Full Example

> **Stop losing pipeline to dirty CRM data.**
>
> Your reps spend 15 hours/week on manual data entry. Deals slip through because notes aren't updated. Your forecast is wrong because the data is wrong.
>
> [Product] auto-captures every touchpoint - calls, emails, meetings - and writes it back to your CRM in real-time. No manual entry. No missing data. No bad forecasts.
>
> "We went from 3 days to build a pipeline report to 30 seconds." - VP Sales, mid-market SaaS
>
> Calculate how much pipeline you're leaking - [CTA]

### Copy Rules for B2B Meta

- **"Sell the click, not the product."** You are not selling a $30K contract in an ad - you are selling the click.
- Call out who the ad is for explicitly - "mosquito repellent" for non-ICP
- Name the specific problem, not the category. "Still manually updating your CRM after every call?" beats "CRM automation solution".
- Include a time-bound element when possible ("in 60 days", "this quarter", "before Q3")
- First 2-3 lines must hook - most users will not expand "See More"
- Compress the 7-step structure into the first 2-3 lines for short-form (Headlines/Primary Text)
- Use double line breaks between paragraphs when creating ads via API

---

## Creative Volume for the Algorithm

Meta's Andromeda system needs creative variety to learn effectively.

**Minimum recommended:** 4-6 unique creative concepts per campaign at any time. Not 4-6 variations of one concept - 4-6 fundamentally different approaches.

**Why:** With only 1-2 concepts, Andromeda has limited data. With 4-6+ unique concepts, it identifies which messaging and visual approaches resonate with which audience segments.

---

## Image-First Concept Validation

Test new concepts as static images first before investing in video or other formats. Images are faster and cheaper to produce, making them ideal for proving whether a concept resonates before committing to higher-effort formats.

**The flow:**
1. **Proof the concept with an image ad** - design a static that captures the hook, angle, and message
2. **Validate against delivery + quality** - if the image passes the delivery check (Stage 1) and then generates pixel leads, qualified leads, and cost within range (quality evaluation, Stage 2), the concept is proven
3. **Iterate the winning concept into other formats** - produce video (founder talking, AI-generated video, screen recording), carousel, or UGC versions of the proven concept
4. **Scale the best-performing format** - the format that performs best on the proven concept gets the production investment

**Why image-first:**
- Static images are the fastest to produce (hours, not days)
- Lower production cost means more concepts tested per cycle
- A concept that works as an image has a validated hook and angle - video adds engagement and extends lifespan on top of that
- A concept that fails as an image would likely fail as video too - saving significant production time and cost
- Video iterations on proven image concepts have a higher win rate than untested video concepts

**When to skip image-first and lead with video:**
- UGC/testimonial concepts (inherently video-native - the person IS the format)
- Concepts that require demonstration or motion to communicate the value (e.g., product walkthrough)
- Iterations on already-proven concepts where the format change IS the variable being tested

---

## Creative Production Cadence

### The 50/30/20 Production Split

This is a creative production ratio - it defines what you build, not how budget is allocated. CBO handles budget distribution automatically.

| Allocation | What to Build | Purpose |
|------------|---------------|---------|
| **50%** | Iterations on top performers | Same concept, different hook/format/visual |
| **30%** | Iterations on other performers | Same angle, different execution |
| **20%** | Completely new concepts | Different angle, format, message |

For each proven ad, produce 10 variations over its lifespan.

The same 50/30/20 ratio also describes a healthy **active creative library** at any moment: ~50% proven winners currently scaling, ~30% iterations on those winners, ~20% brand-new concepts in testing. Framing it this way (library composition) is what keeps a replacement ready the moment fatigue hits - see the Rotation System.

### Tests Per Month Formula

```
Tests/month = Testing Campaign monthly budget / (3 x TCPL)
```

Logic: the Testing Campaign gets ~20% of total budget. Each test needs 3x TCPL spend for quality evaluation (95% statistical confidence; Poisson distribution: e^-3 = 0.0498, i.e. a ~5% chance of seeing zero conversions if the true rate matched TCPL). Tests that fail the delivery check at Day 7 free up budget faster, increasing actual throughput.

| Monthly Budget | Testing Budget (20%) | Tests/Month (TCPL = $500) | Tests/Week |
|----------------|----------------------|---------------------------|------------|
| $20K | $4K | ~3 | ~1 |
| $30K | $6K | ~4 | ~1 |
| $50K | $10K | ~7 | ~2 |
| $100K | $20K | ~13 | ~3-4 |

### Win Rates

Directional benchmarks for how many tests it takes to find one winner.

| Type | Win Rate | Tests Needed for 1 Winner |
|------|----------|---------------------------|
| Iterations on winners | ~25% (1 in 4) | 4 |
| New concepts | ~10% (1 in 10) | 10 |
| Blended (50/50 mix) | ~17% (1 in 6) | 6 |

### Proven Ads Needed by Budget

```
Minimum proven ads = Monthly budget / $5,000
```

Each proven ad absorbs ~$5K/month before frequency causes fatigue. Above $6-8K on one ad, performance degrades.

| Monthly Budget | Min Proven Ads | Tests Needed (17% win rate) | Months to Build |
|----------------|----------------|-----------------------------|-----------------|
| $20K | 4 | ~24 | ~6 |
| $30K | 6 | ~36 | ~8 |
| $50K | 10 | ~60 | ~8 |
| $100K | 20 | ~120 | ~9-10 |

### Scaling Readiness

```
Creative deficit = Proven ads needed (Scaling Campaign) - Current proven ads
Tests to close gap = Creative deficit / 0.17
Months to close = Tests to close / Tests per month
```

**You cannot scale budget ahead of creative.**

---

## Creative Testing Cadence

| Action | Frequency | What to Do |
|--------|-----------|------------|
| **Check delivery** (Stage 1) | Wednesday (Day 7 for new ads) | Check CBO spend distribution in the Testing Campaign. Swap ads below the underdelivery threshold (1/N/2). |
| **Launch new iterations** | Every 2 weeks | 2-3 iterations on current top performers. Change the hook first (Priority 1). Launch in the Testing Campaign. |
| **Launch new concepts** | Monthly (minimum) | 1-2 completely new angles as static images. Source from the buyer situations list. Launch in the Testing Campaign. |
| **Retire depleted ads** | When triggered | CTR drops 30%+ from peak OR frequency > 5.0 = concept is exhausted. Don't iterate - remove from Scaling Campaign. |
| **Iterate winners into new formats** | When an image concept passes delivery + quality | Produce video/carousel/UGC version of the proven concept. The concept is validated - now test which format maximizes it. |
| **Full creative refresh** | Quarterly | Re-audit buyer situations, source new angles, refresh visual identity. |
| **Check fatigue signals** | Weekly (Monday) | Pull frequency, CTR trend, CPM trend, ad relevance diagnostics for Scaling Campaign ads. |

### Testing Protocol

1. **New concepts** launch as a static image in the Testing Campaign first (image-first validation). Skip image-first only for video-native concepts (UGC, testimonials, product demos).
2. **Stage 1 - Delivery Check (Day 5-7):** check CBO spend distribution. If an ad gets less than half its expected share (1/N/2 where N = active test ads), swap immediately - don't wait for 3x TCPL.
3. **Stage 2 - Quality Evaluation:** minimum spend 3x TCPL before judging (95% confidence threshold).
4. **Minimum runtime:** 14 days (learning phase + stabilization).
5. Judge by qualified lead rate and cost per qualified lead - not CTR or pixel CPL.
6. If winning (all graduation criteria met): graduate to the Scaling Campaign.
7. If the concept is proven AND was image-first: produce video/carousel/UGC versions of the same concept.
8. If losing: classify the failure type and build the next creative accordingly (below).

### What to Build When an Ad Fails

The "Step" references below correspond to the sequential quality checks after the delivery check: pixel leads (Step 2), qualified leads / quality rate (Step 3), cost vs TCPL (Step 4), fatigue (Step 6).

| Failure Type | What It Means | What to Build Next |
|--------------|---------------|--------------------|
| **Delivery failure** (Stage 1) | Creative does not stop the scroll | Different hook/visual/format. Do not iterate on copy - the audience never got that far. |
| **Zero pixel leads** (Step 2 fail) | Creative does not resonate at all | Abandon concept. Completely different angle/format/message. |
| **Zero qualified leads despite leads** (Step 3 fail) | Attracts the wrong audience | Keep the format, change the pain point to filter for ICP. |
| **Low quality < 40%** (Step 3 fail) | Not enough ICP filtering | Add revenue figures, industry terms, ICP-specific language. |
| **Cost > 1.5x TCPL** (Step 4 fail) | Right audience, wrong execution | Same angle, different hook/format/visual/CTA. |
| **Fatigue** (Step 6) | Audience exhausted on this creative | New hook + different format + different customer/color. |

---

## Message Validation & Scaling

Standard Meta metrics (CTR, CPL, conversion rate) do not tell you which ads drive revenue. An ad with $15 CPL and 2% CTR might generate garbage leads. An ad with $40 CPL and 1.2% CTR might generate closed-won deals worth $100K. For B2B SaaS with $30K+ ACV, you must validate ads against downstream quality, not just platform metrics. The ad that makes the most money is often NOT the one with the best CTR or lowest CPL.

### The Validation Process

**Phase 1 - Launch initial ads (first 2-4 weeks).** Start from the buyer situations list. Create 3-5 ads per situation using different formats (static, video, carousel). Launch with equal budget across ad sets (ABO for fair testing).

**Phase 2 - Score the first ~20 demos/meetings.** After each sales call, the closer ranks urgency, budget, and fit (0-3 each). Log the score alongside the ad/ad set/campaign that generated the lead. After 20 calls, calculate the average score per ad.

### The Quality Scoring Framework

| Factor | 0 Points | 1 Point | 2 Points | 3 Points |
|--------|----------|---------|----------|----------|
| **Urgency** | "Just browsing" | Some pain, no timeline | Active problem, 3-6 month timeline | Burning problem, need solution NOW |
| **Budget** | No budget, no authority | Budget exists but unclear | Budget allocated for the category | Budget approved, ready to spend |
| **Fit** | Not ICP at all | Partially matches ICP | Good ICP match | Perfect ICP match |

Max score: 9 per prospect.

**Phase 3 - Identify the true top 3.** Sort ads by average quality score, NOT by CPL or CTR.

| Ad | CPL | CTR | Demo Rate | Avg Quality Score | Verdict |
|----|-----|-----|-----------|-------------------|---------|
| Ad A (Problem/Solution) | $28 | 1.8% | 12% | 7.2 | **WINNER** |
| Ad B (UGC Testimonial) | $22 | 2.1% | 15% | 4.1 | Platform vanity - low quality |
| Ad C (ROI Calculator) | $35 | 1.1% | 8% | 8.0 | **WINNER** - highest quality |
| Ad D (Meme/Humor) | $18 | 2.4% | 18% | 3.5 | High volume, terrible quality |
| Ad E (Case Study) | $32 | 1.3% | 10% | 6.8 | **WINNER** |

Ads A, C, and E win - even though Ad D had the best CPL and CTR. Ad D's leads had no urgency, no budget, and poor fit.

**Phase 4 - Scale the winners: top 3 to 10 variations each.** Keep the winning angle, change the format.

| Winning Ad | 10 Variations |
|------------|---------------|
| Problem/Solution static | 3 video versions (founder talking, animation, screen recording), 2 carousel versions, 2 different hooks on same concept, 1 testimonial using same angle, 2 new static designs |
| ROI Calculator | 3 different calculator screenshots, 2 video walkthroughs, 2 different pain-point hooks leading to same calculator, 1 carousel showing before/after numbers, 2 testimonial quotes about ROI |

Move all variations to a CBO campaign targeting the validated winning audience and let Meta allocate budget to the best variations. Ad set structure options:
- **By concept:** one ad set per winning concept (3 ad sets x 10 ads each)
- **By batch:** mixed concepts per ad set - batch 1, then learn, then batch 2 iterates on winners

**Phase 5 - Continuous iteration.** Every 2 weeks, review quality scores on new leads. Kill any variation where average quality drops below 5. Add new variations of winning concepts. Test 1-2 completely new angles per month (the 20% in the 50/30/20 split). After ~12 months, your top 5% of in-market buyers may be exhausted - expand TAM with story-based ads.

---

## Fatigue Detection System

Creative fatigue happens when your audience has seen your ads too many times. The algorithm keeps serving them, but engagement drops and costs rise.

### Fatigue Signals (in Order of Urgency)

| Signal | Threshold | Urgency |
|--------|-----------|---------|
| Frequency > 4.0 (cold prospecting) | Immediate action needed | URGENT |
| Frequency > 6.0 (retargeting) | Immediate action needed | URGENT |
| CTR drops 20%+ from baseline over 7 days | Creative dying | WARNING |
| CPM rising 30%+ over 2 weeks | Algorithm struggling to deliver efficiently | WARNING |
| Ad Relevance: "Below Average" in any metric | Quality issue | WARNING |
| CPA increasing with stable targeting | Likely fatigue (rule out other causes first) | MONITOR |

### Frequency Thresholds by Campaign Type

| Campaign Type | Safe | Warning | Critical |
|---------------|------|---------|----------|
| **Cold prospecting** | 1.0-2.5 | 2.5-3.5 | > 4.0 |
| **Retargeting** | 2.0-4.0 | 4.0-5.5 | > 6.0 |
| **ABM** | 2.0-5.0 | 5.0-7.0 | > 8.0 |

ABM tolerates higher frequency because audiences are small and message reinforcement is intentional. But even ABM hits diminishing returns past 5-6 impressions per person per week.

### Creative Lifespan by Format

| Format | Typical Lifespan | Why |
|--------|------------------|-----|
| Static image | 14-28 days | Seen, registered, scroll past |
| Video (< 30s) | 21-35 days | More engaging, fatigues slower |
| Carousel | 21-35 days | Multiple cards = more novelty |
| UGC / testimonial | 28-42 days | Authenticity fatigues slowest |

B2B audiences are smaller, so frequency builds faster. But B2B users pay less attention to ads while scrolling past work content, so each impression has less impact. Net result: plan for a 14-21 day refresh cycle for most B2B campaigns.

### Detection Workflow (Weekly - Monday)

1. **Pull the frequency report** - Ads Manager > Columns > Customize > add "Frequency". Filter by last 7 days and last 14 days. Flag any ad above the threshold for its campaign type.
2. **Check the CTR trend** - compare this week vs the previous 2 weeks. A 15-20%+ drop = fatigue likely. CTR stable but frequency rising = preemptive refresh needed within 7 days.
3. **Check the CPM trend** - rising CPM with a stable audience = the algorithm is struggling to deliver. Often a leading indicator before CTR drops. 30%+ over 2 weeks = fatigue or auction competition (check both).
4. **Check ad relevance diagnostics** - Ads Manager > select ad > Inspect (or columns > Ad Relevance Diagnostics). Three metrics: Quality Ranking, Engagement Rate Ranking, Conversion Rate Ranking. Any "Below Average" = investigate and likely replace.
5. **Classify each ad:**

| Classification | Criteria | Action |
|----------------|----------|--------|
| **Healthy** | CTR stable, frequency < threshold, relevance OK | Keep running |
| **Warning** | CTR declining or frequency approaching threshold | Prepare replacement, launch within 7 days |
| **Urgent** | Frequency > threshold, CTR dropped 20%+, relevance declining | Replace immediately (within 24-48 hours) |
| **Depleted** | 4+ weeks running, frequency > 5.0, performance well below baseline | Pause. Do not iterate - this concept is exhausted. |

### The Rotation System

At any time, your active creative library should be ~50% proven winners (currently scaling), ~30% iterations on winners (same angle, different hook/format/design), ~20% new concepts (completely different angles for testing). This ensures a replacement is always ready when fatigue hits, while still scaling what works.

**Rotation cadence:** check fatigue signals weekly (Monday); launch new variations every 2 weeks; retire depleted concepts when CTR drops 30%+ from peak or frequency > 5.0; test completely new concepts monthly at minimum; full library refresh quarterly.

### Rotation Without Resetting the Learning Phase

- **Do not** swap creative inside a performing ad set (resets learning)
- **Do** launch new ads alongside existing ones in the same ad set
- **Do** create a new ad set with the same targeting and fresh creative if the existing ad set is depleted
- **Do** pause underperforming ads (pausing does not equal editing - it does not reset learning)

### Creative Pipeline Management

To avoid scrambling when fatigue hits, maintain a stocked pipeline.

| Campaign Type | Minimum Active | Ready in Pipeline | Refresh Rate |
|---------------|----------------|-------------------|--------------|
| Cold prospecting | 4-6 concepts active | 3-4 ready to launch | Every 2 weeks |
| Retargeting | 3-4 concepts active | 2-3 ready to launch | Every 3 weeks |
| ABM | 2-3 concepts active | 2 ready to launch | Every 3-4 weeks |

**Building the pipeline:**
1. Source new angles from the buyer situations list
2. Repurpose organic winners (high-performing LinkedIn posts, blog content)
3. Mine customer calls for language, objections, success stories
4. Study competitor ads in Meta Ad Library for format inspiration
5. Iterate on winners - same angle, different hook/format/visual

### Format-Specific Fatigue Notes

- **Static images:** fatigue fastest. Refresh hook text/headline while keeping the same visual = buys 7-14 extra days. Different color schemes and layouts of the same concept count as "new".
- **Video:** lasts longer (people engage at different points each view). 9:16 vertical with audio tends to convert better. Swap the opening hook while keeping the body = extends lifespan significantly.
- **Carousel:** multiple cards give built-in variety per impression. Rearranging card order = a "new" ad. Adding 1-2 new cards while keeping the best cards = efficient refresh.
- **UGC / testimonial:** fatigues slowest. When it does, switch to a different customer, not a different concept. Multiple UGC videos from different people = a built-in rotation system.

### Frequency Cap Recommendations

Meta does not offer precise frequency caps, but you can control frequency through:
1. **Audience size** - larger audience = lower frequency per person
2. **Budget pacing** - lower daily budget = fewer impressions per person
3. **Creative rotation** - more active ads = impressions distributed across them
4. **Ad scheduling** - run ads during specific hours/days to control delivery (limited B2B value)
5. **Exclusions** - exclude recent converters (7-30 days) to avoid over-serving

**Target frequency by objective:**
- Prospecting: 1-2 impressions/person/week
- Retargeting: 2-4 impressions/person/week
- ABM acceleration: 4-6 impressions/person/2 weeks

---

## Competitive Ad Research

Before finalizing your ads, check what competitors are running.

### Meta Ad Library Process

1. Go to facebook.com/ads/library
2. Search competitor company pages
3. For each competitor, record: total active ads (volume signal), ads running 3+ months (likely profitable), dominant format (static/video/carousel), angles used (pain point, testimonial, comparison), offer types (demo, guide, webinar, calculator), CTA language, creative style (polished/UGC/meme)

### What to Learn vs What Not to Copy

| Learn | Do Not Copy |
|-------|-------------|
| Which angles they keep running (validated by spend) | Exact creative (will not work for your brand - their audience is warmed to their brand, not yours) |
| Format preferences | Larger competitors' scale strategy (they absorb losses you cannot) |
| Offer types that persist | Assume volume = quality (they may be burning money) |
| How they handle ICP specificity | Their visual identity (build your own) |

A company spending $1M/month can run unprofitable campaigns as a market-capture strategy. Your ads need to be profitable within 3-4 months.

### Research Cadence

| Activity | Frequency |
|----------|-----------|
| Full competitive audit | Quarterly |
| Quick check (top 3 competitors) | Monthly |
| Reactive check | When launching new concept types |

---

## Placement Optimization

| Placement | Aspect Ratio | Notes |
|-----------|--------------|-------|
| Feed (Facebook/Instagram) | 1:1 or 4:5 | Primary B2B placement, most engagement, supports long copy |
| Stories/Reels | 9:16 | Full-screen, needs dedicated creative. 9:16 vertical with audio tends to convert better. |
| Right Column | 1.91:1 | Desktop only, smaller - needs clear messaging |
| Audience Network | Various | Often lower quality for B2B - test, but exclude if lead quality drops |

**Rules:**
- Create dedicated creative for each major placement
- If you only have 1:1 creative, exclude Story/Reel placements rather than running bad creative there
- Use Meta's per-placement creative customization at the ad level
- Advantage+ placements is fine if you have creative for each format

---

## Organic Content Repurposing

Before creating new ads from scratch, audit your organic content from the last 12 months:

1. Best LinkedIn posts - high engagement, comments, saves
2. Best blog posts - highest traffic, longest time on page
3. Best webinar clips - moments that got the most engagement
4. Customer testimonial quotes - ones that get shared or screenshotted
5. Influencer collaborations - if any performed well organically

**Organic validation = the market already told you this works.** This is free market research - do not assume you are starting from zero. Repurpose organic winners as paid ads for higher win rates than untested concepts.

**Illustrative pattern:** older organic content that already drove customers (for example, a founder's influencer-collab videos) tends to become a top performer when repurposed as a paid ad - because the message was validated by the market before any paid spend.

---

## Quick Reference - All Creative Formulas

| Formula | Calculation |
|---------|-------------|
| Delivery check threshold | (1 / N) / 2, where N = active test ads |
| Tests per month | Testing Campaign budget / (3 x TCPL) |
| Minimum proven ads | Total budget / $5,000 |
| Creative deficit | Proven ads needed - Current proven ads |
| Tests to close gap | Deficit / 0.17 (blended win rate) |
| Iteration win rate | ~25% (1 in 4) |
| New concept win rate | ~10% (1 in 10) |
| Blended win rate | ~17% (1 in 6) |
| Hook rate target | 20-25% |
| Static lifespan | 14-28 days |
| Video lifespan | 21-35 days |
| Carousel lifespan | 21-35 days |
| UGC lifespan | 28-42 days |
| Fatigue warning (cold) | Frequency 2.5-3.5 |
| Fatigue critical (cold) | Frequency > 4.0 |

---

> By Ivan Falco - Frontal
