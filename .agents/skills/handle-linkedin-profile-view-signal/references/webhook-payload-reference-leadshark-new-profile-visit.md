---
title: "Webhook Payload Reference (LeadShark `new.profile.visit`)"
description: (reference)
---

# Webhook Payload Reference (LeadShark `new.profile.visit`)

The payload arrives as text. Fields to extract:

| Field | Meaning | Notes |
|---|---|---|
| `event` | Event type | Must be `new.profile.visit` — the trigger should already filter this, but re-check |
| `data.lead.name` | Viewer full name | |
| `data.lead.first_name` | First name | `null` if anonymous |
| `data.lead.title` | LinkedIn **headline** | Often contains NO company — never parse a company out of it |
| `data.lead.linkedin_url` | Profile URL | May arrive in URN form |
| `data.lead.linkedin_username` | Profile slug | Usable directly (e.g. `jane-doe-08618b266`) — prefer this for enrichment |
| `data.lead.connection_status` | Relationship to profile owner | `"Connected"` \| `"2nd Connection"` \| `"3rd Connection"` \| `"Not Connected"` |
| `data.lead.is_anonymous` | Private-mode viewer | `true` = LinkedIn Premium private mode → discard fully and silently |
| `data.lead.actor_id` | Stable ID for the *person* | Same across visits — used for the session cooldown |
| `data.visit.id` | Stable unique token per *visit* | Used for the exact-retry dedup guard |
| `data.visit_timestamp` | ISO 8601 timestamp | |
| `data.profile_owner` | Whose profile was viewed | Must match this skill's configured profile owner; otherwise stop silently |

## Known emitter behaviors (why Step 1.5 exists)

- One viewing session commonly produces **multiple events**: same `actor_id`,
  different `visit.id` each time. The per-person cooldown collapses these.
- Webhook **redelivery** repeats the same `visit.id`. The exact-retry guard
  catches these.
- A genuine repeat visit (hours/days later) has the same `actor_id` and a new
  `visit.id`, outside the cooldown — it should process and count as stronger
  intent.

If you use a different profile-view tracker, map its fields to the semantics
above; the skill only depends on: person identity, per-visit ID, anonymity
flag, connection status, timestamp, and profile-owner confirmation.
