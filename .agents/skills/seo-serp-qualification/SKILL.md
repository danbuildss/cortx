---
name: "seo-serp-qualification"
title: SERP qualification
description: "Use this skill when a keyword list needs a reality check against what actually ranks — intent clarity, rewarded content format, competitive landscape, and beatable gaps, ending in QUALIFY / CONDITIONAL / KILL verdicts per keyword. Many topics die here; that's the point. Fires on \"can we rank for this\", \"check the SERPs\", \"qualify these keywords\". Phase 4 of the SEO topic research pipeline; runs standalone if you paste the keyword candidates."
category: SEO
---

Check what actually ranks for each keyword candidate. Ahrefs numbers alone are useless without understanding the SERP. This step qualifies or kills individual keyword candidates based on intent clarity, format signals, competitive landscape, and whether the rankings are beatable.

Many topics die here. That's the point.

## Invocation

`/serp-qualification`

Example: runs after `/keyword-validation`, or call standalone and paste a keyword candidate list.

---

## Step 0 — Context Check

If called standalone: ask the user to paste the keyword candidate pool (keywords, volumes, KDs, and the opportunities they belong to).

If called from `/topic-research`: use the keyword candidate pool from Phase 3.

---

## Step 1 — Check Each Keyword

For each keyword in the candidate pool, run in parallel:

**A. Ahrefs SERP overview**
`serp-overview` for the keyword — get the top 10 ranking pages, their DR, URL type, and estimated traffic.

**B. Live SERP check**
`WebSearch` for the exact keyword — note: dominant SERP feature type (organic list, featured snippet, AI Overview, map pack, video carousel), result types in the top 5, and the top 3 organic titles.

**C. Top-page content fetch (selective)**
`WebFetch` the #1 and #2 organic results — not to read the full page, but to extract: H1, H2 structure, content format (listicle vs. guide vs. LP vs. docs vs. comparison page), and approximate depth. Skip this fetch if intent and format are already obvious from the titles and URLs alone.

Run checks in parallel across keywords. Work through high-priority opportunities first.

---

## Step 2 — Answer Six Questions Per Keyword

For each keyword, work through these questions:

**1. Is intent clear and consistent?**
Do the top results all serve the same intent, or is the SERP mixed (some transactional, some informational, some navigational)? A mixed SERP means Google isn't confident about what searchers want — harder to target deliberately and rankings will be unstable.

**2. What content format does Google reward?**
Extract the dominant format from the top 5 results:
- Listicle (best X, top X)
- Alternatives page
- Comparison page
- Landing page
- Documentation page
- Blog post or guide
- Category page
- Homepages dominating

Note the format. This feeds directly into topic shaping.

**3. Does the client's product category fit the SERP?**
Is the client's product category represented in the top results? If the SERP is dominated by a completely different product category, the keyword may have misleading volume — right search count, wrong audience.

**4. How competitive is it, realistically?**
- Average DR of the top 5 results
- Any ranking pages with DR meaningfully lower than the client's current DR — these are the beatable targets
- Are media sites, review aggregators, or directory sites (G2, Capterra, etc.) locking out positions? These are hard for brand pages to displace
- Is the #1 result an exact-match domain for the keyword? Harder to beat
- Is there a clear gap — a format the top results don't cover, a SERP where nothing is truly authoritative?

**5. Does the format match what the client can produce?**
A keyword dominated by listicles from high-DR media sites is harder to crack with a single product page. A keyword where a mid-DR alternatives page sits at #2 is beatable with a better-executed version. Name any mismatch between what Google rewards and what the client is positioned to produce.

**6. Are there freshness signals?**
Are the top results recently updated? If rankings have been stable for 2+ years with no fresh content, there's an opening — the content bar hasn't been raised recently. If everything was published or updated in the last 6 months, the competitive effort is actively escalating.

---

## Step 3 — Assign Verdicts

For each keyword, assign one verdict:

| Verdict | Criteria |
|---|---|
| **QUALIFY** | Clear intent, format matches what client can produce, competitive landscape is beatable or has a visible gap, product category fits the SERP |
| **CONDITIONAL** | Good opportunity but one specific concern — higher competitive bar, slight intent ambiguity, format mismatch worth noting. State the condition explicitly. |
| **KILL** | Mixed intent, wrong product category dominates, ultra-high-DR media locks every position with no gaps, or the keyword doesn't survive contact with the actual SERP |

---

## Output

Print a summary:

```
## SERP Qualification Summary — [client]
Date: [today's date]

**Keywords checked:** [N]
**QUALIFY:** [N]
**CONDITIONAL:** [N]
**KILL:** [N]

**Top qualifying keywords:**
[Top 10 by combination of volume + clear opportunity signal]

**Most common kill reasons:**
[The 2–3 patterns that eliminated the most keywords]

**Conditional flags (most common condition):**
[What condition appears most often — e.g., "high KD but clear format gap", "mixed SERP but high commercial value"]
```

Then print the full keyword list with verdict, dominant SERP format, and brief notes for each entry.

---

## Rules

- **Read the actual SERP.** Do not verdict a keyword from Ahrefs data alone. Always check what's ranking with a live search.
- **Kill freely.** This step exists to reduce the candidate pool to only winnable, correctly targeted keywords. Keeping marginal keywords wastes briefing, writing, and publishing effort on targets that won't rank or won't convert.
- **Record the format signal for every QUALIFY.** Even passing keywords need their SERP format noted — this is direct input for topic shaping and brief writing downstream.
- **"Beatable" requires evidence.** Evidence means: a ranking page with lower DR than the client, a ranking page that clearly doesn't serve the intent well, or a SERP with obvious freshness or format gaps. Optimism is not evidence.
- **Conditional is not a soft pass.** Every CONDITIONAL needs a specific, actionable condition noted. If the condition can't be resolved, reclassify as KILL.
