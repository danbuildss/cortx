---
name: "post-radar"
title: Post radar
description: "Acts on engagement with monitored LinkedIn profiles. Qualifies commenters or reactors, checks fit, and drafts contextual follow-up tied to the actual post."
category: Signals
---

## Instructions

**Setup state.** Not yet configured for this org. Load the `Setup` sub-page and walk the user through wiring the `LINKEDIN_ENGAGEMENT` trigger with the right set of monitored profiles (founder, execs, company page, competitor pages, thought leaders), engagement types, noise filters, and follow-up sequence before running this play. (After setup is performed, rewrite this paragraph via `swan-update-skill` to describe the current state — monitored profile list, engagement types tracked (comments / reactions / reposts), noise filters applied, sequence wired, success metric, and last-refreshed date — so future runs see the current configuration without re-checking.)

### When this fires

A `LINKEDIN_ENGAGEMENT` trigger lands. Payload includes: the post URL, the post content (or summary), the engager's name + LinkedIn URL, engagement type (comment / reaction / repost), and the comment text if it's a comment.

Speed matters. Replying within 24 hours converts much better than 72+ hours.

### Step 1 — Filter the noise

Not every engagement is worth acting on. Quick filters:
- **Generic emoji-only reactions** → low signal, skip unless they're a high-value account
- **One-word comments** ("Love this!", "100%") → skip unless from an ICP-fit person
- **Competitors and vendors** → never engage as a sales motion; flag for awareness only
- **Existing customers** → route to CSM, not to outbound
- **Internal employees** → skip

Set a minimum threshold: comments ≥ ~15 words, or any engagement from a known ICP company.

### Step 2 — Enrich the engager

`swan-enrich-contact` with the LinkedIn URL. Returns: title, company, tenure, role family.

Cheap and necessary. The engager's title + company are the two things that determine the right reply.

### Step 3 — ICP and CRM check in parallel

Two checks:
1. **ICP fit** — does the engager's company match the org's ICP? Use `swan-search-companies` for the domain; if not in Swan, briefly check firmographic match.
2. **CRM relationship** — `hubspot-search-objects` (contacts, filter by email or LinkedIn URL). Is this person already in the system? Is there an active deal or owner?

Outcome routing:
- ICP fit + no relationship → cold outreach play, draft message
- ICP fit + active relationship → route to owner with a "they engaged on your post" alert
- Non-ICP but interesting → flag for awareness, no outreach
- Non-ICP and noise → discard

### Step 4 — Read the post they engaged with

The engager interacted with specific content. The reply must reference what they actually engaged with — generic "saw your comment" outreach is worse than ignoring them.

`swan-fetch-scraped-url` on the post URL if the trigger payload didn't include the full post content. Otherwise use what's in the payload.

Extract: the post's topic, the angle of their comment / reaction, any specific question or statement they made.

### Step 5 — Choose the response channel

LinkedIn engagement begets LinkedIn response. Options:

- **LinkedIn comment reply** — public, low-commitment, opens a conversation
- **LinkedIn DM / connection request** — direct, slightly more aggressive
- **Email follow-up** — if the relationship warrants and the email is known, fine to escalate

Default is LinkedIn comment reply first, then DM if they respond.

### Step 6 — Draft the response

Templates:

**Reply to a substantive comment:**
> "[Engager], totally agree on [their specific point]. We see the same with [your customers] — usually it shows up as [specific manifestation]. Curious how you're thinking about [their stated challenge]."

**DM after a reaction-only signal (lower priority):**
> "Hey [name] — noticed you reacted to [post topic]. We work with [persona] on [adjacent problem] — would love to hear how you're approaching it at [their company]."

Keep it short. Sales-y openings kill the warmth of the signal.

### Step 7 — Route or send

For unowned ICP-fit prospects: hand off to `reach-out` or call `swan-build-sequence` (single-touch LinkedIn-first, no aggressive cadence).

For owned accounts: `hubspot-create-task` for the owner with the post URL, the engager, and a suggested message. Don't auto-send into a rep's territory.

### Step 8 — Log

`swan-update-company` to tag the engager's company with the engagement signal. `swan-save-message-example` if the message style was approved — feed the engagement-reply voice back into the org's tone library.

### Rules

- MUST reply within 24 hours to retain the warmth advantage.
- MUST reference the specific post and the engager's specific action. Generic outreach negates the signal.
- MUST check ICP fit and CRM ownership before drafting.
- NEVER pitch in the LinkedIn comment thread. Use the comment to start a conversation; pitch in DM or email.
- NEVER message every reaction. Filter aggressively to substantive comments + ICP fit.
- NEVER reply to competitor or vendor engagement as a sales motion.
- If the engager has engaged on multiple posts in the last 90 days, treat as a hot signal — escalate priority. `swan-linkedin-social-media-presence` on the engager can surface this.
- If a tool result is truncated, read from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code`.

### Tighten over time

After 10-20 fires, read recent reply-rate data via `swan-search-sequences` filtered to this play's executions. Identify which monitored profiles produced highest-converting engagers (often founder + one named exec dominate). Recommend the user drop low-yield monitored profiles, raise the minimum comment-length threshold, or restrict to ICP-fit companies only before the next batch.
