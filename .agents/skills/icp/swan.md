---
title: Readme
description: "Setup page for first-time ICP discovery. Use when an org needs initial segments and buying-committee personas grounded in available evidence."
---

## Instructions

The setup adapts to evidence. Push for the highest-quality path the org can support — CRM data is gold, public materials are second-best, user-uploaded examples are third, cold research is the fallback. Never refuse to set up; downgrade gracefully.

---

### Step 1 — Push on tool connections first

Before any discovery questions, check what's connected. Call `swan-get-org-senders` and look at the org's integration state. Then push:

- **CRM connected?** This is gold — closed-won deals are the strongest signal of who actually buys. If no CRM is connected, tell the user *now* that connecting one (HubSpot, Salesforce, Attio, whatever they use) will produce a materially better ICP and offer to walk them through it. Don't sugar-coat the gap.
- **Email account connected?** Replied threads are the second-best signal — they show who engages and on what messaging. Push for at least one sender connected.
- **Website + public materials available?** Confirm the user's company website is up and lists customers / case studies. If not, ask for a one-pager or pitch deck.
- **CSV or spreadsheet of best customers?** Ask the user if they have one. It's a great fallback when CRM isn't there.

Tell the user *why* each connection matters in one sentence so they understand the trade. A user who skips connections deserves to know they're choosing a weaker setup.

---

### Step 2 — Branch on the evidence you got

Pick the highest path the org can support. Walk down only if the path above isn't available.

#### Path A — CRM connected (highest quality)

1. Pull closed-won deals from the last 12 months from the CRM. Same query for closed-lost. Page in slices.
2. For each won deal, capture the associated company, the contacts on the deal, the close date, the deal size, the win reason if populated. Same for lost — and the loss reason.
3. Search Swan's company records (or enrich where missing) to add firmographics: industry, employee band, geo, funding stage.
4. Pull the contacts who actually championed or signed the won deals. These titles become the persona seeds — not theory, real signers.
5. In `swan-execute-code`, group wins by industry / size / geo / stage. Where do they concentrate? That's the segment boundary.
6. Group lost deals the same way. Where do losses dominate? That's an exclusion boundary.

#### Path B — Website + public materials

1. Use `swan-fetch-scraped-url` on the user's homepage, customers page, case studies, and pricing page.
2. Pull every named customer logo. Search Swan's company records for each — get industry, size, geo, stage.
3. Pull every named title in case studies and quotes — those become persona seeds. ("VP RevOps at <customer>" → RevOps Director persona.)
4. Read the homepage messaging — what problem does it claim to solve, who does it speak to? That signals the implicit target.
5. Group the named customers by industry / size — the cluster is the candidate segment.

#### Path C — User-provided materials

1. Ask the user to upload anything they have: a CSV of best customers, a pitch deck, a one-pager, a sales kickoff doc.
2. If CSV, load via `swan-execute-code` and process: enrich the listed companies with firmographics (search Swan first, enrich only if missing), pull patterns.
3. If deck or doc, scrape the text out (PDF via `swan-execute-code` with `pypdf`, or paste). Extract named customers, named titles, claimed verticals, claimed buyer language.
4. Treat the extracted entities like Path B — group by firmographics, derive segment + persona.

#### Path D — Cold research (fallback)

If none of A/B/C is available — new company, nothing connected, no materials — work backwards from differentiation:
1. Ask the user: "What does your product do better than the alternatives, and who do you think cares most?"
2. Use `swan-fetch-scraped-url` on the user's own website if it exists to compare against the claim.
3. Use `swan-fetch-businesses` to surface candidate companies that match the user's described target.
4. Be explicit with the user: this is a hypothesis ICP. The right next step is to validate it by closing 5–10 deals and re-running `/icp` from real data.

---

### Step 3 — Synthesize 1–3 segments

