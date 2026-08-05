---
title: Readme
description: "Setup page for community radar. Configures monitored communities, keywords, sentiment handling, and routing for public replies."
---

## Prerequisites

- A social listening service (Brand24, Mention, Hootsuite, custom Reddit / X scraper) OR LinkedIn brand-mention monitoring via Swan-native LinkedIn integration
- Documented brand terms, product names, exec personal names, and pain-language keywords worth tracking
- ICP segment and persona definitions populated
- Senders connected — multiple if possible (CEO / founder voice, support voice, AE voice)
- Slack integration recommended for HIGH-stakes alerts
- CRM optional

## Trigger

- Type: `SCHEDULE` + Apify (primary — Swan runs the scrape on a cadence using an Apify LinkedIn-search / X-search / Reddit-search actor). Use `WEBHOOK` instead when the user already pays for a social listening tool (Brand24, Mention, Hootsuite, Triggify) that can push mentions in. Don't use `LINKEDIN_ENGAGEMENT` here — that follows specific profiles, not keywords.
- Configuration:
  - For `SCHEDULE` + Apify: cadence (every 1-6 hours for high-volume brands; daily for smaller), one actor per platform discovered via `apify-list-store-actors`, and the keyword list as the search query.
  - Keyword list: brand names + product names + exec personal names + 3-5 high-signal pain-language phrases
  - Platforms: LinkedIn, X / Twitter, Reddit, Hacker News, optional Slack communities
  - Sentiment filter (if vendor supports): focus on negative and neutral first; positive can be auto-amplified
  - Exclude: competitors and vendors (use blocklist)

## Sequence

- Step 1: Classify the mention into one of the seven classes (praise / Q / complaint / comparison / switch / pain / noise).
- Step 2: Identify the author via `swan-fetch-scraped-url` on their profile; `swan-enrich-contact` if ICP-fit.
- Step 3: ICP + CRM context check.
- Step 4: Pick the right responder account based on the mention class.
- Step 5: Draft a short, human reply OR DM. Public reply only for praise / pain mentions; DM for sales-adjacent.
- Step 6: For LOW-stakes: optional auto-reply with sender approval. For MEDIUM: `hubspot-create-task` for the AE. For HIGH-stakes: `slack-send-notification` to the responder.
- Step 7: `swan-update-company` to log the mention and outcome.

## Success criteria

For complaints: ≥ 90% acknowledged within 4 business hours.
For switch signals + comparison shopping mentions: ≥ 25% reply rate on DMs and ≥ 10% conversion to a meeting.
Brand-sentiment trend (qualitative, tracked via responder review of mentions) should hold neutral or improve.

## Final step — Rewrite the parent skill's Setup state paragraph

Call `swan-update-skill` on the parent `community-radar` skill and rewrite its `**Setup state.**` paragraph so it describes what was just configured. The rewritten paragraph should name the trigger type chosen (`SCHEDULE` + Apify or `WEBHOOK` from the named listening tool), list the brand terms / product names / exec names / pain-language phrases being monitored, list the platforms covered (LinkedIn, X, Reddit, Hacker News, Slack communities), confirm the sequence and responder routing are wired, state the success metric being tracked, and include today's date as last-refreshed. Drop the "Not yet configured" wording entirely.

Future invocations of this skill will read the rewritten paragraph and proceed without re-checking state.
