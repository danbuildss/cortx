---
title: Person
description: "Research sub-page for a specific person. Use for executive briefs, high-stakes outreach, partner intros, or unknown high-signal engagement."
---

## Instructions

Run this only when personalization matters more than volume. For routine outreach, the `Company` brief is enough — don't pay the cost of a deep person research pass.

### Step 1 — Check what you already have

Cheap before expensive:

1. `swan-search-companies` and pull any existing contact records in Swan for the person.
2. If a CRM is connected, search the CRM for the contact by email or LinkedIn URL — prior reps may have notes.
3. `swan-get-memory` (org + company memory) — past briefs on this person may exist.

If a prior dossier exists and is < 30 days old, use it as the base. Refresh only what's stale.

### Step 2 — Enrich the structured profile

`swan-enrich-contact` with the LinkedIn URL or email. Returns role, tenure, work history, location, education. Cheap, fast, structured.

If the contact has no LinkedIn URL yet, run `swan-enrich-email` first to find the work email, then enrich.

### Step 3 — LinkedIn presence and recent activity

`swan-linkedin-social-media-presence` on the profile. From the returned posts, decide in 3–5 lines:

- Active or dormant? (volume in last 90 days)
- What do they post about? (themes, one line)
- What kinds of posts get traction? (engagement skew)
- Any clear signals: hiring announcements, product launches, public opinions on competitors, problem statements.

Don't dump every post — keep the take tight.

### Step 4 — Mention pattern on the web

`swan-fetch-scraped-url` on a Google search like `"<full name>" <company>` to find press, podcasts, talks, GitHub, personal blog. Aim for 1–3 high-signal sources, not exhaustive.

What you're looking for:
- Public talks → topics they care about, recurring themes
- Press quotes → official positioning
- Podcasts → unfiltered priorities and pet peeves
- Personal site or substack → strongest signal of how they think

If nothing useful surfaces after 2 fetches, stop — they're a low-public-profile person and you've learned that.

### Step 5 — Work history pattern

From the enrichment payload, look at the last 3–4 roles. Flag:

- **Tenure** — long stints (3+ years) suggest a builder; short stints suggest a fixer or mover.
- **Industry stickiness** — same vertical for 10+ years signals deep domain identity.
- **Company size trajectory** — startup → enterprise or vice versa signals the environment they choose.
- **Co-workers** — prior managers or peers who may be mutual connections.

One line per pattern. Don't theorize beyond what the data says.

### Step 6 — Mutual connection check

`swan-get-org-senders` to list connected senders. Surface obvious overlap — same prior company, same school, geo, shared LinkedIn 1st-degree connection. Often the warmest entry point.

### Step 7 — Compose the dossier

```
<Full name> — <Title> at <Company>

ROLE
  - one line on scope and reports.

CAREER ARC
  - one line per pattern from Step 5.

RECENT ACTIVITY
  - 3–5 bullets from LinkedIn + web.

WHAT THEY CARE ABOUT
  - inferred priorities, evidence-backed.

WARM PATHS IN
  - mutual connections, shared background, recent engagements.

OUTREACH ANGLE
  - one sentence on the highest-signal hook.
```

End with "Confidence: high / medium / low — based on signal density."

## Rules

- MUST cite evidence per claim. "Active on LinkedIn" alone is not enough; "12 posts in last 30 days, avg 200 reactions" is.
- MUST stop at Step 4 if web research surfaces nothing after 2 fetches. Don't burn credits on a low-public-profile person.
- NEVER invent quotes, beliefs, or priorities not present in the source.
- NEVER use this for volume outreach. Use the lighter `Company` brief instead.
- If a tool result is truncated, read the JSON from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code`.