Compose segments from whatever evidence was gathered. A segment has:
- A short label ("Mid-market SaaS RevOps", "Series B fintech compliance").
- Firmographic boundaries (size range, industry list, geo, optional funding stage).
- A two-sentence "who they are" framing.
- An "out of scope" line — what looks similar but isn't.
- **Cite the evidence** — every segment names the source: "3 of 5 closed-won are 200–500 employee B2B SaaS — segment 1" or "4 of 7 named case-study customers are Series B fintech — segment 2".

If the evidence supports one segment, propose one. Don't pad to three.

---

### Step 4 — Define personas in the same pass

Personas are part of ICP — define them now, not in a separate skill.

- **From CRM (Path A):** titles that actually championed or signed in won deals. Group by frequency. The top 2–3 titles per segment are the seed personas.
- **From web (Path B):** titles named in case studies and quotes. Same grouping logic.
- **From user materials (Path C):** titles named in the deck / one-pager.
- **From cold research (Path D):** the typical buying committee for that ICP, with explicit caveat that this is a hypothesis.

For each persona capture:
- **Name** — short label ("RevOps Director").
- **Titles** — comma-separated aliases for matching.
- **Buying role** — champion / economic buyer / technical evaluator / blocker.
- **What they care about** — derived from why they'd care about *this* product.
- **Why they'd care about this product specifically** — one sentence tying the persona to the user's value prop.

If responsibilities or objections are clear from the evidence, capture them. If not, leave empty — don't invent.

---

### Step 5 — Show back, confirm, save

Show the user every segment and every persona before saving. Ask: "Does this look right? Anything to add, cut, or sharpen?"

After confirmation:
- Each segment → `swan-create-icp-segment` with firmographic boundaries and description.
- Each persona → `swan-create-knowledge-persona`.
- Sharpened value prop articulated during setup → `swan-update-knowledge-value-prop`.
- Target markets (geo, vertical) implied by the segments → update via the org knowledge surface if not already captured.

Confirm what was saved: "Saved 2 ICP segments and 4 personas."

---

### Step 6 — Recommend next steps

Pick the one that matches the evidence path:
- **Path A (CRM)** → "Run scoring on the next batch of unscored accounts to validate the rubric. Or run an account-fit check on a deal you recently lost to sanity-check."
- **Path B (web)** → "Run scoring on the named customers — they should all come out tier A. If they don't, the segments need a tweak."
- **Path C (user materials)** → same as B.
- **Path D (cold)** → "This is a hypothesis ICP. Closing 5–10 real deals and re-running `/icp` from CRM data is the path to a real ICP."

---

### Step 7 — Rewrite the parent skill's Setup state paragraph

Call `swan-update-skill` on the parent `icp` skill and rewrite its `**Setup state.**` paragraph so it describes what was just configured. The rewritten paragraph should name each saved segment with a one-line firmographic boundary (e.g. "Mid-market SaaS RevOps (50–500 emp, B2B SaaS, Series B+)"), the persona count across all segments, the evidence path used (CRM / web / user materials / cold), and today's date as last-refreshed. Drop the "Not yet configured" wording entirely.

Future invocations of this skill will read the rewritten paragraph and proceed without re-checking state.

---

## Recommended companion skills

- `/score` — score a sample of accounts against the new rubric to validate it.
- `/tam-scoring` — score a TAM list at scale once the rubric is trusted.
- `account-fit-explainer` — sanity-check the rubric against a known win or loss.
- `icp-evolution` — once the org has 4+ quarters of history, run drift analysis on a quarterly cadence.

---

## Rules

- MUST end with both segments AND personas saved. Setup that produces only one half is incomplete.
- MUST cite the evidence source for each segment. "Trust me" isn't a segment.
- MUST push for the highest-quality path available before downgrading.
- NEVER propose more than three segments — anything beyond that isn't a segment, it's a list.
- NEVER invent customers, signers, or signals the evidence didn't surface.
- NEVER skip the show-back step. The user approves before save.
