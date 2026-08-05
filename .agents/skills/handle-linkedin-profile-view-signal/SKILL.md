---
name: "handle-linkedin-profile-view-signal"
title: Handle LinkedIn profile view signal
description: "Use this skill when a profile-view webhook (e.g. LeadShark) fires for a new view on a team member's LinkedIn profile. It resolves the viewer's identity and company, applies dedup, internal, relationship, and ICP gates, and routes qualified viewers into the MQL pipeline — treating a profile view exactly like a website visit. The CRM is never polluted: only fully resolved, ICP-matched viewers reach a CRM write."
category: Signals
---

## Template placeholders

Replace every `{{...}}` before enabling. See the setup checklist reference for the full setup list.

- `{{PROFILE_OWNER}}` — Full name of the team member whose LinkedIn is tracked (e.g. "Jane Doe")
- `{{INTERNAL_DOMAINS}}` — Your own company domain(s) (e.g. "acme.com")
- `{{NOTIFICATIONS_CHANNEL}}` — Slack channel reference for outcome/debug posts
- `{{ENRICHMENT_TOOL}}` — Primary contact-enrichment tool available to the agent
- `{{FALLBACK_SCRAPER}}` — Fallback LinkedIn profile scraper (e.g. an Apify actor)
- `{{CRM}}` — Your CRM (e.g. HubSpot)
- `{{CRM_HYGIENE_SKILL}}` — Sub-skill reference: how to create/update companies & contacts in your CRM
- `{{EXISTING_RELATIONSHIP_SKILL}}` — Sub-skill reference: handling accounts with an open/lost deal
- `{{HIGH_INTENT_SKILL}}` — Sub-skill reference: potential-MQL scoring & routing
- `{{AWARENESS_SKILL}}` — Sub-skill reference: net-new ICP awareness logging
- `{{TIER_SCALE}}` — Your lead-score tiers, low→high (default: Bronze / Silver / Gold / Diamond)
- `{{SOLE_SIGNAL_CAP_TIER}}` — Max tier when a profile view is the only 1st-party signal (default: Silver)
- `{{COOLDOWN_WINDOW}}` — Same-session dedup window (default: 1 hour)


### Overview

This skill fires when your profile-view tracker (e.g. LeadShark) detects a new
view on {{PROFILE_OWNER}}'s LinkedIn profile. Goal: behave exactly like a
website visit — resolve the viewer, run the same ICP gate, register them as a
known contact only when they pass, and feed them into the MQL pipeline.

**The golden rule: the CRM is never polluted.** Only a viewer who is
identified + company-resolved + not-internal + not-customer + ICP-matched ever
reaches a CRM write. Everyone else is silently discarded or logged to org
memory only.

The webhook trigger handles only one thing: ignoring events that are not
`new.profile.visit`. All logic lives here.

**Channel rule:** When outreach is triggered by a LinkedIn profile view
signal, keep it LinkedIn-only. Do not create email steps. The contact came to
you via LinkedIn — stay on that channel.

---

### Step 1 — Parse & Validate

The payload arrives as text. Extract the fields listed in
[references/webhook-payload.md](references/webhook-payload.md). Key ones:

- `data.profile_owner` — confirm this is {{PROFILE_OWNER}}; if not, stop silently.
- `data.lead.is_anonymous` — **if true, stop immediately and silently.** No
  enrichment, no CRM writes, no memory writes, no channel post. Anonymous
  viewers (LinkedIn Premium private mode) are fully discarded.
- `data.lead.title` is the LinkedIn **headline** — it often contains no
  company. Never treat it as a company name.
- `data.visit.id` is a stable unique token per visit; `data.lead.actor_id`
  identifies the person across visits.

---

### Step 1.5 — Idempotency (Before Any Enrichment)

Profile-view trackers emit multiple visit records for a single viewing session
— same person, same `actor_id`, different `visit.id` each time. Run two checks
before paying for enrichment:

Read the org-level memory note **"Profile Views — {{PROFILE_OWNER}} —
Processed Visit IDs"** (create it if it doesn't exist). Each entry stores:
`visit.id | actor_id | timestamp`.

**Check 1 — Exact retry guard:** If `data.visit.id` is already in the note →
duplicate webhook redelivery → **stop silently.** No enrichment, no CRM, no
memory writes, no channel post.

**Check 2 — Per-person session cooldown:** If `data.lead.actor_id` appears in
the note with a timestamp within the last **{{COOLDOWN_WINDOW}}** → same
viewing session split into multiple events → **stop silently.**

