---
name: battlecard
title: Battlecard
description: "Creates or updates a competitor battlecard. Use when the user needs positioning, strengths, weaknesses, objections, win conditions, and practical talk tracks saved into competitive knowledge."
category: Research
---

## Instructions

**State check.** This skill assumes the org has at least basic positioning established — a value prop and competition notes saved to org knowledge. Load org competition knowledge via `swan-get-memory`. If there's no competition slot at all and no value prop on file, the battlecard will end up generic — build out positioning first (the positioning capability has its own setup flow) before generating a battlecard. If competition notes exist for some competitors but not this one, that's fine: this run becomes the create-from-scratch path.

### When to use

- "Build me a battlecard for X."
- "Update our notes on competitor X."
- "How do we beat X?"
- Before a competitive deal cycle.

### What it produces

A six-section battlecard in canonical format, saved to org knowledge via `swan-update-knowledge-competition` and returned to the user.

---

### Step 1 — Identify the competitor

Get the competitor name and primary URL from the user. Confirm the spelling. If the user has prior notes, load them first via `swan-update-knowledge-competition` (the read path is via `swan-get-memory` on the competition slot).

### Step 2 — Pull existing intelligence

`swan-get-memory` for org competition knowledge. If there's already a section on this competitor, treat the task as **update**, not **create from scratch**. Preserve what's true; only revise what's stale.

### Step 3 — Gather fresh signals

Make a small number of cheap queries. Do **not** dump everything; pick the highest-signal sources first.

- `swan-fetch-scraped-url` on the competitor's homepage and pricing page. Capture: the headline value prop, the primary CTA, the named target customer/segment.
- `swan-fetch-scraped-url` on their /customers or case-study page if linked. Capture 3-5 named customers and any pattern.
- `swan-linkedin-social-media-presence` on the competitor's company LinkedIn. Capture: posting cadence, hiring areas (titles in recent posts), leadership announcements.
- `swan-website-traffic` on the competitor's domain. Capture: traffic order of magnitude (10k, 100k, 1M monthly) and trend direction.
- `swan-fetch-business-events` for funding/leadership/partnership events.

If the user already has fresh intelligence, skip the corresponding fetch. Don't burn credits re-pulling.

### Step 4 — Compose the six sections

Write the battlecard in this exact structure:

```
## Battlecard — <Competitor>
*Last updated: <today's date>*

### 1. One-line description
<What they sell, who they sell to, in one sentence.>

### 2. Where they win
<Bullet list — 3-5 items. The genuine strengths. Don't strawman.>

### 3. Where they lose
<Bullet list — 3-5 items. Real weaknesses, ideally evidenced from public reviews, missing features, or known customer complaints.>

### 4. Common objections we hear
<Format: "Objection → our response."  3-6 entries. Keep each response < 30 words.>

### 5. Win conditions
<Bullet list — when we beat them. Specific buyer profiles, deal sizes, technical requirements, regional factors.>

### 6. Where to push in a deal
<Bullet list — concrete tactical moves. Demo emphasis, pricing posture, proof points to bring up.>
```

Be honest about strengths. A battlecard that pretends the competitor has no advantages doesn't get used.

### Step 5 — Save the result

`swan-update-knowledge-competition` with the new battlecard content. Use append or find-and-replace depending on whether this is a new competitor or an update.

### Step 6 — Return to the user

Return the full battlecard in the response. The user typically wants to read it once and share it.

---

### Rules

- MUST cite real evidence in strengths and weaknesses sections — not opinion. If you can't cite, leave it out.
- MUST keep total length under one page of dense text (~600 words).
- MUST save the final to `swan-update-knowledge-competition`. A battlecard that lives only in chat history is wasted.
- NEVER include speculation framed as fact. If a weakness is rumored, label it ("reported in G2 reviews").
- NEVER include legally sensitive claims (e.g. "their product is insecure") without a citation.
- If the competitor has < 1,000 monthly visitors and no LinkedIn presence, flag that — usually means the user is fighting a ghost. Suggest they reassess whether this competitor is worth a battlecard.
- Date-stamp the battlecard. Competitive intel rots fast.
