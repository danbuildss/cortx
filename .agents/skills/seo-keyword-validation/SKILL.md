---
name: "seo-keyword-validation"
title: Keyword validation
description: "Use this skill when you have content opportunity angles or topic ideas and need to validate them against real search demand with Ahrefs — volumes, keyword difficulty, and competitor keyword gaps, with seed patterns per opportunity type. Ahrefs validates, it doesn't dictate strategy. Fires on \"validate these keywords\", \"is there search demand for this\", \"build the keyword pool\". Phase 3 of the SEO topic research pipeline; runs standalone if you paste the opportunity list."
category: SEO
---

Take extracted opportunity angles and validate them against real search demand using Ahrefs. This is where Ahrefs comes in — not to dictate strategy, but to confirm that a business opportunity maps to actual search behavior.

The output is a keyword candidate pool: validated keywords grouped by opportunity, with volume, KD, and top-ranking domain, ready for SERP qualification.

## Invocation

`/keyword-validation`

Example: runs after `/opportunity-extraction`, or call standalone and paste the opportunity inventory.

---

## Step 0 — Context Check

If called standalone: ask the user to paste the Opportunity Inventory. You need the full list of opportunities with their types, signals, and indicative formats.

If called from `/topic-research`: use the Opportunity Inventory from Phase 2.

---

## Step 1 — Keyword Generation and Validation Per Opportunity

Work through opportunities in priority order (High → Medium → Low). For each opportunity, generate seed keywords based on the opportunity type and context, then validate with Ahrefs.

Run as many Ahrefs calls in parallel as possible.

**For each opportunity, run in parallel:**

**A. Matching terms exploration**
`keywords-explorer-matching-terms` — use 2–3 seeds that represent the core angle of the opportunity.

**B. Related terms**
`keywords-explorer-related-terms` — use the strongest seed from A to surface adjacent keywords you wouldn't have thought of.

**C. Direct keyword validation**
`keywords-explorer-overview` — for specific keywords you're confident about (e.g., "[competitor] alternatives", "[feature name] software"), get exact volume and KD directly.

**D. Competitor keyword gap (for competitor-led opportunities only)**
`site-explorer-organic-keywords` for the named competitor domain (limit: 30) — what are they ranking for that the client isn't? This surfaces proven keywords the client should own.

---

### Seed patterns by opportunity type

| Opportunity Type | Seed Patterns |
|---|---|
| **Competitor-led** | `[competitor] alternatives`, `alternatives to [competitor]`, `[client] vs [competitor]`, `[competitor] vs [client]`, `best [competitor] alternatives`, `[competitor] competitors` |
| **Objection-led** | `how long does [X] take`, `[product category] migration`, `switching from [competitor]`, `[product category] implementation time`, `[product category] setup`, `[pain] solution` |
| **Feature-led** | `[feature name] software`, `software with [feature]`, `[feature] tool`, `[feature] for [ICP]`, `best [feature] platform` |
| **Use-case-led** | `[product] for [use case]`, `[use case] software`, `[use case] tools`, `best [product category] for [use case]` |
| **Industry-led** | `[product category] for [industry]`, `[industry] [product category] software`, `[industry] [use case] solution`, `best [product] for [industry]` |
| **Pain-led** | `how to [solve the pain]`, `[pain noun] solution`, `[pain] software`, `[problem description] tool`, `[problem] without [pain]` |
| **Winner expansion** | `[existing top keyword] [adjacent modifier]`, `[topic cluster] [related subtopic]`, `[competitor in same cluster]` |

---

## Step 2 — Filter Keyword Candidates

For each keyword returned by Ahrefs:

**Include if:**
- Global volume ≥ 50/mo
- For named competitor alternatives queries: include at ≥ 20/mo — these are high-intent at any volume
- Intent is clearly commercial or transactional, OR informational but the searcher is plausibly on the buyer journey
- The keyword clearly maps to the originating opportunity

**Exclude if:**
- Volume is 0 with no data — flag it and note it, but don't include in the validated pool
- Intent is navigational (someone searching for a brand directly)
- The keyword is so broad it attracts the wrong audience
- The client already ranks positions 1–5 for this keyword (check against the Ahrefs data from the business context step — these are wins, not opportunities)

**Flag for review if:**
- Volume is 0 but the keyword is strategically important (a new competitor, an emerging feature term)
- KD is 70+ but the opportunity is commercially critical

---

## Step 3 — Organize the Candidate Pool

Group all validated keywords by opportunity. For each keyword record:
- Keyword
- Global monthly volume
- Keyword difficulty (KD)
- Top-ranking domain from Ahrefs
- Opportunity it belongs to
- Opportunity type
- Notes (anything unusual — no data, very low volume but high intent, etc.)

---

## Output

Print a summary first:

```
## Keyword Validation Summary — [client]
Date: [today's date]

**Opportunities validated:** [N]
**Total keyword candidates:** [N]
**By opportunity type:**
- Competitor-led: N keywords across N competitors
- Feature-led: N keywords
- Use-case-led: N keywords
- Industry-led: N keywords
- Objection-led: N keywords
- Pain-led: N keywords
- Winner expansion: N keywords

**High-volume candidates (500+/mo):** [list top 10]
**Low-volume but high-intent:** [list notable ones with a note on why]
**Opportunities with no searchable demand found:** [list — these get flagged for reconsideration]
```

Then print the full candidate pool grouped by opportunity, using the field structure from Step 3.

If called standalone, ask: "Save to file? Default: `./keyword-candidates-[domain]-[date].md`"

---

## Rules

- **Ahrefs validates — it doesn't dictate strategy.** An opportunity with weak search volume isn't automatically dead. A competitor comparison at 80/mo is worth pursuing if the commercial signal is strong. Zero volume on multiple seed attempts is a real signal, not a death sentence.
- **Never invent volume figures.** Every number in the output must come from an Ahrefs API call. If Ahrefs returns no data, say so clearly.
- **Work through all opportunities.** Don't stop after the first few high-volume wins. The full inventory needs validation before SERP qualification begins.
- **Flag missing data.** If Ahrefs returns no data for a keyword category, name it in the output — don't silently omit it.
- **Global volume is the default.** Only use country-specific volume if the client explicitly targets one market.
