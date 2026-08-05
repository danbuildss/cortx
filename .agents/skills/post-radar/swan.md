---
title: Readme
description: "Setup page for post radar. Configures monitored LinkedIn profiles and how engagement should route into follow-up."
---

## Prerequisites

- Integrations: LinkedIn monitoring (Swan-native, requires connected LinkedIn account for the monitored profile)
- A set of LinkedIn profiles to monitor: founders, execs, the company page, competitors, thought leaders — choose the highest-posting profiles
- CRM optional but recommended for ownership routing
- ICP segment defined; persona definitions populated
- At least one sender connected

## Trigger

- Type: `LINKEDIN_ENGAGEMENT`
- Configuration:
  - Monitored profiles: list of LinkedIn URLs (founder personal profile, exec personal profile, company page, competitors)
  - Engagement types: comments (always), reactions (optional — high noise), reposts (always)
  - Minimum comment length: ~15 words (filters emoji-only spam)
  - Excluded company types: vendors, agencies, competitors (use blocklist)

## Sequence

- Step 1: Filter the engagement against noise criteria (length, role, ICP company match).
- Step 2: `swan-enrich-contact` on the engager's LinkedIn URL.
- Step 3: ICP check (`swan-search-companies`) + CRM check (`hubspot-search-objects`) in parallel.
- Step 4: Read the post they engaged with (`swan-fetch-scraped-url` on the post URL).
- Step 5: Pick channel: LinkedIn comment reply, DM, or email.
- Step 6: Draft message referencing post + specific engagement.
- Step 7: Route — auto-send single-touch LinkedIn-first for unowned ICP fit; CRM task for owned accounts.
- Step 8: `swan-update-company` to log the engagement signal.

## Success criteria

Reply rate on LinkedIn engagement-triggered outreach ≥ 25% (significantly higher than cold; engagement is the warmest cold signal). Track engager-to-meeting conversion via `swan-search-sequences`.

## Final step — Rewrite the parent skill's Setup state paragraph

Call `swan-update-skill` on the parent `post-radar` skill and rewrite its `**Setup state.**` paragraph so it describes what was just configured. The rewritten paragraph should list each monitored LinkedIn profile (by name + role: e.g. "founder, CEO, company page, two competitor pages"), the engagement types tracked (comments / reactions / reposts), the noise filters in place (min comment length, blocklist of vendors / agencies / competitors), confirm the sequence is wired, state the success metric being tracked, and include today's date as last-refreshed. Drop the "Not yet configured" wording entirely.

Future invocations of this skill will read the rewritten paragraph and proceed without re-checking state.
