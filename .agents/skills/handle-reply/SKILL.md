---
name: "handle-reply"
title: Handle reply
description: "Processes inbound replies to outbound sequences. Classifies intent, drafts the right response or stop action, and updates CRM and Swan state without auto-sending."
category: Outreach
---

## Instructions

**State check.** This skill assumes a CRM is connected, at least one sender is configured with instructions, and the org has approved message examples to anchor voice. Check the CRM connection, load sender instructions, and pull message examples before drafting. If no sender instructions exist, ask the user to define voice once so every reply lands consistent — don't fall back to a generic tone. If no CRM is connected, the skill still runs for the draft itself, but skip the CRM write steps and tell the user.

### Step 1 — Load the thread and the sequence context

Pull the sequence and the latest reply:

- `swan-search-sequences` filtered to the contact or company to find the active sequence.
- `swan-get-sequence` for the full thread and the original outbound message.
- `hubspot-search-objects` on Contacts + Companies to confirm CRM state (lifecycle stage, owner, deal associations).

If the response is large, read the full JSON from `files/tool-outputs/swan-get-sequence_<callId>.json` in `swan-execute-code` and print only the last 2-3 thread turns plus the sequence goal.

### Step 2 — Classify intent

Read the reply once and pick exactly one bucket. Keep the classification one line.

| Intent | Signals | Next action |
|--------|---------|-------------|
| **Interested** | Asks a question, requests a meeting, asks for pricing, "tell me more" | Draft a fast positive reply, propose times, offer a deck |
| **Objection** | Concern about price, fit, timing, "not now," "we use X" | Draft a reframe — address the objection, offer one specific next step |
| **Wrong person** | "Not me," "talk to X," referral to a colleague | Route to the new contact, ask for the warm intro, thank them |
| **Unsubscribe** | "Stop emailing," "remove me," "unsubscribe" | Stop the sequence, mark do-not-contact, no reply |
| **Out of office** | Auto-reply, return date, alt contact | Pause the sequence to the return date; if alt contact given, route |
| **Neutral / soft no** | "Reaching out later," "send info," vague | Drop a short value follow-up, push to next sequence step |

If the reply is ambiguous, ask the user which bucket fits — don't guess.

### Step 3 — Draft the response

Match the sender's voice using `swan-get-sender-instructions` and `swan-get-message-examples`. Draft inline in the conversation (not in the sequence editor yet). Keep it short — most reply responses are 2-4 sentences.

For **interested**: propose two specific time windows or a calendar link, name a concrete next step.

For **objection**: acknowledge the concern in one sentence, reframe with one specific data point or case, propose one small next step (15-min call, async loom, one-page brief).

For **wrong person / referral**: thank them, ask for the right contact's name + email, offer to take the conversation off their plate.

For **unsubscribe**: no reply. Stop the sequence and write a note instead.

For **out of office**: no reply. Adjust sequence schedule.

For **neutral**: one-line value-add tied to a specific signal on the account (recent funding, hire, post). Don't pile on.

### Step 4 — Update Swan and CRM state

After the user approves the draft:

- If unsubscribe: stop sequence + `hubspot-update-contact` to set the do-not-contact flag the org uses + `hubspot-create-note` capturing the reason.
- If wrong person and they named the right contact: `hubspot-search-objects` to find the new contact, `hubspot-create-association` to link them to the company, `hubspot-create-note` on the original contact recording the referral.
- If interested or objection: `hubspot-create-note` summarizing the reply in 1-2 lines, `hubspot-update-contact` lifecycle stage if it moves (e.g. lead → opportunity), `hubspot-create-task` for the user to follow up if no auto-send.
- For all buckets: `swan-update-company` if the reply reveals new facts about the account (use case, current vendor, timing).

For a batch of replies (more than ~5 at once), switch to `swan-execute-code` with `output/actions.json` to write all CRM updates in one shot.

### Rules

- NEVER auto-send the drafted reply. Always show the draft and wait for the user.
- NEVER unsubscribe without an explicit unsubscribe intent — "not interested" is an objection, not a stop.
- NEVER ignore a wrong-person reply. The referral is the highest-leverage outcome.
- MUST log a note on every classified reply so the next touch has context.
- If the inbox shows > 20 unread replies, switch to `swan-execute-code`: dump the list to a file, classify in pandas (intent column), print per-bucket counts, then process one bucket at a time.
