---
name: "seo-business-fit-filter"
title: Business fit filter
description: "Use this skill when a qualified keyword list needs the commercial filter — five gates checking pipeline potential, ICP match, honest product fit, client alignment, and net-new vs update vs cannibalization. Stops an SEO plan from becoming a traffic play; traffic for the wrong audience is a cost, not a win. Fires on \"which of these keywords are actually worth it\", \"filter for pipeline\". Phase 5 of the SEO topic research pipeline; runs standalone if you paste the keyword list and account context."
category: SEO
---

Apply the commercial filter. This is the step that stops the keyword list from becoming a traffic play disguised as an SEO strategy.

Every surviving keyword gets tested against five questions. Most are easy. Some are hard. The hard ones matter most.

## Invocation

`/business-fit-filter`

Example: runs after `/serp-qualification`, or call standalone and paste the qualified keyword list plus account intelligence.

---

## Step 0 — Context Check

If called standalone: ask for (a) the SERP-qualified keyword list and (b) the Account Intelligence Document. Both are required. Do not proceed without them.

If called from `/topic-research`: use the SERP-qualified candidates from Phase 4 and the Account Intelligence from Phase 1.

---

## Step 1 — The Five Filters

Apply every filter to every keyword. Eliminate aggressively. Document every cut.

---

### Filter 1 — Pipeline, Not Traffic

**Question:** If this content ranks and drives traffic, will any of those readers plausibly convert into a customer?

This is not a soft question. The reader who finds this content — does the product solve their problem? Does their company profile match the ICP? Would a single demo booking or trial from this content be a realistic outcome?

**Fail if:**
- The keyword attracts an audience the client's product doesn't serve
- The content produces readers with no purchase path (e.g., a free tool user who will never buy an enterprise product)
- The traffic signal in Ahrefs comes primarily from geographies the client doesn't sell into
- The intent is purely informational with no plausible path to product evaluation

**Pass if:**
- The searcher is plausibly an active buyer, evaluator, or dissatisfied competitor user
- The content naturally leads to a product CTA that makes sense for this searcher
- Even at low conversion rates, the traffic quality justifies the production investment

---

### Filter 2 — ICP Match

**Question:** Is the person typing this query the customer the client wants?

Reference the ICP from the Account Intelligence Document. If the client specified a preferred ICP — by role, industry, or company size — check the keyword against it.

**Fail if:**
- The keyword attracts SMB buyers and the client is enterprise-focused (or vice versa)
- The keyword targets an industry the client explicitly said they don't want to focus on
- The role implied by the query is not a decision-maker or influencer in the client's sales process

**Pass if:**
- The implied searcher matches the ICP on at least two dimensions: role, industry, company size, or problem type
- The client said they want this ICP even if they don't currently serve it well — document this distinction

---

### Filter 3 — Product Fit

**Question:** Can the client's product genuinely solve the problem implied by this keyword?

No forced fits. If the keyword implies a need the product doesn't address, don't recommend content for it — it creates bad-fit traffic and undermines trust when the reader arrives and the product doesn't do what they came for.

**Fail if:**
- The keyword implies a capability the product doesn't have
- A competitor being compared serves a fundamentally different use case
- The content would require the client to make claims their product can't honestly support

**Pass if:**
- The product directly solves the problem implied by the query
- There's a specific feature, use case, or outcome the content can connect to honestly

---

### Filter 4 — Client Alignment

**Question:** Would the client recognize this as a sound recommendation?

Cross-reference against the "what they want to avoid" section of the Account Intelligence Document. If the client said they don't want to be positioned in a certain vertical, market, or category — respect that.

**Fail if:**
- The keyword locks the client into a segment they've explicitly rejected
- The content would contradict their stated positioning or brand direction
- The client mentioned this exact type of recommendation as unwanted in calls or comms

**Pass if:**
- The recommendation is consistent with stated goals and positioning
- Any tension with client direction has a clear strategic justification — note it explicitly rather than burying it

---

### Filter 5 — Net New vs. Update vs. Cannibalization

**Question:** Does a page for this keyword already exist? If so, is this a new page, an update, or a cannibalization risk?

Check against:
- The existing content inventory from Account Intelligence
- Current Ahrefs rankings for the domain on this specific keyword
- Top pages data from the business context phase

**New page:** No existing content on this topic. Assign: `NEW`

**Update:** A page exists and ranks, but it's underperforming — decaying traffic, thin content, outdated information. The opportunity is to improve what's there. Assign: `UPDATE`

**Cannibalization risk:** A page already exists and is performing on this keyword. Creating a second page would split ranking signals. Assign: `CANNIBALIZES — RESOLVE` and flag for a routing decision before briefing.

---

## Step 2 — Output

Print the filter results:

```
## Business Fit Filter Results — [client]
Date: [today's date]

**Keywords entering filter:** [N]
**Keywords passing all filters:** [N]

**Failed — breakdown by primary reason:**
- Pipeline misalignment: [N]
- ICP mismatch: [N]
- Product fit: [N]
- Client alignment: [N]
- Cannibalization (routing to update): [N]

**Passing keyword types:**
- NET NEW topics: [N]
- UPDATE priorities: [N]
- Cannibalization flags to resolve: [N]
```

Then print the full passing list with:
- Keyword
- Volume / KD
- Opportunity type
- New / Update / Cannibalizes
- Any notes on conditional passes (e.g., "ICP is adjacent, not exact — worth testing")

And a separate list of all killed keywords with the filter that failed them — one line each.

---

## Rules

- **This filter is harsh by design.** Traffic for the wrong audience is a cost, not a win. If a keyword doesn't help pipeline from the ICP the client cares about, it fails.
- **Document every fail.** The cut list is valuable. Some eliminations will prompt an important conversation about ICP, product roadmap, or client positioning.
- **Cannibalization is a routing decision, not a kill.** A keyword that conflicts with an existing page becomes an update brief, not a lost opportunity.
- **Product fit requires honesty.** Don't pass a keyword where producing the content would require stretching or misrepresenting what the product does.
- **Client alignment overrides scoring.** If the client said they don't want something, respect it — but note the trade-off explicitly if the opportunity is commercially significant.
