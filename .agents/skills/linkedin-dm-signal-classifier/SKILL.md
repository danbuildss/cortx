---
name: "linkedin-dm-signal-classifier"
title: LinkedIn DM signal classifier
description: "Use this skill to scan a team member's LinkedIn DMs daily and turn conversations into routed signals. It classifies each chat into a bucket (customer support, commercial, pipeline, re-engagement, prospect, partner, VC, community, and more), updates account memory and the CRM, scores qualified signals and routes them to your MQL channel, and closes every scored signal with a suggested next move — a drafted reply for the thread owner or an approval-queued sequence for the rest of the buying committee. It never auto-sends outreach."
category: Signals
---

## Template placeholders

Replace every `{{...}}` before enabling. See the setup checklist reference for the full setup list.

- `{{TRIGGER_OWNER}}` — Team member whose LinkedIn DMs are scanned (one skill instance per person)
- `{{CRM}}` — Your CRM (e.g. HubSpot, Attio)
- `{{SIGNALS_CHANNEL}}` — Slack channel for all DM signal posts + daily digest
- `{{EXPANSION_CHANNEL}}` — Slack channel for expansion/churn-risk cross-posts (optional)
- `{{MQL_CHANNEL}}` — Slack channel where your lead-scoring alerts post qualified accounts
- `{{PARTNERSHIPS_OWNER}}` — Person to flag partner/agency signals to
- `{{FUNDRAISING_OWNER}}` — Person to flag investor inquiries to (usually a founder)
- `{{LEAD_SCORING_SKILL}}` — Sub-skill reference: your lead scoring & qualification methodology
- `{{OUTREACH_SKILL}}` — Sub-skill reference: your outreach/sequence-building methodology
- `{{HIGH_ACV_THRESHOLD}}` — Company profile that suggests medium-to-high ACV (default: >30 employees, funded, or VP+/C-suite/Founder contact)
- `{{SELF_SERVE_THRESHOLD}}` — Company profile that should route to your self-serve / low-touch motion instead of being scored (default: <50 employees AND ≤$10M total funding)


### ⚠️ Optional EVAL mode (recommended for the first 1–2 weeks)

While you evaluate output quality, you can run with {{CRM}} writes disabled:
skip every "create or update in {{CRM}}" step below and instead **include the
exact note text that WOULD have been written** in the Slack post. Workspace
account-memory writes stay ON either way. Once you trust the output, follow
the steps as written — that is the live configuration.

---

### Overview

Daily workflow for processing LinkedIn DM conversations. Runs once per person
per day via a personal scheduled trigger. The trigger owner's LinkedIn
account is used automatically.

---

### Step 1 — Determine the Cursor

Check the **trigger owner's user memory** for a key like
`LI DM last run: [ISO timestamp]`.

- If found: this is a subsequent run. You will skip chats with no activity
  since that timestamp.
- If not found: this is the first run. Process chats up to the limit
  specified in the trigger instructions.

**Do NOT write the cursor yet.** The cursor is written at the END of the run
after all chats have been processed successfully (Step 8). A mid-run failure
must not advance the cursor — duplicate processing on retry is acceptable,
silently skipped signals are not.

---

### Step 2 — Fetch Chats (paginated)

Fetch the trigger owner's chat list with your LinkedIn tools, up to 250
chats per page.

**Important:** LinkedIn calls must be made ONE AT A TIME. Never
parallelize them.

Pagination logic:
- If the response indicates more pages AND the oldest chat returned has a
  last-message timestamp **newer than the stored cursor** (or this is the
  first run): fetch the next page using the returned pagination cursor.
- Continue paginating until either: no more pages remain, OR the oldest chat in
  the page has a last-message timestamp **older than or equal to the stored
  cursor**.
- On first run: respect the chat limit specified in the trigger instructions
  (default 50 if unspecified) — stop paginating once you've accumulated that
  many chats.

This guarantees no active chats are silently missed on a busy day.

After fetching all pages, filter the full list: keep only chats whose last
message timestamp is **newer than the stored cursor** (on subsequent runs).
On the first run, keep all fetched chats up to the trigger limit.

