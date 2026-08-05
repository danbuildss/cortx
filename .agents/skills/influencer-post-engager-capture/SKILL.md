---
name: "influencer-post-engager-capture"
title: Influencer post engager capture
description: "Use this skill when a tracked influencer publishes a LinkedIn post focused on your product (sponsored, review, or organic mention) and you want to capture the engagers as leads. It verifies the post is genuinely about you, scrapes the full engager list, filters to ICP-fit companies and buyer personas, runs lead scoring, and posts per-lead alerts plus a reconciled digest. Detection and scoring only — no outreach."
category: Signals
---

## Template placeholders

Replace every `{{...}}` before enabling. See the setup checklist reference for the full setup list.

- `{{COMPANY}}` — Your product/company name as it appears in posts
- `{{INTERNAL_DOMAINS}}` — Your company domain(s)
- `{{TEAM_MEMBERS}}` — Full names of your team (filtered out as engagers)
- `{{SIGNALS_CHANNEL}}` — Slack channel for per-lead posts + the digest
- `{{ICP_SEGMENTS}}` — Your target segments (the ICP gate list in Step 4)
- `{{LEAD_SCORING_SKILL}}` — Sub-skill reference: lead scoring & qualification methodology
- `{{TIER_SCALE}}` — Your lead-score tiers, low→high (default: Bronze / Silver / Gold / Diamond)


### Overview

When a tracked influencer publishes a {{COMPANY}}-focused LinkedIn post,
this skill captures ICP-fit engagers (commenters + reactors), runs lead
scoring on their companies, and posts a digest to {{SIGNALS_CHANNEL}}.

### Step 1 — Verify Post Is {{COMPANY}}-Focused

Read the post content. The trigger's topic filter is broad — this step is
the precise check.

**{{COMPANY}}-focused (proceed):**
- {{COMPANY}} is the primary subject of the post
- The post discusses, reviews, recommends, demos, or is sponsored by
  {{COMPANY}}
- {{COMPANY}} is the main topic, not one item in a list