**Otherwise:** Append `data.visit.id | data.lead.actor_id |
data.visit_timestamp` to the note and continue. Keep only the most recent
~200 entries.

**Critical:** A genuine repeat view from the same person *outside* the
cooldown window has the same `actor_id` but passes both checks and re-scores
as a stronger signal. This is intentional — the cooldown only collapses rapid
same-session duplicates, never real repeat intent.

---

### Step 2 — Resolve Viewer Identity & Company (Mandatory)

Identifying the *person* is not the same as resolving the *company*. You must
have both before proceeding.

**Do NOT infer the company from the LinkedIn headline.** Headlines like
"Product | Strategist | Building 0→1" are not company names.

1. Run {{ENRICHMENT_TOOL}} on `linkedin_username` (or `linkedin_url`) to
   retrieve: current company name, company domain, confirmed job title, and
   country/location.
2. **If {{ENRICHMENT_TOOL}} does not return a confident company name +
   domain** — even if it identified the person — you MUST run
   {{FALLBACK_SCRAPER}} on the profile URL to obtain the current company,
   domain, and country. The fallback is required here, not optional. A guessed
   company is worse than UNRESOLVED.
3. You must exit this step with: viewer full name, confirmed title, **company
   name, company domain** (both required), country.

**Exit condition — UNRESOLVED:** If after both tools you still cannot
confidently determine a company name + domain:
- Set outcome = UNRESOLVED
- Append the raw data (name, title, linkedin_url, visit.id, timestamp) to the
  org memory note **"Profile Views — {{PROFILE_OWNER}} — Unresolved Viewers"**
- Do NOT write anything to {{CRM}}, account memory, or the channel
- Stop.

---

### Step 3 — Internal Check

If the resolved domain is {{INTERNAL_DOMAINS}} or any other internal domain →
stop silently. No CRM, no memory, no channel post.

---

### Step 4 — CRM Relationship Check (Mirror Your Website-Visit Skill)

Look up the company in your workspace + {{CRM}}:

- **Active partner** → stop silently. No CRM writes, no scoring, no channel
  post. Partner accounts are managed by their owner — do not create noise.
- **Current customer (Closed Won)** → set outcome = EXISTING CUSTOMER. Do NOT
  create or update any CRM records. Jump to Step 8.
- **Active deal or Closed-Lost** → open the {{EXISTING_RELATIONSHIP_SKILL}}
  sub-skill and follow it. After it returns, jump to Step 8 with outcome =
  EXISTING RELATIONSHIP.
- **No existing relationship (net-new)** → continue to Step 5.

---

### Step 5 — ICP Check

Compare the company against your ICP segments.

- **Not ICP** → set outcome = NOT ICP. Do NOT create or update any CRM
  records. Do NOT write to account memory. Jump to Step 8.
- **ICP match** → continue to Step 6.

---

### Step 6 — Log Signal & Create/Update Company + Contact in {{CRM}}

**⛔ Hard gate — read before doing anything in this step:**

> Do NOT create or update ANY CRM company or contact, and do NOT write to
> account memory, unless ALL of the following are true:
> (a) the viewer is not anonymous
> (b) the company was confidently resolved to a real domain in Step 2
> (c) the domain is not internal (Step 3 passed)
> (d) the account is not an existing customer (Step 4 passed)
> (e) the account passed the ICP check in Step 5
>
> If any condition fails, skip this step entirely — no CRM writes of any kind.

If all conditions are met:

**Log to account memory:**
```
[PROFILE VIEW — {{PROFILE_OWNER}}] [date] — Visit ID: [visit.id]
Viewer: [full name], [title]
LinkedIn: [linkedin_url]
Connection status: [connection_status]
Company: [company name] ([domain])
Country: [country]
Repeat views: [count of prior profile-view entries in this account's memory + 1]
```

Update the account's state summary in your workspace.

**Create/update Company and Contact in {{CRM}}** following the
{{CRM_HYGIENE_SKILL}} sub-skill:

- Create/update the company record (associate the LinkedIn company page if found)
- Create/update a **Contact record for the viewer**: name, title,
  linkedin_url, company, country — even without an email. Associate
  immediately with the company.
- Add a CRM note on the contact:
  ```
  LinkedIn profile view — {{PROFILE_OWNER}}
  • Viewed {{PROFILE_OWNER}}'s LinkedIn profile on [date]
  • Connection status: [connection_status]
  • Visit ID: [visit.id]
  • Repeat view count from this company: [n]
  ```
