---
title: Readme
description: "Setup page for visitor radar. Configures which content or web events should create warm intent follow-up."
---

## Prerequisites

- Marketing site instrumented (Swan's tracking snippet for `WEBSITE_VISIT`, OR HubSpot tracking for form fills and content engagement)
- A clear inventory of high-signal content (pricing page, demo page, gated assets, webinar registration page) — used to define what fires the trigger
- ICP segment defined; persona definitions populated
- CRM integration recommended for ownership routing and de-duplication against active sequences
- Sender connected

## Trigger

- Type: `WEBSITE_VISIT` (Swan-native page tracking), `WEBHOOK` (webinar platforms like Goldcast, Zoom; or the user's product analytics tool), OR the CRM's workflow trigger (for form fills, list membership — discover via `swan-get-available-triggers`)
- Configuration:
  - For `WEBSITE_VISIT`: filter to high-signal pages (pricing, demo, comparison, top-converting blog posts). Set a minimum time-on-page (e.g. 30s) to filter bounces.
  - For CRM workflow (form fills): fire on gated asset downloads, demo requests, webinar registrations.
  - For `WEBHOOK`: fire on attendance, not just registration (attendance is the higher signal).
  - Exclude: existing customers (route via expansion play), competitors, vendors, internal team domains.

## Sequence

- Step 1: Filter by signal strength tier (HIGH / MEDIUM / LOW).
- Step 2: Resolve identity — match anonymous visits to known contacts at known accounts when possible.
- Step 3: CRM check via `hubspot-search-objects` for active sequence / owner / customer status.
- Step 4: Match the engaged content to a specific outreach angle.
- Step 5: For owned accounts, `hubspot-create-task` for the owner. For unowned ICP-fit, `swan-build-sequence` single-touch.
- Step 6: `swan-update-company` to log engagement type and date.

## Success criteria

Reply rate on content-engagement-triggered outreach ≥ 2× cold baseline (visible via `swan-search-sequences`). For pricing/demo page triggers: meeting-booked rate ≥ 10% of fires.

## Final step — Rewrite the parent skill's Setup state paragraph

Call `swan-update-skill` on the parent `visitor-radar` skill and rewrite its `**Setup state.**` paragraph so it describes what was just configured. The rewritten paragraph should name the trigger type chosen (`WEBSITE_VISIT` / `WEBHOOK` / CRM workflow), list the monitored pages or forms or webinar events with the threshold values (e.g. "pricing page > 30s, demo request form, webinar attendance"), note the exclusion filters applied (customers, competitors, internal), confirm the sequence is wired, state the success metric being tracked, and include today's date as last-refreshed. Drop the "Not yet configured" wording entirely.

Future invocations of this skill will read the rewritten paragraph and proceed without re-checking state.