**Not {{COMPANY}}-focused (STOP):**
- {{COMPANY}} is merely listed among other tools (e.g., "Top 10 GTM tools:
  X, {{COMPANY}}, Y...")
- {{COMPANY}} gets a passing mention in a post about something else
- The post is about a competitor and {{COMPANY}} is mentioned tangentially

If not {{COMPANY}}-focused: stop. Do not process engagers. Do not post
anything.

### Step 1b — Like the Post

Before processing engagers, **like the post** using your LinkedIn tools if
available. This is standard practice for all {{COMPANY}}-focused influencer
posts regardless of engagement volume.

### Step 2 — Scrape ALL Engagers from the Post Directly

**Do NOT rely solely on engager data provided by the trigger.** The trigger
delivers engagers one-by-one as they come in — it does NOT provide all
existing engagers at the time it fires. The trigger's engager list is always
a subset of the real total.

**For complete coverage, always scrape the post directly** with your
post-engagement scraper (the tested actors and their exact fields are in
[references/setup-checklist.md](references/setup-checklist.md)):
1. Fetch the post's full comment and reaction list, sorted most-recent
   first, paginating until you have complete coverage
2. Extract every engager: name, profile URL, and headline
3. **Deduplicate against already-processed people** — check execution
   history or account memory to avoid re-scoring someone who was already
   processed in a prior run of this skill on the same post

Then filter as below.

### Step 2b — Filter Engagers

Gather all commenters and reactors from the post data. Skip immediately:

- Company pages — names containing "followers" (e.g., "Acme Inc | 4,206
  followers")
- The post author (the influencer themselves)
- Your team members: {{TEAM_MEMBERS}}
- Anyone whose company is yours ({{INTERNAL_DOMAINS}} domain, or company
  name matching {{COMPANY}})

### Step 3 — Identify Companies via Profile Scraping

Do NOT try to extract company names from LinkedIn headlines. Headlines are
unreliable (personal branding, taglines, multiple pipe-separated fields).
Instead:

1. **Collect all engager LinkedIn URLs** from the post data. Every engager
   has a profile URL.
2. **Batch-scrape the profiles** with your profile scraper in one run (see
   [references/setup-checklist.md](references/setup-checklist.md) for the
   tested actor and field mapping). The scrape returns each person's actual
   current position: company name, company LinkedIn URL, job title, and
   country.
3. **Skip profiles with no current position** (company = N/A) — these can't
   be processed.
4. **Deduplicate** — multiple engagers may work at the same company. Process
   each unique company once.

### Step 4 — Enrich and ICP Gate

For each unique company identified in Step 3:

1. **Search your workspace** for the company by name. If found, check the
   funnel stage (see pipeline check below).
2. **If not found**, enrich the company: first use your free
   business-search tool to find the domain and business ID, then run paid
   enrichment for full firmographics (employee count, revenue, industry,
   funding) only on candidates that survive an eyeball ICP check.
3. **ICP gate** — skip if the company does not match any of your target
   segments: {{ICP_SEGMENTS}}. Skip if clearly outside ICP (wrong business
   model, excluded industries, solo freelancer with no team, wrong geo with
   no relevance).
4. **Pipeline check** — if found in your workspace:
   - Already closed-won, closed-lost, a partner (active or potential),
     unqualified, or self-serve → skip scoring, log the signal in account
     memory only
   - Already at MQL or any later active-deal stage → skip scoring, log the
     signal in account memory only. **Never downgrade a stage.** If the
     account is in an active deal, flag the signal in the digest as a
     "warm signal on active deal."
   - In an early stage (target / aware / nurture / undefined) → proceed to
     scoring
   - Not in the workspace → proceed to scoring (the scoring skill will
     create the company record)

### Step 5 — Run Lead Scoring (One by One)

Process each company that passed the gate **one at a time**, not in batch.
For each:

1. Use your free business-search tool to confirm the domain and business ID
2. If found, run company enrichment for full firmographics
3. If not found in the business database, use web research to find the
   company website and domain
4. Load and execute {{LEAD_SCORING_SKILL}} on the company

The scoring skill handles:
- Vendor/partner checks, self-serve checks, ACV assessment
- Tier production ({{TIER_SCALE}})
- CRM sync, tags, account memory updates
- Alerts for top tiers

LinkedIn engagement is a first-party intent signal that routes to intent
scoring. It should not push an account above the second-lowest tier on its
own.

**After each company is scored, post a dedicated Slack message immediately**
(do not wait to batch all results). See Step 6.

### Step 6 — Post to {{SIGNALS_CHANNEL}}

**For each ICP-fit, scored person** — post a **dedicated top-level message**
(not a thread reply) to {{SIGNALS_CHANNEL}}:

- **Title:** Person name, title, company, and tier emoji
- **Body:**
  - What they did: "reacted to" or "commented on" [influencer name]'s
    {{COMPANY}}-focused post ([post link])
  - Tier (from {{TIER_SCALE}})
  - Funnel stage after scoring
  - Company one-liner: what the company does, size, funding
  - Workspace account link
  - Signal context: any existing signals on this account (prior LinkedIn
    engagement, website visits, etc.)
- **Reply (thread):** Full scoring details — ACV assessment, persona
  quality, signal stack

**At the end of all processing** — post a **summary digest** as a single
message:

- Post URL, date, influencer name, content summary
- X total engagers → Y ICP-fit → Z scored → W skipped (with reasons)
- List of all scored companies with tier
- List of skipped companies with reasons

Use Slack markdown. Keep messages tight.

---

## What good looks like

A great run starts by killing posts that merely mention you in a listicle, then captures the complete engager list (scraped from the post, never just the trigger's subset). Most engagers die at the ICP gate. Each scored company gets one tight per-lead post, and the final digest reconciles perfectly: total engagers → ICP-fit → scored → skipped, with reasons. Active-deal accounts show up as warm-signal flags, never re-scored or downgraded.

Mediocre looks like: processing only the trigger's partial engager list, companies parsed out of LinkedIn headlines, a flooded channel with no digest, or engagement alone pushing an account into a top tier.
