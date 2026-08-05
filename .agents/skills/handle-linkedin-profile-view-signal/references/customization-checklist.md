---
title: Customization Checklist
description: (reference)
---

# Customization Checklist

**Prerequisite:** complete [installation.md](installation.md) first —
LeadShark plan, webhook trigger, and tool connections.

Complete every item before enabling the skill. The skill is deliberately
conservative — most misconfigurations fail silent (no CRM writes) rather than
noisy.

## 1. Placeholders in SKILL.md

- [ ] `{{PROFILE_OWNER}}` — the team member whose LinkedIn is tracked. One
      skill instance per tracked profile (don't share one skill across owners:
      dedup memory notes, outreach sender identity, and the channel post all
      assume a single owner).
- [ ] `{{INTERNAL_DOMAINS}}` — your company's domain(s), including any
      secondary/product domains.
- [ ] `{{NOTIFICATIONS_CHANNEL}}` — a dedicated Slack channel for outcome
      posts. Recommend one channel per profile owner while testing.
- [ ] `{{ENRICHMENT_TOOL}}` / `{{FALLBACK_SCRAPER}}` — both must be available
      to the agent. The two-step resolution (enrich, then scrape) is
      load-bearing: without the fallback, many viewers end UNRESOLVED.
- [ ] `{{CRM}}` — your CRM. Verify which contact/company properties actually
      exist; the skill never invents properties.
- [ ] `{{COOLDOWN_WINDOW}}` — default 1 hour. Shorten only if you see missed
      genuine repeat views; lengthen if duplicate sessions still slip through.
- [ ] `{{TIER_SCALE}}` / `{{SOLE_SIGNAL_CAP_TIER}}` — match your lead-scoring
      tiers. The cap exists because a profile view alone is weak intent.

## 2. Sub-skills that must exist first

This skill is a router; it assumes four sub-skills:

- [ ] `{{CRM_HYGIENE_SKILL}}` — canonical "how to create/update companies and
      contacts in our CRM" skill (dedup rules, required fields, associations).
- [ ] `{{EXISTING_RELATIONSHIP_SKILL}}` — what to do when the account has an
      open or closed-lost deal (usually: notify the deal owner, log, no new
      outreach).
- [ ] `{{HIGH_INTENT_SKILL}}` — potential-MQL flow: lead scoring, tier
      assignment, buying-committee enrichment, outreach drafting, alerting.
- [ ] `{{AWARENESS_SKILL}}` — net-new ICP awareness flow: log the account,
      light-touch tracking, no aggressive outreach.

If you don't have the last two split out, you can point both routes at a
single scoring skill — but keep the persona gate and the sole-signal cap in
the context you pass it.

## 3. Trigger setup

- [ ] Webhook trigger created and pointed at by LeadShark — see
      [installation.md](installation.md) §2–3 for the exact trigger
      instructions and wiring.

## 4. Org memory notes (auto-created on first run, but know their names)

- `Profile Views — <owner> — Processed Visit IDs` — dedup ledger, capped at
  ~200 entries.
- `Profile Views — <owner> — Unresolved Viewers` — raw data for viewers whose
  company couldn't be resolved; review periodically, some are recoverable
  manually.

## 5. Policy decisions to confirm with your team

- [ ] **Anonymous viewers are fully discarded** — no log at all. If you want
      a count, add a counter note, but never enrich or post.
- [ ] **Partner accounts stop silently** — confirm who owns partners and that
      they don't want these signals.
- [ ] **LinkedIn-only outreach** for this signal — no email steps. Confirm
      this matches your outbound policy.
- [ ] **Persona lists in Step 7** — tune the strong/weak buyer-persona lists
      to your ICP's actual buying committee.
