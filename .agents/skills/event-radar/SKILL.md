---
name: "event-radar"
title: Event radar
description: "Turns event attendance into pipeline. Use when prospects attend a webinar, conference, dinner, booth, or monitored industry event and need qualification plus contextual follow-up."
category: Signals
---

## Instructions

**Setup state.** Not yet configured for this org. Load the `Setup` sub-page and walk the user through wiring the event-radar trigger (event-platform `WEBHOOK`, `SCHEDULE` + Apify scrape for public attendee lists, or the CRM's attendance workflow) with the right monitored event sources and follow-up sequence before running this play. (After setup is performed, rewrite this paragraph via `swan-update-skill` to describe the current state — trigger source(s) chosen, monitored events by class (owned / exhibited / industry / competitor), ICP filter, sequence wired, success metric, and last-refreshed date — so future runs see the current configuration without re-checking.)

### When this fires

Most commonly `WEBHOOK` from an event platform (Goldcast, Hopin, Splash, Bizzabo, or a manually-uploaded attendee list), `SCHEDULE` + Apify (for public attendee lists of competitor / industry events that the user wants to scrape post-event), the CRM's workflow trigger (if attendance is stored in CRM — discover via `swan-get-available-triggers`), or `WEBSITE_VISIT` as a proxy for post-event landing-page visits.

The 48-72 hour window after an event is the highest-converting time to reach out.

### Step 1 — Classify the event type

The play differs sharply by event class:

| Event class | Attendee signal | Play |
|-------------|-----------------|------|
| Your owned event (webinar, conference, dinner) | High — they chose you | Follow-up on the topic they came for |
| Industry conference where you exhibited | Medium-high — you met them | Reference the booth interaction |
| Conference attended only — no booth interaction | Medium — same industry, same time | Casual outreach citing the event |
| Competitor's event | Low-medium — in the market | Soft displacement angle, no aggression |
| Partner / adjacent vendor's event | Medium — same buyer pool | Joint-buyer angle |

### Step 2 — Pull attendee detail

The trigger payload should include name + email + company + (ideally) session attended or interactions logged. If only company-level data, treat it as a softer signal.

For events with rich data (which sessions they watched, which questions they asked, booth visits logged) — that's the personalization gold.

### Step 3 — Qualify to ICP

`swan-search-companies` for the attendee's company. Filter out non-ICP. Conferences attract everyone; not everyone's worth chasing.

If list is > 30, switch to code:

> Use `swan-execute-code`. Dump the attendee list to JSON. Batch `swan-enrich-company` calls via `output/actions.json` for any company not in Swan. In the next call, filter by ICP firmographics and print the top 20 by fit score.

### Step 4 — CRM context per attendee

`hubspot-search-objects` (contacts, filter by email). Outcomes:

- Already in active sequence → flag for the rep, don't re-fire
- Customer → route to CSM as advocacy / expansion signal
- Open deal → route to deal owner; attendance is acceleration signal
- Net new → cold play with event as anchor

### Step 5 — Match content to angle

For owned events, the topic of the session they attended IS the angle. Don't pivot.

For exhibited conferences, the booth interaction (what they asked, what they took, who they spoke to) IS the angle. Reps should be capturing this during the event — pull it from CRM notes or rep log.

For attended-only conferences (no booth), the angle is the shared experience: "We were both at [event] last week. The most surprising takeaway for us was [X]. Curious what stuck with you."

### Step 6 — Draft the post-event message

Templates:

**Webinar attendance:**
> "Hi [name] — thanks for joining [session title]. The question we got most after was [specific Q]. Curious how you're thinking about it at [company]. Would love to compare notes."

**Booth visit (your conference exhibit):**
> "Hi [name] — good chatting at [event] about [specific topic from the convo]. As promised, here's [thing you said you'd send]. Would 20m next week be useful to dig in?"

**Competitor's event:**
> "Hi [name] — saw [event] was last week. We weren't there, but the question we hear most from [persona] when [event topic] comes up is [your wedge]. Worth a quick chat?"

**Attended-only, no interaction:**
> "[name] — fellow [event] attendee. [One-line insight from the event you'd share]. Curious if [related question for them]?"

### Step 7 — Build the sequence

For unowned ICP-fit: hand off to `reach-out` or `swan-build-sequence`. 2-3 touches max; the event freshness fades quickly.

For owned: `hubspot-create-task` for the rep with the attendee record, session detail, and suggested message.

### Step 8 — Bulk vs individual

For large events (100+ ICP-fit attendees), don't reach out individually one at a time. Bulk-personalize via code:

> Use `swan-execute-code`. Read the attendee list. For each, write a `swan-build-sequence` action with the personalization hook (session attended, company context). Submit via `output/actions.json` in batches of ≤ 50.

### Step 9 — Log

`swan-update-company` to tag the company with event attended + date. If a deal converts, tag the event as the source — over time, the org learns which events convert.

### Rules

- MUST act within 72 hours of event end. After that the freshness is gone.
- MUST reference the event specifically. "Thanks for coming" is the laziest possible follow-up.
- MUST qualify to ICP before mass-reach-out. Events attract a huge non-ICP tail.
- NEVER fire competitor-event follow-ups with aggressive displacement. Soft angle only.
- NEVER pretend you spoke to someone at the booth if you didn't. Rep notes matter.
- If attendance data is anonymous (no email), don't fire individual outreach. Tag the account and watch for return signals.
- If a tool result is truncated, read the JSON from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code`.

### Tighten over time

After 3-5 events, read recent reply-rate data via `swan-search-sequences` filtered to this play's executions (tag by event name). Identify which event classes (owned vs exhibited vs attended-only vs competitor) yielded best. Recommend the user drop event classes that didn't yield, raise the ICP-fit floor on attendee lists, or invest more in sessions that drove highest-converting follow-ups before the next event.