---

### Step 3 — Read Messages

For each remaining chat:
- Read the most recent messages in the chat (about 20 is enough context)

For each chat, note:
- Whether the **last message** is inbound (sent by the other person) — this
  feeds the awaiting-reply flag in Step 5
- The timestamp of the last inbound message, to compute days since last reply

Skip a chat if:
- All messages are outbound only (sent by the trigger owner, never replied to)
- The most recent inbound message is purely noise with no identifiable
  company context
- The contact is a known personal connection of the trigger owner — skip
  entirely, no Slack post, no writes. (Maintain a short personal-connections
  skip list in this skill or the trigger owner's user memory.)

---

### Step 4 — Identify the Company

For each conversation with a meaningful inbound message:
1. Look at the other party's profile name and headline in the chat metadata
2. Identify their company from their LinkedIn headline (e.g., "VP Sales @
   Acme Corp")
3. Search your workspace for the company
4. If not found, enrich via research tools to confirm domain and firmographics

---

### Step 5 — Classify the Signal

Classify each conversation into exactly one bucket. Use the priority order
below — first matching bucket wins.

---

**VENDOR_SPAM**
Vendors pitching products, recruiters, generic congratulations with no
substantive follow-up, connection acceptances with no message, spam.
→ Skip entirely. No Slack post, no writes.

---

**CUSTOMER_SUPPORT**
The contact's company is a **current customer (closed-won)** AND the message
indicates: a product issue, bug, outage, credit or billing problem, a
complaint, or any frustrated / at-risk tone. (Canonical example: an angry
DM about billing or credits from a paying customer.)
→ Treat as urgent. See Step 6.

---

**CUSTOMER_COMMERCIAL**
The contact's company is a **current customer** AND the message is about:
expansion interest, renewal, plan upgrade/downgrade, pricing questions, or
churn risk without a support/complaint dimension.
→ See Step 6.

---

**ACTIVE_PIPELINE**
The contact's company has an **open deal** in your pipeline (any active
sales stage between qualification and procurement).
→ See Step 6.

---

**RE_ENGAGEMENT**
The contact's company is at a **closed-lost, nurture, or self-serve** stage —
AND they are initiating contact after a prior sales interaction (demo
completed, trial agreed, or previous outreach replied to). Self-serve
accounts only qualify if there is evidence of prior sales contact in account
memory or CRM history; a pure self-serve trial with no sales touch does not
qualify.
→ See Step 6.

---

**PROSPECT_HIGH_ACV**
A prospect (known or new) where the company profile meets
{{HIGH_ACV_THRESHOLD}}. Includes known prospects in early funnel stages as
well as previously unknown companies that clear the threshold.
→ See Step 6.

---

**PROSPECT_LOW_ACV**
A prospect with low ACV potential: solo operators, fractional executives,
independent consultants, tiny companies with no funding.

Also use this bucket when the contact has **no identifiable company** (no
company name or domain in their headline or profile). Post with whatever
profile info exists. Add the note: `No company — enrichment skipped`. Do NOT
create a workspace company record or run scoring for these contacts.
→ See Step 6.

---

**IMPLEMENTATION_PARTNER**
Agency, consultancy, done-for-you services firm in your space — whether
already tracked as a partner or new. Note in the post whether this is
**ACTIVE** (already tagged as a partner) or **POTENTIAL** (not yet tracked).
→ See Step 6.

---

**COMMUNITY_SPEAKING**
Community demo requests, podcast invitations, event speaking invitations,
newsletter or content distribution opportunities, co-marketing proposals
with no service/revenue pitch.
→ See Step 6.

---

**VC_INQUIRY**
An investor (VC, angel, family office) reaching out — about your company as
an investment, a portfolio-company intro, or general relationship building.
→ See Step 6.

---

**COLLABORATION**
Peer builders, friendly-competitor exchanges, or mutual-interest
conversations with no clear revenue or partnership path.
→ See Step 6.

---

**UNKNOWN**
Business-relevant message that does not fit any bucket above. Do not force a
classification — post it and let the human decide.
→ See Step 6.

---

**Awaiting-reply flag (applies to all buckets except VENDOR_SPAM):**
After classifying, check: is the **last message in the chat inbound** (the
other person messaged last, and the trigger owner has not replied)?
- If yes: compute `N = days since that message`. Add this line to the Slack
  post: `⏰ Awaiting reply (N days)`
- If no (the trigger owner sent the last message): **do NOT include this
  line.** The ⏰ flag is exclusively for threads where the other person spoke
  last. Outbound-last threads must never carry this line.

---

### Step 5b — Deduplication Check

Before posting any signal in Step 6, check whether a signal for this **same
contact** has already been posted within the last 7 days. Re-posting an
unchanged thread creates noise and masks real new signals.

**If the contact's company exists in the workspace (account memory
available):**
- Scan the account memory for a DM signal entry matching this contact's
  name, dated within the last 7 days.
