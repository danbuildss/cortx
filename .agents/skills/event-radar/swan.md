---
title: Readme
description: "Setup page for event radar. Configures monitored events and how attendance should translate into qualification and follow-up."
---

## Prerequisites

- An event platform feeding attendance data (Goldcast / Hopin / Splash / Bizzabo) or a manually-uploaded attendee CSV
- For exhibited conferences: a process for reps to log booth interactions in CRM during the event
- ICP segment defined
- CRM integration recommended for ownership routing and dedup
- Sender connected
- For competitor / industry event monitoring: a way to source the attendee list (event website scrape via `swan-fetch-scraped-url`, partner list-share, or user-uploaded list)

## Trigger

- Type: `WEBHOOK` (from event platform) for owned events; the CRM's workflow trigger if attendance is logged in CRM (discover via `swan-get-available-triggers`); `SCHEDULE` + Apify for post-event scraping of public attendee lists; `WEBSITE_VISIT` as proxy for post-event landing-page visits
- Configuration:
  - Owned events: webhook payload on every attendee + session attended
  - Exhibited conferences: CRM list of booth-scanned contacts triggers on list addition
  - Industry / competitor events: `SCHEDULE` that runs after the event, fed either an attendee list from a CSV upload or an Apify scrape of the event website
  - Filter to ICP-fit attendees only — large events attract massive non-ICP tails

## Sequence

- Step 1: Classify the event class (owned / exhibited / attended / competitor / partner).
- Step 2: Pull attendee detail; resolve identity to email + LinkedIn where possible.
- Step 3: Qualify to ICP (`swan-search-companies`, `swan-enrich-company` if needed). Batch in `swan-execute-code` if list > 30.
- Step 4: CRM check via `hubspot-search-objects` per attendee.
- Step 5: Match content to angle based on event class (session attended, booth conversation, shared experience).
- Step 6: Build sequences via `swan-build-sequence` for unowned, `hubspot-create-task` for owned. For bulk events, batch via `output/actions.json` in `swan-execute-code`.
- Step 7: `swan-update-company` to tag attendance signal.

## Success criteria

For owned-event attendees: meeting-booked rate ≥ 15% within 30 days of event end.
For exhibited-conference attendees with logged booth interaction: ≥ 25% reply rate on follow-up.
Tracked via `swan-search-sequences` filtered to this play's event-name tag.

## Final step — Rewrite the parent skill's Setup state paragraph

Call `swan-update-skill` on the parent `event-radar` skill and rewrite its `**Setup state.**` paragraph so it describes what was just configured. The rewritten paragraph should name the trigger source(s) wired (event-platform `WEBHOOK`, `SCHEDULE` + Apify, CRM workflow, or `WEBSITE_VISIT` proxy), list the monitored events by class (owned webinars, exhibited conferences, industry events, competitor events), note the ICP filter applied, confirm the sequence is wired, state the success metric being tracked, and include today's date as last-refreshed. Drop the "Not yet configured" wording entirely.

Future invocations of this skill will read the rewritten paragraph and proceed without re-checking state.
