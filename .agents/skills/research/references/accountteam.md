---
title: AccountTeam
description: "Research sub-page for buying-committee mapping at one account. Use for ABM, enterprise deals, and multithreading relationship coverage."
---

## Instructions

For prospecting a single contact at many companies, use a contact search and skip this. This sub-page is for going deep on one account.

### Step 1 — Confirm the personas

The agent needs the buying-committee shape before searching. Load the ICP segments and personas — those are the slot list. If no personas are defined:

- Check org memory for any buying-committee notes captured from past plays.
- If nothing, ask the user once: "What roles typically make up a buying committee for your solution? (e.g. Champion: VP Marketing, Influencer: RevOps, Economic Buyer: CRO)"

Aim for 3–5 persona slots. More than that is over-mapping.

### Step 2 — Sweep employees by persona

For each persona slot, run `swan-search-employees` filtered to the company + role keywords. Page size 10 per slot. Don't pull every employee — only the persona matches.

Capture per match: name, exact title, seniority, LinkedIn URL.

### Step 3 — Validate the exec layer first

If any C-suite or VP+ exec was returned, validate them first. `swan-enrich-contact` on the top 1–2 execs only. Their tenure, prior companies, and direct reports may matter for outreach.

Don't enrich every match — only the highest-priority persona for the play.

### Step 4 — Infer reporting structure

`swan-search-employees` results sometimes include manager / department fields. If not, infer from titles:

- VP Marketing reports to CMO (if exists) or CEO
- Marketing Ops reports to VP Marketing or VP RevOps
- AE reports to VP Sales or CRO
- CSM reports to VP CS or CRO

Build a simple two-level tree. Don't over-engineer it. For ambiguous cases, `swan-linkedin-social-media-presence` on the exec may reveal "my team" mentions that clarify structure.

### Step 5 — Identify the entry point

The first person to touch isn't always the most senior. Rank by:

- **Champion potential** — practitioners who use the product daily (Marketing Ops, RevOps, Sales Ops, individual analysts).
- **Influence over evaluation** — managers who scope vendor evals (VP-level functional owners).
- **Economic authority** — sign the contract (C-suite for enterprise, VP for mid-market).

For most B2B sales, start with the influence layer, use the champion to build the business case, then surface the economic buyer at proposal time.

### Step 6 — CRM cross-check

If a CRM is connected, search the CRM for contacts at this company. Existing contacts mean prior relationship history — that changes the entry path entirely. For each existing contact: pull last engagement date and any open / closed deals. Don't restart cold if there's a recent thread.

### Step 7 — Mutual connection check

`swan-get-org-senders` to list connected senders. For each persona match, check whether any sender shares prior company, school, or geo with the contact. Warmer than cold outreach.

### Step 8 — Compose the map

```
<Company> — Buying Committee Map

ECONOMIC BUYER
  <Name, Title> — tenure, prior co, in CRM? — entry path

INFLUENCER(S)
  <Name, Title> — ...

CHAMPION CANDIDATES
  <Name, Title> — ...

PRACTITIONERS
  <Name, Title> — ...

REPORTING (inferred)
  CRO ← VP Sales ← AEs
  CMO ← VP Marketing ← Mkt Ops

WARM PATHS IN
  - <sender> → <person> via <connection>

RECOMMENDED ENTRY
  Start with <person> because <reason>. Multithread to <person> within 2 weeks.
```

### Step 9 — Optional: enrich the bench

If the user plans to multithread, batch-enrich the top 3–5 contacts so emails and phone numbers are ready:

> Use `swan-execute-code`. Write `output/actions.json` with `swan-enrich-contact` calls for the top contacts (≤ 5). Read results in the next code call.

Don't enrich the full org. Only the people the user will actually contact.

### Step 10 — Update Swan and CRM

- `swan-update-company` to tag the company with "buying committee mapped" and the play context.
- For each contact not in the CRM, optionally create a contact in the CRM and associate it with the company so the team can act on them.

## Rules

- MUST verify each persona match has the right title. Don't list a "VP" who's actually a "VP of Engineering" for a marketing play.
- MUST identify the entry person, not just dump a list. A map without a recommended path in is incomplete.
- NEVER over-map. 5 personas is the cap. More than that is research procrastination.
- NEVER enrich the full bench — only the contacts the user will actually message.
- If a persona slot returns no matches, note the role likely isn't filled and adapt the entry recommendation.
- If a tool result is truncated, read the JSON from `files/tool-outputs/<toolName>_<callId>.json` in `swan-execute-code`.