- If one exists:
  - Post again **only** if there is a new inbound message since the last
    entry that adds materially new information: a new ask, a changed
    timeline, a new objection, or a clear intent shift.
  - **Do not re-post because the trigger owner replied or there was only
    outbound activity since the last entry.**
  - When posting an update: use a short update format, not a full new signal
    post. Open with: `🔄 DM Update — [contact name] @ [company] (follow-up to
    [earlier signal date])` and include only what is genuinely new.
  - If nothing new: skip the Slack post entirely. Still update account
    memory if there is meaningful new content to log.

**If the contact has no company record (no account memory to check):**
- Read the **trigger owner's user memory** for a `Recently Posted DM Signals`
  section (format: `- [contact name] — [ISO date]`).
- Apply the same 7-day rule.
- After any new or update post for such a contact, add or update their entry
  in the trigger owner's user memory. If the section doesn't exist yet,
  create it before writing the first entry.

---

### Step 6 — Route by Classification

> **Global rule — Verbatim message required in all Slack posts:**
> Every Slack signal post (all buckets except VENDOR_SPAM) must include the
> **verbatim text of the last inbound message** from the contact, quoted in
> a blockquote. Do not paraphrase or summarize as a substitute. If the
> thread has multiple inbound messages since the last outbound, include the
> most recent one verbatim; you may briefly note context from earlier
> messages separately.

#### VENDOR_SPAM
Skip. No writes, no actions.

---

#### CUSTOMER_SUPPORT

1. Update **account memory**:
   ```
   [CUSTOMER SUPPORT DM] [trigger owner name] ↔ [contact name, title] — [date]
   Issue type: [bug / billing / credits / complaint / at-risk]
   Summary: [1 sentence]
   ```
2. Create or update the contact in {{CRM}} and log a note:
   - Find or create the contact record (name, title, LinkedIn URL, email if
     available), associated with the company
   - Log a note on the contact: `DM via LinkedIn — [date]. [contact name]
     ([title]). Support signal. Issue: [type]. Summary: [1 sentence].`
3. Post to {{SIGNALS_CHANNEL}}:
   - `🚨 Customer Support DM`
   - Company name + domain
   - Contact: name, title
   - Issue type: 🐛 bug / 💳 billing/credits / 😤 complaint / ⚠️ at-risk
   - What they said (verbatim blockquote)
   - ⏰ Awaiting reply line (if applicable)
   - Conversation owner: [trigger owner name]
   - `Note: Urgent — route to your support process`

---

#### CUSTOMER_COMMERCIAL

1. Update **account memory**:
   ```
   [CUSTOMER COMMERCIAL DM] [trigger owner name] ↔ [contact name, title] — [date]
   Signal: [expansion / renewal / pricing / churn risk]
   Summary: [1 sentence]
   ```
2. Create or update the contact in {{CRM}} and log a note (same format as
   above, with the commercial sub-type).
3. Post to {{SIGNALS_CHANNEL}}:
   - `📩 Customer Commercial DM`
   - Company name + domain; contact name, title
   - Signal type: 📈 expansion / 🔄 renewal / 💬 pricing question / ⚠️ churn risk
   - 1-sentence summary; what they said (verbatim blockquote); ⏰ line if
     applicable; conversation owner
