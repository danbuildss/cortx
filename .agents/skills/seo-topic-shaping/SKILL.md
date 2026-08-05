---
name: "seo-topic-shaping"
title: Topic shaping
description: "Use this skill when surviving topics need the right content format assigned — alternatives page vs comparison vs landing page vs guide — plus keyword clustering and site-architecture flags. Format drives structure, CTA, and ranking mechanics; let the SERP lead. Fires on \"what format should this content be\", \"shape these topics\", \"should this be a landing page or a blog post\". Phase 6 of the SEO topic research pipeline; runs standalone if you paste the filtered topic list."
category: SEO
---

Assign the correct content format to every surviving topic. Not every keyword becomes a blog post. The format decision determines the page's purpose, structure, CTA, and ranking mechanics. Get it wrong and the content fails regardless of how well it was written.

## Invocation

`/topic-shaping`

Example: runs after `/business-fit-filter`, or call standalone and paste the filtered keyword list.

---

## Step 0 — Context Check

If called standalone: ask for (a) the filtered keyword list with SERP qualification notes and (b) the Account Intelligence Document (for understanding the product and existing content structure).

If called from `/topic-research`: use the filtered list from Phase 5 and the SERP format notes from Phase 4.

---

## Step 1 — Format Decision Per Topic

For each keyword in the filtered list, use the SERP format signals from the qualification phase alongside the opportunity type to assign the correct content format.

**Format decision guide:**

| Format | When to use |
|---|---|
| **Alternatives page** | `[competitor] alternatives`, `alternatives to [competitor]`. Buyer is unhappy with a current tool and actively shopping. Highest-intent format in B2B SaaS SEO. |
| **Comparison page** | `[A] vs [B]` queries. Buyer has shortlisted two options and is deciding. Conversion-heavy. |
| **Category landing page** | `best [product category]`, `top [product category]`. Buyer building a shortlist. High AEO citation value. |
| **Vertical landing page** | `[product category] for [industry]`. Buyer wants a solution specific to their context. Creates ICP-targeted acquisition entry points. |
| **Feature page** | `[feature name] software`, `software with [feature]`. Capability-aware buyer looking for the right tool. |
| **Use case page** | `[product] for [use case]`, `[use case] software`. Job-to-be-done framing. Mid-funnel — buyer knows their problem, evaluating options. |
| **Pricing page** | `[competitor] pricing`, `[competitor] cost`. Deep-funnel. Buyer is about to make a decision. |
| **Integration page** | `[tool A] [tool B] integration`, `[product] + [platform]`. Ecosystem-aware buyer with a specific stack. |
| **Pain-solution article** | Query describes a problem without a product. Buyer knows the pain, hasn't found the product yet. Top-of-funnel but ICP-qualified. |
| **Implementation or migration guide** | `how to migrate from [competitor]`, `switching from X to Y`, `[product] implementation`. Objection-led — addresses a specific sales barrier. |
| **Comparison hub** | Multiple tools evaluated on shared criteria. Builds category authority. Works when the client needs a pillar page that connects multiple individual comparisons. |
| **Blog post or guide** | Informational or educational. Appropriate when the SERP rewards editorial content and no commercial format fits. |
| **Update existing page** | Keyword already has a ranking page designated UPDATE. Refresh and expand rather than create. |

For each topic, state:
- **Chosen format** and a one-sentence reason
- **Alternative rejected** — the most tempting wrong choice and why it underperforms for this keyword
- **Hybrid element (if any)** — e.g., an alternatives page that opens with a short explainer before the list, or a category LP with a comparison table embedded

---

## Step 2 — Cluster Related Topics

Some keywords are close enough that one well-executed page should target multiple. Identify clusters where:
- Intent is nearly identical across two or more keywords
- The format is the same
- Combining them is more efficient than three separate pages

For each cluster:
- Name the primary keyword (highest volume or commercial priority)
- List secondary keywords the same page targets
- Note the combined targeting approach

Avoid over-clustering. Two keywords with meaningfully different intent belong on separate pages even if they look adjacent.

---

## Step 3 — Flag Architecture Implications

Flag any format decisions that have structural implications for the site or the content plan:

- **New page type required** — e.g., the site doesn't have an alternatives section yet; this needs a new URL pattern (e.g., `/alternatives/[competitor]`)
- **Pillar + cluster** — if a topic works better as a hub page with multiple supporting pieces, name the structure
- **Marketing site vs. blog** — some formats (LPs, feature pages, pricing pages) belong in the main site, not the blog. This affects design, CRO, and internal linking — flag it early
- **Existing page conflict** — if the recommended format conflicts with how the client currently uses a URL pattern, name it
- **Cluster sequencing** — if three comparison pages should be built together as a batch (shared internal linking, consistent structure), note the dependency

---

## Output

Print the shaped topic list with a format summary at the top:

```
## Topic Shaping — [client]
Date: [today's date]
Total topics shaped: [N]

### Format Breakdown
- Alternatives pages: [N]
- Comparison pages: [N]
- Category landing pages: [N]
- Vertical landing pages: [N]
- Feature pages: [N]
- Use case pages: [N]
- Pricing pages: [N]
- Pain-solution articles: [N]
- Implementation / migration guides: [N]
- Blog posts / guides: [N]
- Updates to existing pages: [N]

### Architecture Flags
[List any flags from Step 3]

---

[For each topic:]

**[Primary keyword]**
Volume: [X]/mo | KD: [X] | Type: [opportunity type] | New/Update
Format: [chosen format]
Reason: [one sentence]
Alternative rejected: [format] — [why it fails for this keyword]
Cluster: [standalone | primary, also targets: keyword B, keyword C | secondary of [primary keyword]]
Architecture note: [if applicable, otherwise omit]
```

---

## Rules

- **Format drives everything downstream.** A comparison page and a blog post about the same topic have different structures, different CTAs, different design requirements, and different ranking mechanics. The distinction is not cosmetic.
- **Let the SERP lead.** If Google rewards listicles for a keyword, don't fight it with a landing page. Match the format first, differentiate within it.
- **Cluster aggressively, but not blindly.** Three thin pages for three similar keywords wastes budget and invites cannibalization. But two keywords with different intent should stay separate even if they look similar.
- **Architecture decisions belong here, not in briefing.** A new URL pattern or page type shouldn't be a surprise when the writer is halfway through a brief.
