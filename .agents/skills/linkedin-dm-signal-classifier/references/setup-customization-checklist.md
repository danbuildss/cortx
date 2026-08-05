---
title: "Setup & Customization Checklist"
description: (reference)
---

# Setup & Customization Checklist

## 1. Trigger setup

This skill runs from a **scheduled trigger** (not a webhook), one per team
member whose DMs are scanned. Reference trigger instructions:

```
You are running as [Trigger Owner]. Scan [Owner]'s LinkedIn DMs for
business-relevant signals.

Load and follow the <LinkedIn DM Signal Classifier> skill in full.

Context for this run:
- Trigger owner: [Name] ([email])
- LinkedIn account: [Owner]'s connected LinkedIn
- Run this daily
- Chat limit for this run: 50
```

- [ ] Trigger owner's LinkedIn account is connected to the workspace.
- [ ] Schedule: daily is the tested cadence. More frequent runs mostly hit
      the cursor and do nothing; less frequent risks stale ⏰ awaiting-reply
      flags.
- [ ] One trigger + one skill instance **per person** — cursors and dedup
      lists live in the trigger owner's user memory and must not be shared.

## 2. Placeholders

- [ ] `{{TRIGGER_OWNER}}`, `{{CRM}}`, `{{SIGNALS_CHANNEL}}`,
      `{{EXPANSION_CHANNEL}}`, `{{MQL_CHANNEL}}`, `{{PARTNERSHIPS_OWNER}}`,
      `{{FUNDRAISING_OWNER}}`, `{{LEAD_SCORING_SKILL}}`,
      `{{OUTREACH_SKILL}}`, `{{HIGH_ACV_THRESHOLD}}`,
      `{{SELF_SERVE_THRESHOLD}}` — all filled.
- [ ] Map the bucket definitions in Step 5 to **your** funnel stage names
      (closed-won, open-deal stages, closed-lost/nurture/self-serve). The
      buckets reference stage *semantics*, not stage names.
- [ ] Optional: seed the trigger owner's personal-connections skip list
      (Step 3) so friends and peers never generate signal posts.

## 3. Policy decisions

- [ ] **Start in EVAL mode.** Run with CRM writes disabled for 1–2 weeks and
      review the "would-have-written" blocks in Slack, then follow the steps
      as written to go live. This is how the skill was derisked in
      production.
- [ ] **Never auto-send** — the strongest invariant. The skill may draft a
      suggested reply for the thread owner and may build approval-queued
      sequences for *other* buying-committee members (Step 6.5), but a human
      sends everything. If you want pure detection with no drafts at all,
      delete Step 6.5 and the closing-line rule.
- [ ] The **self-serve gate** on PROSPECT_HIGH_ACV — set
      {{SELF_SERVE_THRESHOLD}} to match where your sales-touch economics
      actually start; the gate exists because inbound DMs from tiny teams
      were over-promoting accounts into sales-tier alerts.
- [ ] The tier **promotion rule** (inbound DM promotes one tier up, never
      down) — confirm it matches your scoring model.
- [ ] **MQL channel discipline**: scored signals post to {{MQL_CHANNEL}} in
      your standard lead-scoring alert format, never a custom DM layout —
      confirm the format reference in Step 6.5 points at your scoring
      skill's alert spec.
- [ ] The **mandatory end-of-run digest** even on zero signals — this is
      your health check that the scan ran. Don't remove it.

## 4. Behavioral invariants (do not remove)

- Cursor written **only at the end** of a successful run — duplicate
  processing on retry is acceptable, silently skipped signals are not.
- LinkedIn tool calls strictly sequential.
- 7-day per-contact dedup before posting; updates use the short `🔄 DM
  Update` format.
- ⏰ awaiting-reply flag only when the *other* person spoke last.
- Verbatim last inbound message quoted in every signal post — paraphrase is
  never a substitute.
- The contact already in the thread is never enrolled in a sequence — reply
  drafts only.
- Memory-full → skip the write, flag it, never trim existing memory.
