---
name: research
title: Research
description: "Researches a company, person, buying committee, signal, domain, stack, financial context, or competitor mention. Produces a focused answer with sources and confidence notes."
category: Research
---

## Instructions

Research is target-driven and doesn't require org config to function — there's no state-hint paragraph and no `Setup.md`. The agent just routes to the right sub-page and runs.

### Step 1 — Parse the ask, pick the sub-page

Route based on what the user is asking about. Load the sub-page via `swan-get-skill`.

| Ask shape | Sub-page |
|-----------|----------|
| Generic company / one company / "what does X do" / "/research acme" | `Company` |
| Named person — "/research tom from acme", "tell me about Jane Doe" | `Person` |
| Mapping the people inside one account — buying committee, who to thread to | `AccountTeam` |
| How does the target sell / their GTM / pricing posture | `GTMmotion` |
| What's recent / news / signals / last-30-days | `News` |
| Domain-level / web traffic / SEO / digital footprint | `Domain` |
| Financial health / funding / revenue / runway / ownership | `Financial` |
| Tech stack only — what tools do they run | `TechStack` |
| Where the target talks about competitors / displacement signals | `CompetitorMentions` |

If the ask is ambiguous (e.g. just a company name with no further context), default to `Company`. If the ask explicitly chains multiple facets ("research acme — company plus the buying committee"), it's fine to load two sub-pages — but always pick a primary.

### Step 2 — Pick the depth

Most asks want a one-paragraph answer; some want a dossier. Read the user's phrasing:

- "/research acme" / "what does acme do" → brief read (3–5 lines, the essentials).
- "deep brief on acme" / "full dossier" / pre-meeting prep with a VP+ → run the sub-page end-to-end.
- "quick — is acme an ICP fit" → micro-answer, one paragraph.

Default to brief. Scale up only when the user signals depth, or when the situation (board prep, founder intro, executive outreach) demands it. Over-researching when a sentence would do is the most common failure mode.

### Step 3 — Load the sub-page and execute

The sub-page owns the procedure for its facet. Follow it.

Across all sub-pages, the same cheap-before-expensive pattern applies:
- check what Swan already has (`swan-search-companies`, `swan-get-memory`, prior briefs)
- check the CRM if connected
- reach for free preview tools (`swan-fetch-scraped-url`, `swan-fetch-businesses`, `swan-website-traffic`, `swan-fetch-business-events`) before paid enrichment
- enrich (`swan-enrich-company`, `swan-enrich-contact`) only when the cheap signals left a real gap

### Step 4 — Output shape

Default to a structured short summary, not raw scraped data. Every sub-page ends with a composed block — follow its shape. Always:

- Cite sources inline (e.g. "via `swan-website-traffic`", "from LinkedIn post 2026-05-03", "press").
- Flag confidence on soft signals (high / medium / low based on signal density).
- Surface the highest-signal finding first. Don't bury the lede in a wall of context.
- Tag the company in Swan via `swan-update-company` when the research produced a durable fact worth reusing (financial state, tech stack, motion type) so the next play inherits it.

---

## What good looks like

- **Right depth for the ask.** A one-paragraph answer when a paragraph is enough; a full dossier when the stakes justify it. Reading the room beats running every facet.
- **Sources cited, confidence flagged.** Every claim points to a tool result, a URL, or a CRM record. Soft signals (inferred revenue, motion type, runway) carry an explicit "est" or "looks like" — never stated as fact.
- **Lede first.** The user sees in 30 seconds what they came for. The strongest hook is line one of the output, not buried below firmographics.
- **Knows when to stop.** If business events covered the surface area, no more web fetches. If a person has no public profile, the dossier says so and ends.

What gets overlooked:
- **Over-researching.** Running every sub-page when only one matters. Running the deep flow when a brief was the right call.
- **Treating all signals as equal-confidence.** Headcount × industry-avg as a revenue figure stated like a fact. Inferred motion stated without hedge.
- **Raw dumps.** Pasting 40 LinkedIn posts, 200 keywords, or the full enrichment payload into the chat. Synthesize, then summarize.

---

## Rules

- MUST pick a single sub-page per call unless the user explicitly asks for multi-facet research.
- MUST cite sources inline and flag confidence on soft signals.
- MUST check the free preview tools (`swan-fetch-scraped-url`, `swan-fetch-businesses`, `swan-website-traffic`, `swan-fetch-business-events`) before chaining paid enrichments.
- MUST tag the company in Swan with any durable fact (motion type, financial state, detected stack, ICP fit) the research produced.
- NEVER produce a raw dump. Always synthesize into the sub-page's composed output shape.
- NEVER invent quotes, beliefs, financials, or priorities not present in the source.
- NEVER chain `swan-enrich-company` or `swan-enrich-contact` calls without first checking what Swan and the CRM already have.
- If a tool result is truncated, read the JSON from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code` and summarize from there.

---

## Specificity sub-pages this skill will grow

Shipped today:

- `Company` — general company research (the default landing for "/research acme")
- `Person` — full dossier on a named person
- `AccountTeam` — buying-committee mapping inside one account
- `GTMmotion` — how the target sells today
- `News` — last-30-days signal scan
- `Domain` — digital footprint, traffic, SEO posture
- `Financial` — funding history, ownership, runway, pressure
- `TechStack` — detected tools by category
- `CompetitorMentions` — public mentions of a named competitor

Accreted over time as use cases sharpen:

- `AcquisitionTargets` — research for M&A or partnership shortlists
- `CustomerHealth` — research framing for an existing customer (expansion / churn risk)
- `IndustryDeepDive` — a whole vertical, not one account
- `Investor` — partner / fund research
- `Board` — board prep on a director or chair