4. **If signal is expansion or churn risk:** also cross-post to
   {{EXPANSION_CHANNEL}}.

---

#### ACTIVE_PIPELINE

1. Update **account memory**:
   ```
   [PIPELINE DM] [trigger owner name] ↔ [contact name, title] — [date]
   Deal stage: [current stage]
   Signal: [objection / timeline / pricing / champion re-engagement / positive]
   Summary: [1-2 sentences]
   ```
2. Load and follow {{LEAD_SCORING_SKILL}}. A mid-deal DM is strong
   first-party intent — do not apply any tier cap that normally limits
   passive signals.
3. Create or update the contact in {{CRM}} and log a note:
   - Find or create the contact record (name, title, LinkedIn URL, email if
     available), associated with the company
   - Log a note on the contact: `DM via LinkedIn — [date]. [contact name]
     ([title]). Deal stage: [stage]. Signal: [type]. Summary: [1-2 sentences].`
4. Post to {{SIGNALS_CHANNEL}}:
   - `📩 Pipeline DM Signal`
   - Company + current deal stage; contact name, title; signal summary;
     what they said (verbatim blockquote); tier scored; ⏰ line if
     applicable; conversation owner
5. Continue to Step 6.5.

---

#### RE_ENGAGEMENT

1. Update **account memory**:
   ```
   [RE-ENGAGEMENT DM] [trigger owner name] ↔ [contact name, title] — [date]
   Prior stage: [closed-lost / nurture / self-serve]
   Summary: [1 sentence]
   ```
2. Treat as first-party intent. Load and follow {{LEAD_SCORING_SKILL}}.
3. Post to {{SIGNALS_CHANNEL}}:
   - `🔁 Re-engagement DM`
   - Company + prior stage; contact name, title; what they said (verbatim
     blockquote); tier scored; ⏰ line if applicable; conversation owner
4. Continue to Step 6.5.

---

#### PROSPECT_HIGH_ACV

1. If the company is not yet in the workspace: enrich via research tools and
   add it.

2. **⛔ SELF-SERVE GATE — Run this before anything else. No exceptions.**

   Check employee count (take the lower of enrichment vs LinkedIn) and total
   funding raised.

   **If the company profile meets {{SELF_SERVE_THRESHOLD}}:**
   - Move the account to your self-serve / low-touch stage and tag it
     accordingly (sync the stage to {{CRM}} if you mirror stages there)
   - Post to {{SIGNALS_CHANNEL}} using the PROSPECT_HIGH_ACV format but
     note: `⛔ Self-serve gate triggered — under threshold. No scoring.
     Moved to self-serve.`
   - **⛔ STOP. Do not proceed to memory update, scoring, or MQL routing.**

   If employee count is unavailable: treat as unknown and apply the gate by
   default. A strong funding signal alone (well above threshold) may
   override the gate.

3. Update **account memory**:
   ```
   [PROSPECT DM] [trigger owner name] ↔ [contact name, title] — [date]
   ACV tier: HIGH
   Summary: [1 sentence]
   ```
4. Load and follow {{LEAD_SCORING_SKILL}}. DM = first-party intent.
   **Promotion rule:** A substantive inbound DM (the contact initiated a
   real business conversation) is strong first-party intent. If the
   account's current tier is one below your alert tier, instruct the scoring
   skill that this direct DM interaction justifies promotion one tier up —
   unless there is contrary evidence in the account memory (explicit
   disqualification, stated "not now", churned for cause). **Never lower an
   existing tier as a result of this DM run.**
5. Create or update the contact in {{CRM}}:
   - Find or create the contact record with name, title, LinkedIn URL, and
     email if available
   - Associate with the company record
6. Post to {{SIGNALS_CHANNEL}}:
   - `📩 High-ACV Prospect DM`
   - Company + enriched summary (employees, funding, description)
   - Contact: name, title, what they said (verbatim blockquote)
   - Tier scored; ⏰ line if applicable
   - Close with a note that accurately reflects what actually happened:
     - Both ran: `Note: Enriched + scored.`
     - Enrichment ran, scoring skipped: `Note: Enriched. Scoring skipped.`
     - Enrichment skipped: `Note: Enrichment skipped. [Reason].`
