---
name: brief
title: Brief
description: "Creates a one-page executive account brief. Use before sponsor syncs, deal reviews, QBRs, or board updates where the user needs account context, opportunity state, risks, and asks."
category: Research
---

## Instructions

**State check.** This skill assumes the CRM is connected and holds the deal, company, contact, and engagement history that an exec brief depends on. It also benefits from the org's funnel stages so the brief uses the same language the exec uses. Check the CRM and pull funnel stages. If no CRM is connected, this skill can't produce a real brief — tell the user and stop. If no funnel stages are defined, the brief still works but won't anchor to the org's own pipeline language; recommend defining the funnel.

### Step 1 — Pull the canonical state

Anchor on facts, not narrative:

- `hubspot-search-objects` on the company, contacts, and deals — pull deal stage, amount, close date, owner.
- `hubspot-get-engagements` to read the last 5-10 substantive touchpoints (meetings + calls only, skip routine emails).
- `swan-search-companies` for the company's Swan record — target-market fit, tags, funnel stage.
- `swan-search-sequences` to know what outreach has run and how it performed.

If the engagement history is dense, read the full JSON from `files/tool-outputs/hubspot-get-engagements_<callId>.json` in `swan-execute-code` and print only meetings + call notes — drop routine emails.

### Step 2 — Map the buying committee

For multi-threaded enterprise accounts, name the committee:

- Economic buyer, champion, technical evaluator, blocker, end users.
- For each: name, title, last engagement, sentiment in one word (engaged, neutral, cold, hostile).

Pull from contact records + meeting notes. Don't invent sentiment — quote what they actually said when possible.

### Step 3 — Identify the risks

The exec wants to know what kills the deal. Surface three to five risks max, each one specific:

- Stakeholder risk: a key buyer hasn't engaged, the champion is leaving.
- Commercial risk: budget, timing, procurement, legal blockers raised in calls.
- Competitive risk: a competitor is in evaluation, an incumbent contract renewal date.
- Execution risk: technical scoping incomplete, integrations unknown, security review pending.

Cite the source for each risk — "raised by CFO on the 3/15 call" is better than "budget concerns."

### Step 4 — Compose the brief

One page. This exact structure:

```
ACCOUNT: <company> — <industry, size, stage>
OPPORTUNITY: <deal name / use case>, <amount>, <stage>, target close <date>
OWNER: <name>

THE PICTURE (3 sentences)
What they're trying to do, why now, why us.

BUYING COMMITTEE
- <Name>, <Title> — <sentiment, one-line context>
- <Name>, <Title> — <sentiment, one-line context>
...

WHERE WE ARE (3-5 bullets)
- Last meaningful touch + outcome.
- Key commitment outstanding (ours or theirs).
- Current gating step.

RISKS (3-5 bullets, each cited)
- <Risk> — <source / quote>
- ...

ASKS
- What does the user need from this exec? Air cover, an intro, a discount approval, an exec sponsor on a call. Be specific.
```

### Step 5 — Pressure-test before delivering

Read the brief back once. Any line that's vague, generic, or unsourced — cut it or sharpen it. The brief earns its keep by being specific.

### Rules

- NEVER pad. If the section has nothing real to say, write "no current risk" or "no stakeholder issue" — don't invent content.
- NEVER cite sentiment without a quote or a specific behavior.
- MUST tie every risk to a source (meeting note, email, call recording, signal).
- MUST end with the asks. An exec brief without an ask is a status update.
- If the deal record is missing or stale, surface that as a finding — "deal stage in CRM is X but last call suggested Y."
- For shorter pre-call prep, chain to `sales-call-prep` instead — this skill is for the broader context.
