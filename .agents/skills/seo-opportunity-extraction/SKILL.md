---
name: "seo-opportunity-extraction"
title: Opportunity extraction
description: "Use this skill when account context exists and you need content opportunity angles before touching keywords — competitor plays, objection content, feature/use-case/vertical pages, pain-led topics. Turns account intelligence into a prioritized opportunity inventory where every angle traces to a named signal from calls, comms, or data. Phase 2 of the SEO topic research pipeline; runs standalone if you paste the account context."
category: SEO
---

Turn account intelligence into structured content opportunity angles. Not keywords yet — business opportunities. Keyword validation comes after.

This step exists because going straight from account context to keyword research skips the most important question: what does this business actually need content for? Ahrefs shows what's searchable. This step identifies what's strategically valuable.

## Invocation

`/opportunity-extraction`

Example: runs after `/business-context`, or call standalone and paste account context.

---

## Step 0 — Context Check

If called standalone: ask the user to paste their Account Intelligence Document or describe the account context. You need the product, ICP, competitor landscape, objections, existing wins, and any exclusions. Do not proceed without enough context to make evidence-based recommendations.

If called from `/topic-research`: use the Account Intelligence Document from Phase 1.

---

## Step 1 — Scan for Signals

Review the account intelligence and identify signals across seven opportunity types. For each type, list every relevant signal from the account data before forming opportunities.

**Competitor signals:**
- Which competitors were named in calls or comms?
- Which competitors appear in the Ahrefs organic competitor list?
- Are there any competitors the client specifically fears or wants to displace?

**Objection signals:**
- What hesitations or friction points came up in sales calls?
- What implementation, cost, switching, or migration concerns appeared?
- What problems did buyers describe before finding the product?

**Feature and differentiator signals:**
- Which product features are commercially significant — emphasized in sales, gating higher plans, named repeatedly in calls?
- Which capabilities are genuinely differentiated vs. table stakes for the category?
- Which integrations are strategically important to the buyer's stack?

**Use-case signals:**
- What jobs do customers actually hire this product for?
- Which use cases came up repeatedly in calls, case studies, or on the product site?
- What named customer segments use it for specific workflows?

**Industry and vertical signals:**
- Which verticals were called out explicitly by the client or in the ICP definition?
- Which verticals do they currently over-index in? Which do they want to enter?
- Are there vertical-specific compliance, regulation, or workflow needs that create content angles?

**Pain and problem signals:**
- What language did customers use to describe their situation before finding the product?
- What "before state" language appears in case studies or G2/Capterra reviews?
- What would someone search when they have the problem but haven't found the product yet?

**Existing winner signals:**
- Which pages already drive traffic and pipeline?
- Which topic clusters already have ranking momentum?
- What adjacent opportunities does an existing winner create — what's the next logical page to build?

---

## Step 2 — Form Opportunities

For each signal cluster, form one or more content opportunities. An opportunity is a strategic angle, not a keyword. Format each as:

```
### [Opportunity Name]
Type: [Competitor-led | Objection-led | Feature-led | Use-case-led | Industry-led | Pain-led | Winner expansion]
Signal: [The specific evidence — a named competitor, a quoted objection, a product feature, a named ICP segment]
Opportunity: [One sentence — what is this content for?]
Commercial value: [Why does this help pipeline, not just traffic? What buyer does it reach?]
Likely formats: [What kind of page(s) this probably becomes — e.g., alternatives page, vertical LP, feature page]
```

Work through every signal type. Don't stop at the obvious competitor opportunities — feature-led, use-case-led, and pain-led opportunities often have stronger conversion potential because they reach buyers earlier in the evaluation process.

---

## Step 3 — Check Coverage and Gaps

After forming all opportunities:

1. **Are stated commercial priorities represented?** If the client said they want to sell more of Product X to Industry Y and there's no opportunity covering that, add one or flag it as a gap.

2. **Is anything over-represented?** If there are 9 competitor opportunities and 1 use-case opportunity, name the imbalance. Competitor content alone doesn't build topical authority — it requires a steady base of use-case and feature content to rank well long-term.

3. **Is the ICP match consistent?** Every opportunity should connect to a specific searcher who could plausibly become a customer. Cut anything where the ICP is vague or implausible.

4. **Does anything contradict the client's stated exclusions?** If the client said they don't want to be positioned in a specific vertical or category, remove those opportunities and note them.

---

## Step 4 — Pre-Validation Priority

Before keyword validation, assign a pre-validation priority to each opportunity:

| Priority | Criteria |
|---|---|
| **High** | Maps directly to a stated commercial priority AND is supported by at least one named signal from calls or comms |
| **Medium** | Maps to a plausible commercial priority but inferred rather than explicitly stated |
| **Low** | Plausible but weak signal — speculative, niche, or requires assumptions about ICP fit |

High-priority opportunities go first into keyword validation.

---

## Output

Print the full Opportunity Inventory:

```
## Opportunity Inventory — [client]
Date: [today's date]
Total opportunities: [N]

### High Priority ([N])
[All high-priority opportunities in full format]

### Medium Priority ([N])
[All medium-priority opportunities in full format]

### Low Priority ([N])
[All low-priority opportunities in full format]

### Coverage Notes
[Any gaps, imbalances, or explicit exclusions applied]
```

If called standalone, ask: "Save to file? Default: `./opportunities-[domain]-[date].md`"

---

## Rules

- **Every opportunity traces to a signal.** If you can't point to a specific named competitor, quoted objection, product feature, or ICP segment as the source — cut it.
- **An opportunity is a business angle, not a keyword.** "Competitor X alternatives" is an opportunity. "best X software for small business" is a keyword that comes in the next phase.
- **Commercial value is mandatory.** If you can't state why an opportunity helps pipeline (not traffic), it doesn't belong in the inventory.
- **Quantity doesn't substitute for quality.** 12 well-evidenced opportunities beat 30 thin ones. Cut anything not genuinely supported by account data.