7. Continue to Step 6.5.

---

#### PROSPECT_LOW_ACV

1. Do NOT create a workspace company record. Do NOT run scoring.
2. Post to {{SIGNALS_CHANNEL}}:
   - `📩 Low-ACV Prospect DM`
   - Contact: name, title, company (if any); what they said (verbatim
     blockquote); ⏰ line if applicable; conversation owner
   - `No company — enrichment skipped` (only if no company was identified)
   - `Note: Low ACV signal — no workspace record created.`

---

#### IMPLEMENTATION_PARTNER

1. Update **account memory** (if company record exists):
   ```
   [PARTNER DM] [trigger owner name] ↔ [contact name, title] — [date]
   Status: ACTIVE / POTENTIAL
   Summary: [1 sentence on what was discussed]
   ```
2. Post to {{SIGNALS_CHANNEL}}:
   - `🤝 Implementation Partner DM`
   - Company name, domain, what they do; contact name, title
   - Status: **ACTIVE** or **POTENTIAL**
   - Summary of what was discussed; what they said (verbatim blockquote);
     ⏰ line if applicable; conversation owner
   - `Note: Flagging for {{PARTNERSHIPS_OWNER}}'s awareness`

---

#### COMMUNITY_SPEAKING

1. Post to {{SIGNALS_CHANNEL}}:
   - `🎤 Community / Speaking Opportunity`
   - Contact: name, title, company (if any)
   - Opportunity type: podcast / event / community demo / distribution /
     co-marketing
   - What they proposed (verbatim blockquote); ⏰ line if applicable;
     conversation owner
   - `Note: Surface for review — no action taken.`

---

#### VC_INQUIRY

1. Post to {{SIGNALS_CHANNEL}}:
   - `💼 VC Inquiry`
   - Contact: name, title, fund name; what they said (verbatim blockquote);
     ⏰ line if applicable; conversation owner
   - `Note: Surface for {{FUNDRAISING_OWNER}}'s awareness.`

---

#### COLLABORATION

1. Post to {{SIGNALS_CHANNEL}}:
   - `🤜 Collaboration / Peer Exchange`
   - Contact: name, title, company; brief summary (1 sentence); what they
     said (verbatim blockquote); ⏰ line if applicable; conversation owner

---

#### UNKNOWN

1. Post to {{SIGNALS_CHANNEL}}:
   - `❓ Unclassified DM`
   - Contact: name, title, company (if any); what they said (verbatim
     blockquote); ⏰ line if applicable; conversation owner
   - `Note: Could not classify — needs human review.`

---

### Step 6.5 — MQL Routing & Suggested Next Move

This step applies whenever {{LEAD_SCORING_SKILL}} was called in Step 6 —
i.e., for ACTIVE_PIPELINE, RE_ENGAGEMENT, and PROSPECT_HIGH_ACV signals.

#### MQL channel routing
Let the scoring skill's standard alert routing run in full — do not
suppress it.

