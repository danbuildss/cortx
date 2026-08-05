---
name: "multi-thread-deals"
title: "Multi-thread deals"
description: "Finds deals with single-threaded risk. Identifies missing stakeholders, recommends who to engage next, and hands off contact-specific next steps to outreach."
category: Deals
---

## Instructions

**State check.** This skill assumes funnel stages and deal data are available, and that the org has a buying-committee persona model defined. Load funnel stages and recent deals via the CRM, and check that personas exist. If funnel stages aren't defined or no CRM is connected, route the user to pipeline review setup first. If personas aren't defined, surface that — without a buying committee model this skill can't tell which roles are missing.

### What this skill does

Find single-threaded (or under-threaded) open deals. Identify the missing persona(s) per deal. Find the right contact at the company for each missing persona. Recommend an introduction or direct outreach.

---

### Step 1 — Find under-threaded deals

`hubspot-search-objects` (object: deals) filtered to open mid-to-late-stage, owner = user (or org-wide). Page size 20.

For each deal, pull associated contacts via `hubspot-get-engagements`. Count contacts with engagement in the last 30 days. Flag deals with:
- **Critically thin** — 1 active contact.
- **Thin** — 2 active contacts.
- **OK** — 3+ active contacts.

Keep critically thin and thin deals for the analysis. Discard OK ones.

---

### Step 2 — Identify the missing personas

Load the buying committee from `swan-get-memory` — economic buyer, technical evaluator, end user, champion.

For each thin deal, check which personas are already engaged (match contact titles against persona definitions). Surface the gap:
- "Acme deal: champion engaged (Sarah, RevOps). Economic buyer NOT engaged. Technical evaluator NOT engaged."

If the org doesn't have personas defined, route to `persona-builder` first — this skill needs the buying committee to know what's missing.

---

### Step 3 — Find the right contact per missing persona

For each missing persona on each deal, run `swan-search-employees` on the company with the persona's title filter. Free preview, no enrichment yet.

Pick the best match: usually the most senior person matching the persona who isn't already engaged. If multiple candidates, prefer:
- Direct counterparts to already-engaged contacts (same level, complementary function).
- Anyone who's shown intent signals (visited site, engaged with social).

If `swan-search-employees` returns nothing for a persona, the company may not have that role — flag it and move on.

---

### Step 4 — Pick the motion per contact

For each identified contact:

| Motion | When | Tool |
|--------|------|------|
| **Internal intro from the engaged champion** | Champion is warm and willing | Draft a "would you intro me to <name>?" message from AE to champion via `reach-out` |
| **Direct cold outreach** | No champion route; signal exists | Hand off to `reach-out` for cold |
| **CRM task for the AE to call** | High-stakes contact (economic buyer); needs human nuance | `hubspot-create-task` |

Default to the intro motion when there's an engaged champion. It's higher trust and faster.

---

### Step 5 — Pull a fresh signal per deal

For each thin deal, `swan-fetch-business-events` last 30 days on the company. A fresh signal becomes the angle for the new contact: "Saw <signal> — wanted to loop you in."

---

### Step 6 — Surface and approve

```
MULTI-THREADING REVIEW

CRITICALLY THIN (1 contact)
  1. <Deal> — $<X> — engaged: <name (persona)>
     Missing: economic buyer
     → Find: <Name (title)> at <Company>
     → Motion: ask champion for intro / cold outreach
     → Angle: <signal-anchored line>

THIN (2 contacts)
  ...
```

End with: "Want me to draft the intro asks and the cold outreaches via `reach-out`?" Wait for per-deal approval.

---

### Step 7 — Track

After outreach lands:
- `hubspot-create-note` on the deal: "Multi-threading: outreached to <Name> (<persona>) on <date> via <motion>."
- `swan-update-memory` (append) with a one-liner so the next pipeline review knows the deal got threaded.

---

### Rules

- MUST identify a missing persona before suggesting a new contact. Random "more contacts" doesn't help — the right roles do.
- MUST default to the intro motion when a champion exists. Bypassing the champion to cold the economic buyer can damage the deal.
- MUST get approval before drafting messages.
- NEVER cold the economic buyer if the deal is already in late stage with a champion — that breaks trust. Use the intro route.
- NEVER suggest a contact who's already been engaged in the last 30 days. Use `hubspot-get-engagements` to check.
- If a deal is single-threaded AND the one contact has gone silent, this is a `stalled-deal-revival` problem, not a threading problem.
