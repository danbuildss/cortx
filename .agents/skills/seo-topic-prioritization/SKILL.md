---
name: "seo-topic-prioritization"
title: Topic prioritization
description: "Use this skill when a shaped topic list needs scoring and sequencing into a build order — six dimensions (commercial intent, ICP alignment, ranking feasibility, effort, authority leverage, adjacency to wins) into Tier 1/2/3, quick wins first. Fires on \"what should we build first\", \"prioritize the content roadmap\", \"sequence these topics\". Phase 7 of the SEO topic research pipeline; runs standalone if you paste the shaped topics."
category: SEO
---

Rank the final topic list so the client knows exactly what to build first. The order matters as much as the list. Wrong sequencing means high-effort topics get built before the fastest wins, and the content roadmap stalls before it proves itself.

## Invocation

`/topic-prioritization`

Example: runs after `/topic-shaping`, or call standalone and paste the shaped topic list.

---

## Step 0 — Context Check

If called standalone: ask for (a) the shaped topic list with formats, volumes, and KDs, (b) the Account Intelligence Document (for commercial priorities and existing content), and (c) any specific sequencing preferences the client has stated.

If called from `/topic-research`: use the shaped topic list from Phase 6 and the Account Intelligence from Phase 1.

---

## Step 1 — Score Each Topic

Score every topic on six dimensions using a 1–3 scale.

---

### Dimension 1 — Commercial Intent

How directly does this content serve a buyer who is ready to evaluate or purchase?

| Score | Criteria |
|---|---|
| **3** | Buyer in evaluation or decision mode — alternatives pages, comparison pages, pricing pages, feature pages |
| **2** | Mid-funnel — problem-aware, product-curious — use case pages, pain-solution articles, implementation guides |
| **1** | Top-of-funnel or editorial — buyer is learning, not yet evaluating |

---

### Dimension 2 — ICP Alignment

How precisely does this topic target the ICP the client has prioritized?

| Score | Criteria |
|---|---|
| **3** | Exact ICP match — role, industry, or use case explicitly matches the priority segment named in Account Intelligence |
| **2** | Broad ICP match — right general category of buyer but not the specifically prioritized segment |
| **1** | ICP adjacency — plausible buyer but requires assumptions about who's actually searching |

---

### Dimension 3 — Ranking Feasibility

How realistic is it to rank for this keyword given the client's current domain authority and the competitive landscape from SERP qualification?

| Score | Criteria |
|---|---|
| **3** | KD ≤ 40 AND the SERP has a visible, beatable gap (DR gap, format gap, or freshness gap confirmed in Phase 4) |
| **2** | KD 41–65, OR competitive but the client has a genuine content angle advantage over what currently ranks |
| **1** | KD 66+, OR the SERP is locked by ultra-high-DR domains with no visible gaps |

---

### Dimension 4 — Content Effort

How much production effort does this topic require? Scored inverted — lower effort scores higher.

| Score | Criteria |
|---|---|
| **3** | Low effort — updating an existing page, or a short targeted LP (under 1,200 words) |
| **2** | Medium effort — new page requiring research and moderate depth (1,200–2,500 words) |
| **1** | High effort — new long-form piece requiring significant research, expert input, or SERP-depth parity (2,500+ words) |

---

### Dimension 5 — Existing Authority Leverage

Does the client already have topical authority or ranking momentum in this area?

| Score | Criteria |
|---|---|
| **3** | Client already ranks for closely related terms, or has a high-traffic page in this specific topic cluster |
| **2** | Some related content exists but no strong ranking signals in this precise area |
| **1** | Completely new territory — no existing content or ranking signals to build on |

---

### Dimension 6 — Adjacency to Current Wins

How close is this topic to content that's already working?

| Score | Criteria |
|---|---|
| **3** | Direct expansion of an existing winning page or cluster — internal linking, topical authority, and user paths already exist |
| **2** | Same broad topic category as existing winners but a different angle or keyword cluster |
| **1** | Standalone — no meaningful connection to current organic wins |

---

## Step 2 — Calculate Priority Score

For each topic:

**Priority Score = Commercial Intent + ICP Alignment + Ranking Feasibility + Content Effort + Existing Authority + Adjacency**

Maximum: 18. Minimum: 6.

**Tier assignments:**
- **Tier 1 (build first):** Score ≥ 14
- **Tier 2 (build next):** Score 10–13
- **Tier 3 (backlog):** Score ≤ 9

---

## Step 3 — Sequencing Within Tier 1

After tiering, apply sequencing logic to order Tier 1:

1. **Quick wins first** — topics where KD is low AND the client has existing authority leverage. These prove the strategy with early traction before larger investments are made.
2. **Highest commercial intent second** — alternatives pages and comparison pages for the most-named competitors. Direct pipeline path.
3. **Cluster batches third** — if three topics belong to the same cluster (e.g., three competitor alternatives pages), build them together for compound internal linking and topical authority.
4. **Long bets last within the tier** — high-volume, high-KD topics that require significant investment. Worth building, but after the faster wins validate the direction.

**Override rule:** If the Account Intelligence Document records specific client sequencing preferences (e.g., "they want to focus on [competitor] first" or "they're launching into healthcare in Q3"), honor that above the score order — but note the trade-off explicitly.

---

## Output

Print the final prioritized topic plan:

```
## Prioritized Topic Plan — [client]
Date: [today's date]
Total topics: [N] | Tier 1: [N] | Tier 2: [N] | Tier 3: [N]

---

### Tier 1 — Build First

| # | Keyword | Format | Vol | KD | Score | New/Update | Notes |
|---|---|---|---|---|---|---|---|
| 1 | ... | ... | ... | ... | ... | ... | ... |

### Tier 2 — Build Next

| # | Keyword | Format | Vol | KD | Score | New/Update | Notes |
|---|---|---|---|---|---|---|---|

### Tier 3 — Backlog

| # | Keyword | Format | Vol | KD | Score | New/Update | Notes |
|---|---|---|---|---|---|---|---|

---

### Sequencing Notes
[Rationale for Tier 1 ordering, any cluster batching, any client preference overrides with trade-off noted]

### Scoring Notes
[Any topics where the numeric score doesn't fully capture the picture — e.g., a low-volume competitor alternatives page that scored 9 but is a named strategic target and should move up]
```

If called standalone, ask: "Save full topic plan to file? Default: `./topic-plan-[domain]-[date].md`"

---

## Rules

- **Score honestly.** Don't inflate dimensions to justify recommendations you've already decided on. If a topic scores 8, it scores 8.
- **Volume is not a scoring dimension.** Volume is reflected in commercial intent and ranking feasibility — it doesn't need its own dimension. A 200/mo competitor alternatives page can outrank a 5,000/mo top-of-funnel keyword because it drives pipeline.
- **Sequencing is a separate decision from scoring.** The highest-scoring topic isn't automatically built first. Quick wins that prove the strategy belong at the top of the build queue even if a long-bet topic scored higher.
- **Show the score breakdown.** The client needs to understand why Topic A is Tier 1 and Topic B is Tier 3. A breakdown makes the recommendation defensible and teachable.
- **Scoring notes matter.** The scoring model is a filter, not a verdict. Call out cases where the model under- or over-represents the actual opportunity.
