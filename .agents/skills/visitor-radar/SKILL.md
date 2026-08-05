---
name: "visitor-radar"
title: Visitor radar
description: "Acts on content or website engagement from prospects. Qualifies the person, identifies the engagement hook, and drafts contextual follow-up based on their interest."
category: Signals
---

## Instructions

**Setup state.** Not yet configured for this org. Load the `Setup` sub-page and walk the user through wiring the visitor-radar trigger (`WEBSITE_VISIT`, webinar / video `WEBHOOK`, or the CRM's form-fill workflow) with the right page / form / engagement filters, and wire the follow-up sequence, before running this play. (After setup is performed, rewrite this paragraph via `swan-update-skill` to describe the current state — trigger type chosen, monitored pages / forms / events with thresholds, exclusion filters, sequence wired, success metric, and last-refreshed date — so future runs see the current configuration without re-checking.)

### When this fires

`WEBSITE_VISIT` (Swan-native website tracking), `WEBHOOK` (from a webinar / video / analytics platform), or the CRM's workflow trigger (if the CRM is wired to track form fills, list membership, or page visit thresholds — discover via `swan-get-available-triggers`). Payload includes: engager identity (email, LinkedIn, or anonymous company-level), content engaged with, engagement depth (time on page, completion %, multiple visits).

### Step 1 — Filter for signal strength

Not all engagement converts. Tiered priority:

| Engagement | Signal strength |
|------------|-----------------|
| Pricing page > 60s, repeat visits | HIGH |
| Demo / sales page > 60s | HIGH |
| Gated asset download with title + company | HIGH |
| Webinar attended live | HIGH |
| Case study or comparison page visit | MEDIUM |
| Webinar registered but no-show | MEDIUM |
| Blog post read, no other activity | LOW |
| Anonymous company visit, no contact | LOW (act at account level) |

Skip LOW unless they're a known target account or multi-visit pattern emerges.

### Step 2 — Resolve identity

If the trigger payload has an email, that's enough. If anonymous-company-only (from website tracking), use `hubspot-search-objects` to check whether any known contact at the company has had recent activity — that's probably who visited.

For form fills with email but no LinkedIn URL, `swan-enrich-email` to find the LinkedIn, then `swan-enrich-contact` for the full profile.

### Step 3 — CRM context

`hubspot-search-objects` (companies, contacts, deals). Outcomes:

- **Known prospect in active sequence** → DON'T fire a new outreach; let the sequence breathe. Surface to the rep as engagement.
- **Known prospect, no recent activity** → re-engagement play
- **Customer engaging with content** → route to CSM as an expansion signal
- **New unknown contact at known account** → multi-thread opportunity
- **Net new** → cold play with the content as personalization

### Step 4 — Match the content to the angle

The content they engaged with IS the angle. Don't pivot to a different topic.

- They read your "outbound playbook" → reach out about outbound scaling
- They watched the demo video → offer a live demo with a specific use case
- They downloaded the ROI calculator → offer to help model their numbers
- They attended a webinar on X → follow up with the same X story tailored to their company

### Step 5 — Time the response

Speed correlates strongly with conversion on content engagement:

| Engagement type | Reach out within |
|-----------------|------------------|
| Pricing page visit | 24 hours |
| Gated asset download | 24 hours |
| Webinar attended live | 24-48 hours |
| Multiple-content engagement burst (3+ in 7 days) | 24 hours |
| Single asset, low-signal | 3-5 days |

### Step 6 — Draft the message

Template by content type:

**Pricing page:**
> "Hi [name] — saw you spent time on our pricing page. Happy to walk through the right tier for [their stage] and answer any questions before you make a call. 20m?"

**Gated asset:**
> "Hi [name] — appreciated you downloading [asset title]. Most teams who read it are working on [implied problem]. Curious — is that what's on your plate? Happy to share what's worked for [proof point]."

**Webinar attendance:**
> "Hi [name] — thanks for joining [webinar topic]. The question that came up most was [specific question]. Curious how you're thinking about it at [their company]?"

Always: reference the specific content. Generic "thanks for visiting our site" is worse than not reaching out.

### Step 7 — Channel and routing

For owned accounts: `hubspot-create-task` for the owner — let the rep act, not the system.

For unowned prospects (ICP-fit, no active sequence): hand off to `reach-out` or `swan-build-sequence`. Single-touch first; the engagement signal warrants a soft, not a 5-step cadence.

### Step 8 — Log and learn

`swan-update-company` to tag the company with the engagement type. Over time, which content surfaces best-converting leads becomes obvious — feed that back into marketing.

### Rules

- MUST reference the specific content engaged with. Generic outreach negates the signal's warmth.
- MUST act inside the time window for the engagement type. Pricing-page-visit replied to in week 2 is wasted.
- MUST check for active sequences before firing — don't spam someone the system is already messaging.
- NEVER pretend the engagement wasn't observed. If you're going to message them about the gated asset they just downloaded, be straightforward about it.
- NEVER pitch hard on the first touch. The engagement bought a conversation, not a demo booking.
- If the engager is anonymous and you can't resolve them, fire an account-level alert (`hubspot-create-task` on the company) rather than a cold individual outreach.
- If a tool result is truncated, read from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code`.

### Tighten over time

After 10-20 fires, read recent reply-rate data via `swan-search-sequences` filtered to this play's executions. Identify which engagement types (pricing visits vs gated asset downloads vs webinar attendance) converted at higher rates. Recommend the user drop LOW-signal tiers from the trigger, raise minimum time-on-page, or restrict to specific high-converting pages before the next batch.
