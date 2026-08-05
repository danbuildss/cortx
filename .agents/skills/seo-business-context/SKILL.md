---
name: "seo-business-context"
title: Business context ingestion
description: "Use this skill when starting SEO or content work for a client and you need a complete account intelligence document first — what they sell, who they sell to, what they want to sell more of, and what already works. Fires on \"onboard this SEO client\", \"build account context\", or before any keyword research. Pulls the live website, Ahrefs site data, call transcripts, and client comms into one confirmed picture. Phase 1 of the SEO topic research pipeline; runs standalone."
category: SEO
---

Build a complete account intelligence document before any keyword research begins. The system needs to understand the account — what they sell, who they sell to, what they want to sell more of, and what already works — or it produces keyword output disconnected from commercial reality.

This is not topic research. This is account understanding.

## Invocation

`/business-context <client-domain>`

Example: `/business-context risevision.com`

---

## Step 0 — Input Gathering

Ask the user once, in one message (skip if called from `/topic-research` pipeline):

> "To build the account intelligence document, tell me what you have available. Share anything you have from this list:
>
> 1. **SEO onboarding form** — paste it here.
> 2. **Sales or discovery call transcripts** — paste key sections or the full transcript.
> 3. **Slack or client comms** — paste relevant threads where the client described goals, priorities, or problems.
> 4. **Competitor list** — any competitors the client specifically named? I'll also pull from Ahrefs.
> 5. **Product or positioning docs** — paste or describe.
> 6. **Existing content inventory** — a page list, sitemap URL, or rough description of what exists.
> 7. **Any specific ICPs, verticals, or segments they've explicitly said they want or don't want?**
>
> Paste whatever you have. I'll fetch the website automatically and pull Ahrefs data. Share what you've got and I'll flag what's missing."

Wait for the user's response before proceeding.

---

## Step 1 — Website Intelligence

Run in parallel using WebFetch:

**A. Homepage**
Fetch `https://<domain>`. Extract:
- What the product is in plain English (not marketing language)
- Core value proposition
- Who it's for (roles, company sizes, industries named)
- Core capabilities highlighted
- Navigation structure — what product areas exist
- Any pricing signals
- Customer logos or case study references

**B. Key internal pages** — pick the most relevant from navigation and run in parallel:
- `/features` or `/product` — exact feature names as the product calls them
- `/pricing` — plan tiers, pricing model, what's in each tier
- `/solutions` or `/use-cases` — named ICP segments and use cases
- `/customers` or `/case-studies` — who buys, what outcomes they achieve
- `/about` — company stage, size, positioning context
- `/integrations` — which tools they connect with (signals buyer stack)
- `/blog` or `/resources` — what content themes they've published

Extract from all pages:
- Exact product and feature names (not paraphrases)
- Exact customer segments named on the site
- The language the product uses for its own outcomes and categories
- Any claims about differentiation

**C. Ahrefs site intelligence** — run in parallel with the web crawl:
- `site-explorer-metrics` — DR, organic traffic, organic keyword count
- `site-explorer-top-pages` (limit: 20) — top pages by traffic to understand what already works
- `site-explorer-organic-keywords` (limit: 50) — current rankings, especially positions 1–20
- `site-explorer-organic-competitors` (limit: 10) — top organic competitors

**D. GSC data (if available):**
- `gsc-keywords` (limit: 50) — what queries are already driving traffic
- `gsc-pages` (limit: 20) — which pages are performing

---

## Step 2 — Process Contextual Sources

Process whatever the user provided in Step 0.

**From call transcripts and onboarding forms, extract:**
- What the client said they want to rank for (stated goals)
- What the client said they want to avoid
- Which competitors came up by name — in what context (fear, aspiration, repeated mention)
- Which product features or differentiators were emphasized
- Which customer segments or ICPs were called out explicitly
- Objections that came up — what did buyers push back on during sales
- Any conversions or wins mentioned — what pages, keywords, or content drove pipeline
- The client's actual business goal (pipeline, brand, specific product line, specific vertical)

**From comms and Slack, extract:**
Any stated priorities, frustrations, requests, or preferences that reveal what the client values and what they're afraid of.

**From positioning and product docs, extract:**
- How the company positions itself against competitors
- Which features they lead with in sales vs. support with
- What customer outcomes they promise
- Any segments they explicitly pursue or avoid

---

## Step 3 — Synthesize Account Intelligence

Cross-reference everything from Steps 1 and 2. Build and print the Account Intelligence Document in full:

```
## Account Intelligence — [client domain]
Date: [today's date]

### What They Sell
[Plain-English description. What it does. Who uses it. How it works at a high level.]

### Commercial Priorities
[What the client actually wants to sell more of — specific products, plans, ICPs, or verticals. What did they say in calls? What's the commercial focus, distinct from what the website says?]

### ICP (Ideal Customer Profile)
[Specific roles, company sizes, industries. Distinguish between who they currently sell to and who they want to sell to — these are often different.]

### Features and Differentiators That Matter Commercially
[The product capabilities that come up in sales, that clients care about, that drive deals. Use exact product names from the site — not paraphrases.]

### Competitor Landscape
[Which competitors come up most. In what context — named in calls, appearing in Ahrefs data, or both? Which are the most commercially significant?]

### Objections and Friction Points
[What comes up as hesitation in sales. "Implementation takes too long." "It's too expensive." "We already tried X." These are content opportunities.]

### What Already Works
[Pages already ranking. Topics with existing traffic. Any content the client flagged as performing. Ahrefs top pages and GSC winners.]

### What They Want to Avoid
[Segments, topics, or positioning they've explicitly ruled out. This shapes every downstream recommendation.]

### Current Organic Authority
- Domain Rating: [X]
- Monthly organic traffic: [X]
- Organic keywords: [X]
- Top organic competitors: [list]
- Ranking strengths: [topic clusters or pages already working]

### Gaps and Flags
[What's missing from the intelligence. What would change the recommendations if known. What to confirm with the client.]
```

After printing, ask: "Does this account picture look right? Anything wrong, missing, or to add before I extract opportunities?"

Wait for confirmation or edits before proceeding.

---

## Step 4 — Save

Save the Account Intelligence Document to: `./account-intel-[domain]-[date].md`

Print: `Account intelligence saved to [path]`

---

## Rules

- **Never invent product facts.** Only use what was found on live pages or provided by the user. Flag anything unclear.
- **Pull from transcripts, not just the website.** The website shows what the client wants to project. Transcripts show what's actually happening in sales.
- **Distinguish stated goals from commercial priorities.** A client saying "we want more brand awareness" when they actually need competitor alternative pages is a gap worth naming.
- **Competitors named in calls > competitors Ahrefs suggests.** If a competitor came up in a sales conversation, it's commercially significant regardless of SEO volume.
- **The "what to avoid" section is mandatory.** It prevents the worst downstream recommendations. If nothing was stated, say so explicitly.