- Do **not** invent custom CRM properties to record the visit — the note above
  is sufficient. Only use properties that already exist in your CRM.

---

### Step 7 — Classify Intent & Route to Sub-Skills

**Persona gate (evaluate first — overrides all routing below):**

Before routing, classify the viewer's persona:

- **Strong buyer persona:** CRO, VP/Head of Sales, VP/Head of Marketing, CMO,
  CEO, Co-founder, RevOps Lead, GTM Engineer, Growth Lead, Head of Demand Gen,
  Agency Owner, or equivalent leadership with buying authority for your
  product. *(Adjust this list to your ICP's buying committee.)*
- **Weak/non-buyer persona:** individual contributor (IC), Support, Finance,
  HR, Ops, Analyst, IT/Network Engineer, or any junior title without buying
  authority.

**If the viewer is a weak/non-buyer persona:** Route to
{{AWARENESS_SKILL}} regardless of repeat-view count, connection status, or
stacked signals from prior visits. Do NOT route to {{HIGH_INTENT_SKILL}}. Pass
the note: **"Do NOT send a connection request from {{PROFILE_OWNER}} — viewer
is not a buying persona."** Stacked-signal tier lifts do not apply; the
account stays at {{SOLE_SIGNAL_CAP_TIER}} or below.

**High intent → open {{HIGH_INTENT_SKILL}}** when the viewer is a **strong
buyer persona** AND ANY of:
- Viewer is a strong buyer persona (as defined above)
- Repeat view: 2+ profile-view entries in account memory from this person or
  company in the past 30 days
- `connection_status` = Connected AND persona is at least medium strength

**Awareness → open {{AWARENESS_SKILL}}** when:
- Viewer is a weak/non-buyer persona, OR
- First view from this company AND viewer is a junior/medium persona

When invoking {{AWARENESS_SKILL}} for a weak persona, pass the explicit note:
**"Do NOT send a connection request from {{PROFILE_OWNER}} — viewer is not a
buying persona."**

**Sole-signal cap:** When calling either sub-skill, pass the explicit
instruction: **"Profile view cap: if this LinkedIn profile view is the only
1st-party signal on this account (no website visit, no chatbot conversation,
no reply to outreach, no prior meeting), score must not exceed
{{SOLE_SIGNAL_CAP_TIER}}. Do not score higher on a profile view alone.
Additional signals arriving later can lift this cap."**

When calling either sub-skill, pass this context:
- Signal type: "LinkedIn profile view on {{PROFILE_OWNER}}"
- Repeat view count
- Connection status
- Viewer name, title, LinkedIn URL
- "Vendor/partner check already completed — not a vendor. ICP check already
  completed — is ICP. Company and contact already created/updated in {{CRM}}."

The sub-skills run lead scoring, tier assignment, CRM sync, buying-committee
enrichment, outreach drafting, and alerts. After they return, continue to
Step 8.

---

### Step 8 — Outcome Post to {{NOTIFICATIONS_CHANNEL}}

Post to {{NOTIFICATIONS_CHANNEL}} **only** for these outcomes:
- SCORED
- NOT ICP
- EXISTING CUSTOMER
- EXISTING RELATIONSHIP

**Do NOT post for:** ANONYMOUS (fully silent), UNRESOLVED (not actionable),
INTERNAL (fully silent), or duplicate stops.

Post fires **after** routing and scoring has returned, so the tier is always
known.

**Message format:**
```
👤 [Full Name] — [title]
Company: [company name] ([domain]) | [country]
Connection: [connection_status]
Repeat views: [n] (this company)
LinkedIn: [linkedin_url]

Outcome: [one of]
  SCORED — [tier from {{TIER_SCALE}}]
  EXISTING CUSTOMER — logged, no scoring
  EXISTING RELATIONSHIP — routed to existing-relationship sub-skill
  NOT ICP — no CRM writes, no scoring

What we did: [one line — e.g. "Contact created in CRM, routed to high-intent
sub-skill, scored Gold, alert sent to the MQL channel"]

Execution: [link]
```

---

## What good looks like

A great run means every qualified viewer lands in the CRM fully resolved — real company name and domain, never guessed from a headline — while duplicates, anonymous views, internal views, and non-ICP viewers die silently. Weak personas never trigger connection requests, a lone profile view never scores above the sole-signal cap, and the channel post tells the team in one glance who viewed, the outcome, and exactly what was done.

Mediocre looks like: CRM pollution from headline-guessed companies, repeat-session spam posts, Gold tiers on a single profile view, or noisy posts for outcomes that should be silent.
