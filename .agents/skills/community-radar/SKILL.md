---
name: "community-radar"
title: Community radar
description: "Monitors public community or social mentions of the brand, competitors, or relevant pain language. Classifies sentiment and drafts short, human replies for the right responder."
category: Signals
---

## Instructions

**Setup state.** Not yet configured for this org. Load the `Setup` sub-page and walk the user through wiring the community-radar trigger (`SCHEDULE` + Apify search actors across LinkedIn / X / Reddit / Hacker News, or `WEBHOOK` from a social listening tool the user already pays for) with the org's brand-and-pain-language keyword list, the platforms to monitor, and the follow-up sequence before running this play. (After setup is performed, rewrite this paragraph via `swan-update-skill` to describe the current state — trigger type chosen, keywords / brand terms / pain-language phrases monitored, platforms covered, sequence wired, success metric, and last-refreshed date — so future runs see the current configuration without re-checking.)

### When this fires

A `SCHEDULE` trigger running an Apify search actor (LinkedIn search, X / Twitter search, Reddit search, Hacker News scrape) surfaces new mentions of the configured keywords. Or a `WEBHOOK` from a social listening service the user already pays for (Brand24, Mention, Hootsuite, Triggify, custom Reddit / X monitoring) pushes mentions in. Payload includes: platform, author, mention text, post URL, engagement metrics on the parent post.

Note: `LINKEDIN_ENGAGEMENT` is *not* the right trigger here — that one follows specific LinkedIn profiles. For keyword-driven brand-mention sweeps across LinkedIn, use `SCHEDULE` + an Apify LinkedIn-search actor.

The window is short on public social — 24-48 hours feels reasonable; > 1 week and the reply looks bot-driven.

### Step 1 — Classify the mention

| Class | Pattern | Right move |
|-------|---------|------------|
| **Direct praise** | "We love [your product]" | Like, optional thank-you reply. Resharable. |
| **Customer Q / mild frustration** | "How do I do X in [your product]?" | Helpful reply from support handle. Resolve the question. |
| **Public complaint** | "[Your product] is broken / disappointing" | Acknowledge, DM to take offline, don't argue publicly. |
| **Comparison shopping** | "Looking at [you] vs [competitor]" | Soft entry; offer to help with the eval. Don't trash competitor. |
| **Competitor switch signal** | "Just switched off [competitor]" + same thread mentions you | High-value lead; warm DM. |
| **Pain mention (your wedge, no brand)** | "Why can't I find a tool for X" | Soft helpful reply. Don't pitch — offer perspective. |
| **Generic noise / spam / off-topic** | — | Ignore. |

### Step 2 — Identify the author

`swan-fetch-scraped-url` on the author's profile (LinkedIn, Twitter bio, Reddit profile). Capture: role, company, follower count, post pattern. Don't enrich if it's clearly noise.

For LinkedIn: `swan-enrich-contact` if they look ICP-fit.
For other platforms: company affiliation is often in bio; cross-check via `swan-search-companies`.

### Step 3 — ICP and CRM context

For mentions from ICP-fit authors:
- `swan-search-companies` + (if new) `swan-enrich-company`
- `hubspot-search-objects` for existing relationship

For non-ICP: still respond if it's a complaint or Q (support obligation), but don't pursue.

### Step 4 — Choose the right responder

Public replies should come from the right account:

| Class | Right responder |
|-------|-----------------|
| Praise | Founder / CEO (high-status reply) |
| Customer Q | Support handle / CSM |
| Complaint | Support handle, then CSM via DM |
| Comparison shopping | AE, via DM not public comment |
| Switch signal | AE, via DM, fast |
| Pain mention | Founder / thought leader, public comment |

If multiple senders are connected, pick the one whose voice fits the moment. Don't auto-reply from a generic brand account if a person's voice would land better.

### Step 5 — Draft the reply

Templates:

**Public complaint:**
> "Sorry to hear this. DMing now — want to get this sorted today."
> (Then DM with substance and a fix.)

**Comparison shopping (DM):**
> "Saw your post — happy to help with the eval, no pitch. What matters most for you in [category]? I can be straight about where we win and where we don't."

**Pain mention (no brand):**
> "Same — this is one of those problems that's worse than people say. Our take: [one-line perspective]. Happy to share more if useful."

**Switch signal (DM):**
> "Just saw your post about leaving [competitor] — congrats on the cleanup. If [your product] is on the eval list, glad to give you the no-pitch tour."

Critical: short, human, no marketing. Public social rewards low-key over polished.

### Step 6 — Channel: public reply vs DM

Default to DM for anything sales-adjacent. Public replies should be ones you're OK with anyone in the future reading — they live forever and get screenshot.

Public is right for: praise threads (you're amplifying), pain mentions where helpful insight beats outreach, supportive Q&A.

### Step 7 — Route or send

For LOW-stakes (praise, generic Q): the system can auto-reply with the right account. Surface for approval if voice matters.

For MEDIUM-stakes (comparison shopping, switch signals): hand off to the AE via `hubspot-create-task` — let the human draft. Sales DMs need human nuance.

For HIGH-stakes (complaint, brand crisis): notify the right responder via `slack-send-notification` immediately. Don't let a slow CRM task be the bottleneck.

### Step 8 — Log

`swan-update-company` to log the mention. If a complaint, log both the issue and the resolution path. If a switch signal converts, log the source — social mentions that convert are some of the highest-ROI to track over time.

### Rules

- MUST classify the mention before drafting. The reply for praise and the reply for complaint are different jobs.
- MUST keep public replies human and low-key. Polished marketing in a Reddit thread is brand suicide.
- MUST DM-not-public for anything sales-adjacent.
- NEVER argue publicly with a complaint. Acknowledge, take it offline, fix it.
- NEVER name a competitor pejoratively in a public reply. Even if the OP did.
- NEVER auto-reply to high-stakes mentions. Humans only.
- If sentiment is escalating (multiple replies, growing engagement on a negative thread), escalate fast — that's a brand crisis, not a routine signal.
- If a tool result is truncated, read from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code`.

### Tighten over time

After 10-20 fires, read the responder log via `swan-search-sequences` and review which mention classes actually converted (switch signals and comparison shopping usually outperform pain mentions). Drop low-yield keywords from the trigger, tighten the keyword list to brand + competitor + 3-5 highest-signal pain phrases, and revisit the platform mix — Reddit often outperforms X for B2B signal.

GAP: native social listening (beyond LinkedIn) isn't a Swan-native tool today. Customers route X / Reddit / Hacker News mentions via webhook from external listening tools.
