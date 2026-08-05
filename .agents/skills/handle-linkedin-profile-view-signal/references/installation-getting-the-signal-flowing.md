---
title: Installation — Getting the Signal Flowing
description: (reference)
---

# Installation — Getting the Signal Flowing

Prerequisites and wiring, in order. Do this before touching the
customization checklist — without the webhook connected, the skill never
fires.

## 1. LeadShark account + plan

- Profile-view de-anonymization with webhook delivery requires the
  **LeadShark Apex plan** (listed as "Signals API + visitors webhook",
  ~$119/mo as of mid-2026 — verify current pricing at
  [leadshark.io](https://www.leadshark.io/)). Lower tiers include generic
  webhook integrations but not the profile-visitors signal.
- LeadShark must be connected to **the LinkedIn account of the profile owner
  being tracked** — the person named in `{{PROFILE_OWNER}}`. One LeadShark
  connection per tracked profile.
- The viewer's identity quality depends on LinkedIn's own visibility rules:
  viewers browsing in private mode arrive as `is_anonymous: true` and are
  discarded by the skill. Expect a meaningful share of views to be anonymous;
  this is a LinkedIn constraint, not a misconfiguration.

## 2. Webhook trigger in your workspace

Create a **Webhook trigger** (one per profile owner):

- **Name:** `<Owner> LinkedIn Profile View — LeadShark`
- **Trigger instructions** — keep them minimal; all logic lives in the skill:

  ```
  A LeadShark webhook fired.

  If `event` ≠ `new.profile.visit` → stop immediately. Ignore all other
  LeadShark event types.

  Otherwise, load and follow the <Handle LinkedIn Profile View Signal> skill.
  ```

- Copy the trigger's **webhook URL**. It contains a secret token — treat it
  like a credential (anyone with the URL can inject fake profile-view events
  and drive CRM writes/outreach drafts).

## 3. Point LeadShark at the webhook

In LeadShark's webhook/integration settings, register the trigger's webhook
URL for profile-visit events. LeadShark will deliver `new.profile.visit`
events (and possibly other event types — the trigger filter handles those).

## 4. Supporting tools the skill calls at runtime

Verify each is connected in your workspace before enabling:

- **Contact enrichment** (`{{ENRICHMENT_TOOL}}`) — primary person→company
  resolver.
- **LinkedIn profile scraper** (`{{FALLBACK_SCRAPER}}`, e.g. an Apify actor)
  — mandatory fallback; requires its own account/credits.
- **CRM connection** (`{{CRM}}`) with write access to companies, contacts,
  and notes.
- **Slack** (or your chat tool) with access to `{{NOTIFICATIONS_CHANNEL}}` —
  create the channel first.

## 5. Verify end-to-end

1. Have a colleague (non-anonymous, from a non-internal domain) view the
   tracked profile.
2. Confirm the trigger fired and the skill loaded.
3. Confirm the dedup memory note was created with one `visit.id | actor_id |
   timestamp` entry.
4. Confirm the outcome matches expectations (a colleague at your own company
   should stop silently at the internal check — so for a full-path test, use
   a friendly external contact and expect NOT ICP or SCORED).
5. Have the same person view again within the cooldown window — confirm
   silence (session dedup working).

## Known payload gotchas (from production use)

- LeadShark splits **one viewing session into multiple events** (same
  `actor_id`, new `visit.id` each). The skill's Step 1.5 handles this — do
  not remove it.
- `connection_status` casing is inconsistent (`"Connected"` vs
  `"connected"`). Lowercase before comparing.
- The payload carries a top-level `payload_version` field (currently `2`).
  If it changes, LeadShark may have altered the schema — re-check the field
  mapping in [webhook-payload.md](webhook-payload.md).
- `data.lead.linkedin_url` sometimes arrives in URN form; prefer
  `data.lead.linkedin_username` for enrichment lookups.