**⚠️ CRITICAL — Use your standard lead-scoring alert format for
{{MQL_CHANNEL}} posts. Do NOT post a custom DM-signal format to that
channel.** DM context (verbatim last inbound message, conversation owner,
days awaiting reply) must be embedded **within** the standard format — with
the verbatim DM woven in as the primary signal (e.g., "Inbound DM from
[name] ([title]) — [verbatim quote]") — not posted as a separate custom
block. One channel, one format: readers of the MQL channel should never
need to learn a second layout.

#### Decide the next move
After scoring completes, read the full DM thread, account memory, and
current deal state, then decide the right next action. Apply these rules:

**The person already in the thread — suggest a reply, never enroll in a
sequence:**
The contact is in a live conversation with the trigger owner. Never enroll
them in an automated sequence. Instead, draft a suggested reply in the voice
of the conversation owner (the trigger owner). If the contact is addressing
or asking for someone else on your team, name that person as the right
sender in the draft. Include the draft directly in the Slack post so the
owner can send it manually.

**Other people at the account — outreach is allowed, with checks:**
Outreach to buying-committee members who are NOT already in the thread is
permitted. Before building any sequence:
1. Run a duplicate-outreach check: search all existing sequences for each
   target contact in any status. If a sequence already exists for them —
   finished, running, or awaiting approval — do not build a new one; flag
   for human review instead.
2. Follow {{OUTREACH_SKILL}} for sender selection and sequence construction.
3. All DM-originated outreach must be queued for approval — never
   auto-send, regardless of tier.

**Approval always required:**
A DM thread means a human relationship is in motion. The human decides what
goes out. No exceptions.

#### Slack post closing line
End every ACTIVE_PIPELINE, RE_ENGAGEMENT, and PROSPECT_HIGH_ACV signal's
Slack post with a `Suggested next move:` line — one concrete, actionable
recommendation. Examples:
- `Suggested next move: [owner] should reply today — draft above.`
- `Suggested next move: Enroll [VP Sales name] in a sequence — queued for approval.`
- `Suggested next move: No action — await their reply before following up.`
- `Suggested next move: [teammate] to take over — DM context in thread above.`

---

### Step 7 — End of Run Summary

After processing all chats, **always** post a summary to
{{SIGNALS_CHANNEL}}. This post is mandatory on every run — including runs
where zero signals were found. Silence must mean a failure, never "nothing
found."

**If at least one non-noise signal was found:**
```
📋 LinkedIn DM Scan — [trigger owner name] — [date]
Chats fetched: [total fetched] | Processed: [N after filter]
Signals found: [N] — support: X, commercial: X, pipeline: X, re-engagement: X,
high-ACV prospect: X, low-ACV prospect: X, partner: X, community/speaking: X,
VC: X, collab: X, unknown: X
Vendor spam / noise skipped: [N] ([breakdown: recruiters, vendors, outbound-only, etc.])
⚠️ Memory-full warnings: [N accounts] (list company names if any)
```
Omit the memory-full line if count is 0.

**If zero non-noise signals were found:**
```
📋 LinkedIn DM Scan — [trigger owner name] — [date]. Chats checked: [N]. No new signals.
```

---

### Step 8 — Write the Cursor

Only after all chats have been processed successfully, write the cursor to
the trigger owner's user memory:
`LI DM last run: [ISO timestamp of when this run started]`

Use the timestamp from when the run started (captured at Step 1), not the
end time — this ensures the next run re-checks any chats that became active
mid-run.

---

### Important Constraints

- LinkedIn calls are sequential — never parallel
- Never surface noise signals — filter aggressively
- Never auto-send outreach. The only outreach this workflow may produce is a
  drafted reply surfaced in Slack, or an approval-queued sequence built per
  Step 6.5 — a human sends everything.
- If a company is tagged as competitor or vendor: skip, log in memory only,
  no Slack post
- **Memory-full handling:** If an account memory write fails due to capacity,
  do NOT delete or trim existing entries to make room. Skip the memory write
  entirely. Add `⚠️ account memory full — signal not persisted` to that
  signal's Slack post, and count it in the end-of-run digest.

---

## What good looks like

A great run puts every business-relevant DM in exactly one bucket with the right routing: urgent customer-support signals surface same-day with the verbatim complaint quoted in a blockquote, qualified signals get scored and land in {{MQL_CHANNEL}} in the standard alert format, every scored signal's post closes with one concrete `Suggested next move:` line (often a ready-to-send drafted reply), the 7-day dedup keeps the channel quiet (updates use the short 🔄 format), the end-of-run digest posts even on zero-signal days — silence must mean failure, never "nothing found" — and the cursor only advances after a fully successful run.

Mediocre looks like: vendor spam surfacing as signals, unchanged threads re-posted, a missing digest, awaiting-reply flags on threads where the owner spoke last, custom DM formats polluting the MQL channel, the contact in the thread getting enrolled in an automated sequence, or anything auto-sent without human approval.
