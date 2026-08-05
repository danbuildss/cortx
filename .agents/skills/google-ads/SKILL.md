---
name: google-ads
title: Google Ads for B2B
description: |
  Use this skill when managing Google Ads for B2B — intent-first campaign strategy, account structure, keyword and match-type management, bidding, weekly search term auditing, negatives, Performance Max guardrails, RSAs, and performance analysis.

  Triggers: Google Ads, Google campaign, Google search ads, Google PMax, Performance Max, Google Display, Google Shopping, Google ad performance, Google keyword, search terms, Google RSA, Google bidding.
category: Ads
---

# Google Ads Management

Orchestrator for Google Ads strategy and campaign management. It grounds every recommendation in a consistent B2B demand-generation methodology.

## Methodology

This skill implements an intent-first B2B demand generation approach for Google Ads. It captures existing demand through systematic keyword targeting, proves unit economics on the highest-intent terms first, then expands outward.

## Core Philosophy

**Intent is everything. Capture demand before you create it.**

Google Ads is the strongest channel for capturing existing demand. People are actively searching for solutions - the job is to be there at the right moment with the right message. Start with high-intent keywords (brand and solution-aware), prove unit economics, then expand outward to medium and low intent, and finally to awareness.

## Knowledge Base

Ground all strategy in these files. Read the relevant one before advising.

| File | Contains | Read When |
|------|----------|-----------|
| [references/intent-first-strategy.md](references/intent-first-strategy.md) | Intent ladder (brand, high-intent, competitor, problem-aware, demand-gen), capture-before-create, B2B realities | Any strategy or planning question, prioritizing spend |
| [references/account-structure.md](references/account-structure.md) | Splitting by intent, themed ad groups (not SKAGs), naming, network and geo defaults, when to consolidate | Setting up or restructuring an account |
| [references/keyword-and-match-types.md](references/keyword-and-match-types.md) | Match type progression, B2B keyword research, negatives, avoiding self-competition | Building keyword lists, choosing match types |
| [references/bidding-strategy.md](references/bidding-strategy.md) | Bidding by conversion volume, tCPA and tROAS, setting and moving targets, the optimize-to-quality trap | Choosing or changing a bid strategy |
| [references/search-terms-and-negatives.md](references/search-terms-and-negatives.md) | Weekly search terms ritual, what to negative, negative match types, shared lists | Weekly optimization, cutting waste |
| [references/benchmarks-and-measurement.md](references/benchmarks-and-measurement.md) | B2B SaaS benchmark ranges, metrics that matter, offline conversion import, weekly scorecard | Performance review, expectations, measurement setup |
| [references/performance-max-b2b.md](references/performance-max-b2b.md) | When and when not to run PMax, guardrails (brand exclusions, signals, negatives), reading PMax | PMax questions, scaling beyond Search |
| [references/rsa-and-landing-pages.md](references/rsa-and-landing-pages.md) | RSA assets, pinning, writing to intent, landing page message match, Quality Score | Writing ads, improving CVR or Quality Score |
| [references/cheatsheet-overview.md](references/cheatsheet-overview.md) | Campaign types cheatsheet (Search, Shopping, Display, PMax, Video) | Quick campaign-type selection |

## Routing Logic

| User Intent | When to Use |
|-------------|-------------|
| Account analysis, performance review | Start with the big picture, then drill into top-spending campaigns and ROAS |
| Search term waste | Filter for terms with spend and no conversions, add negatives |
| Keyword optimization | Read keyword-level performance and Quality Score |
| Create new campaign | Follow the intent-first build order, start PAUSED |
| Pause, enable, or budget changes | Review setup before enabling any spend |
| Strategic campaign planning | Load the knowledge base files above |

## Core Rules

1. **Always start PAUSED.** Never create campaigns in ENABLED state. Review everything before turning on spend.

2. **Check search terms weekly.** The search terms report is the single biggest optimization lever. Find irrelevant terms, add negatives, discover new keyword opportunities.

3. **Build bottom-up by intent.** Start with brand and high-intent keywords. Prove they convert. Then expand to medium intent, then low intent and awareness.

4. **Match type strategy matters.** Start with Phrase match for control, expand to Broad match only with Smart Bidding and sufficient conversion data (roughly 30+ conversions per month).

5. **Quality Score drives costs.** Monitor Quality Score on keywords - low scores mean ad relevance or landing page issues. Fix those before increasing bids.

6. **RSA best practices.** 8-10 unique headlines, 3-4 descriptions. Pin critical brand or CTA copy to position 1 only when it must always show. Let Google optimize the rest.

7. **Speak from this methodology directly and with conviction.** Avoid padding with generic best practices.

## Campaign Types - When to Use What

| Type | Use Case | When |
|------|----------|------|
| Search | High-intent keyword capture | Always - this is the foundation |
| Performance Max | Broad AI-driven across all networks | After Search proves unit economics |
| Display | Remarketing and awareness | Remarketing first, prospecting second |
| Shopping | E-commerce product ads | Product catalog campaigns |
| Video (YouTube) | Brand awareness and remarketing | After core campaigns are profitable |

## Key Metrics to Watch

| Metric | What It Tells You |
|--------|------------------|
| Search Impression Share | How much demand you are capturing |
| Quality Score | Ad and landing page relevance |
| Cost per Conversion | Unit economics |
| ROAS | Revenue efficiency |
| Search Terms (no conversions) | Budget waste |
| Top Impression % | Ad position competitiveness |
