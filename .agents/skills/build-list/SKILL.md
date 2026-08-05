---
name: "build-list"
title: Build list
description: "Builds prospect lists of companies, contacts, or both. Use when the user asks for target accounts, ICP-fit prospects, decision-makers, enrichment, or a list ready for CRM, Swan, or sequence activation."
category: Prospecting
---

## Instructions

**Setup state.** Not yet configured for this org. Load the `Readme` sub-page once to capture the org's default column plan, sourcing tier order, and activation defaults. (Rewrite this paragraph via `swan-update-skill` after setup so future runs read the current config and skip re-checking.)

---

### The mental model — column ladder

Every list build is a table. Each column has four properties:

1. **Input** — which earlier columns it reads.
2. **Cost tier** — free filter / free elimination / cheap enrichment / AI research / paid contact data.
3. **Run-when condition** — which upstream Boolean gates it (almost always `icp_pass`).
4. **Fallback** — what to write when it can't resolve.

You never "search and figure out what to do with the results." You write the column plan, show it to the user, then run it. Cheap filters kill the most rows; only survivors reach the expensive columns.

---

### Step 0 — Lock the brief, push back on fuzz

Before any tool call, restate the brief as WHO + WHAT + WHY + SIZE:

- **WHO** — which ICP segment + which persona(s). If the org has multiple segments and the user hasn't picked one, ask.
- **WHAT** — which constraints are hard (must) vs soft (nice-to-have).
- **WHY** — which motion (cold blast, ABM, signal-trigger, event follow-up, competitor displacement).
- **SIZE** — target row count.

**Push back hard if the brief contradicts the org's saved ICP segments.** Don't silently obey "build me a list of dentists in Ohio" when the org sells observability to engineering teams — call it out and ask whether this is a real off-ICP experiment or a misfire.

If the brief is "lots of SaaS companies that might want X" — that's not a brief. Ask which sub-segment, what size band, what signal.

---

### Step 1 — Size the audience first

Before any full pull, **always run a sizing call with `size: 1`** to learn the audience volume cheaply. Use `swan-fetch-businesses` with the candidate filter set and `size: 1`; read the `total` field.

- If the audience is <50 companies — surface that to the user before proceeding. Thin niches usually need broader filters or a fundamentally different sourcing path (Apify directories, web research), not more retries of the same query.
- If the audience is >5,000 — the brief is too loose. Ask for a tighter filter before pulling anything.

Sizing first prevents the failure mode where you discover after 20 tool calls that the niche is empty.

---

### Step 2 — Write the column plan and show it to the user

Before sourcing, draft the column ladder. Use this template — fill in the motion-specific columns, drop ones the motion doesn't need:

```
INPUT  (free preview)
  domain, name, employee_band, industry, geo, linkedin_url

FREE ELIMINATION  (0 credits — pure code/formula filters)
  ✗ dedupe_keep         — drop duplicate domains (normalize www, lowercase)
  ✗ in_geo              — hard-filter geo from the preview field
  ✗ in_size_band        — re-filter employee count to the user's exact threshold
  ✗ not_in_crm_active   — drop companies/contacts already in active sequences
  ✗ name_sniff_test     — cheap LLM scan on name+domain: "plausibly fits the brief?"
  → icp_pass = AND(all of the above)

CHEAP ENRICHMENT  (~1 credit each — only IF icp_pass)
  + enriched_headcount  — swan-enrich-company (precise headcount, not band)
  + enriched_hq_city    — confirm geo at city, not state level
  + enriched_tech_stack — if motion depends on technographic signal
  → icp_pass_strict = AND(icp_pass, enriched columns confirm)

AI RESEARCH COLUMNS  (LLM tokens — only IF icp_pass_strict)
  Each column = ONE delegated sub-agent answering ONE narrow question.
  + sells_dtc           — "Does {domain} sell direct-to-consumer? yes/no/unclear"
  + has_signal_X        — "Does {domain} show signal X? yes/no/unclear"
  → research_pass = AND(icp_pass_strict, sells_dtc=yes, ...)

TIER  (0 credits)
  + tier                — A/B/C/D from research_pass + signal strength
  → drop tier=D before any contact work

PEOPLE DISCOVERY  (free preview — only IF tier ∈ {A,B,C})
  + contact_rows        — swan-search-employees, filtered to persona(s)
  → people_pass = persona match + LinkedIn URL present

CONTACT ENRICHMENT  (paid — only IF tier ∈ {A,B} AND people_pass)
  + verified_email      — email waterfall: cheapest → next → coalesce → verify
  + phone               — A-tier only, only if cold-call motion exists

ACTIVATION  (only after explicit user approval of size + cost)
  → save as Swan list, tag with segment + source
  → A-tier: priority outreach (sequence or direct push)
  → B-tier: standard nurture
  → C-tier: low-touch / content
```

**Show the table to the user before running it.** Confirm columns and the `icp_pass` definition explicitly. A 30-second clarification now saves hours of misaimed enrichment later.

---

### Step 3 — Execute the ladder

Run the columns top-to-bottom. The moment the candidate pool crosses ~50 rows, **switch to `swan-execute-code`** — dump preview results to a file, merge by normalized domain, run each column as a code pass. Do not reason over hundreds of rows in conversation context.

Provider-call rules that prevent the most common failures:

- **Always call `swan-autocomplete-business-filter` for enum-like filter values** (industry, location, size band) before `swan-fetch-businesses`. Guessing enums causes silent 0-result returns or 422 errors. The trace failed on `10000+` vs `10001+` — autocomplete first, copy values verbatim.
- **Load tool schemas with `swan-load-tool-schemas` once** at the top of a multi-tool plan and copy enum values verbatim. Do not paraphrase.
- **Multi-source for coverage**: one source ≈ 60% of TAM, two ≈ 85%, three ≈ 92%. Default order: Swan native preview → CRM closed-lost / churned / dormant → specialty source (Apollo / Apify) only if the first two left obvious gaps. Same provider with different filters is **not** multi-source.
- **Companies first, then people.** Never start with a broad people search like "VP Sales at SaaS companies." Build the company set first, then find people at those specific companies.

---

### Step 4 — Free elimination is the most important step

After sourcing, before any paid call, run the free elimination pass in code:

1. **Domain dedupe.** Normalize (strip `www.`, lowercase) and drop duplicates.
2. **Hard re-filter the preview fields.** If the user asked for "20+ employees" and the preview band is "11-50", that bucket is ambiguous — either drop it or flag it for enrichment to confirm. Never treat a soft preview bucket as proof of a hard threshold.
3. **Geo precision.** State ≠ city. If the user asked for SF and the preview returned state-level matches, flag them for enrichment, don't count them as passing.
4. **CRM cross-check.** Drop anything already in an active sequence or a recent open opportunity — duplicate touches kill deliverability.
5. **Cheap LLM sniff test.** One short LLM pass over names + domains: "does this row plausibly fit the brief?" Kills obvious noise (guitar shops, flower stores) at zero credit cost.

This step kills 60–80% of the pool. **It is the single biggest credit save in the flow.** Skipping it and going straight to enrichment is the most expensive failure mode.

---

### Step 5 — AI research columns as delegated sub-agents

Each AI research column is one `swan-delegate-to-sub-agents` call answering **one narrow question** about one row. Never combine "is this DTC AND in SF AND sells electrical" into one prompt — that's three columns.

Sub-agent prompt template:

```
Visit {domain}.
Answer ONE question: {specific_question}.
Look at: {specific_pages — homepage, /about, /shop, /products}.
Return one of: yes / no / unclear.
If the site is down or you cannot determine, return: unclear.
Do not guess. Do not infer from general language.
```

Rules:

- Run only on rows that passed `icp_pass`. Never delegate research on the full pool.
- Pilot on 10 rows first. If 80%+ return "unclear", the question is wrong — rewrite before scaling.
- Use the cheapest viable model. Save expensive reasoning for genuine judgment calls (ICP fit, account-pain inference).
- Always include a fallback value ("unclear") so an unreachable page doesn't crash the column.

---

### Step 6 — Tier, then discover contacts

Tier rule:

- **A** — passes ICP and has an active signal (funding, hiring, intent, news).
- **B** — passes ICP, no active signal.
- **C** — partial ICP fit, worth nurture.
- **D** — fails ICP. Drop immediately.

Drop D-tier **before** contact discovery. Then run `swan-search-employees` (free preview) filtered to the personas chosen in Step 0. Cap per play type:

- Cold blast / single-thread sequence: 1 contact per company.
- ABM / multi-thread: 3–5 spanning the buying committee.

---

### Step 7 — Email waterfall on the slice that matters

Only on A/B-tier contacts. Run a waterfall: cheapest provider → next → coalesce → verify.

- Use `swan-enrich-email` with the cheapest provider first; fall back only on miss.
- Batch via `swan-execute-code` + `output/actions.json` for >20 rows. Max 50 actions per batch.
- Validate after coalescing, never during. Drop `invalid`. Treat `catch_all` as risky — only ship if the user accepts the deliverability hit.
- Drop role-based emails (`info@`, `support@`, `hello@`, `admin@`, `contact@`) before activation.

Phone enrichment only on A-tier AND only if a cold-call motion exists.

---

### Step 8 — Dedupe, show cost, activate

- Dedupe by normalized domain at company level.
- Dedupe by verified email at person level; fall back to LinkedIn URL.
- Cross-check CRM: drop contacts already in active sequences.
- **Show the user: list size, tier breakdown, column completeness, estimated credit cost.** Wait for explicit approval.
- After approval, save as a Swan list tagged with segment + source. Route per the org's activation defaults:
  - A-tier → priority outreach (sequence build or direct push).
  - B-tier → standard nurture.
  - C-tier → low-touch / content.

The skill is **not done** until the list is saved or explicitly abandoned by the user. Don't end on "want me to proceed?" with no list object created.

---

## Universal rules

1. **No paid column without `icp_pass = true`.** Every paid enrichment column has an explicit run-when Boolean.
2. **Size before sourcing.** First call is always a `size: 1` audience check.
3. **Companies first, then people.** Never start with a broad people search.
4. **Autocomplete before search.** Validate enum-like filter values before running fetches. Never guess enums.
5. **Cheapest filter first.** Free elimination columns kill 60–80% of the pool before any credit is spent.
6. **One question per AI column.** Each delegated sub-agent answers exactly one narrow question.
7. **Pilot on 10 rows before scaling** any new AI column or enrichment provider.
8. **Show the user the column plan before running it.** Show size + cost before activating.
9. **Push back on briefs that contradict the saved ICP.** Surface the mismatch, don't silently obey.

---

## Anti-patterns

- Running `swan-fetch-businesses` four times with different filter combos in parallel and calling that "multi-source." Same provider, different filters = one source.
- Skipping `swan-autocomplete-business-filter` on enum values like `companySize`. Causes silent 422 errors.
- Treating the `11-50` preview band as a match for "more than 20 employees." Hard thresholds must be re-applied after preview returns, or confirmed by enrichment.
- Letting state-level matches pass when the user asked for a city.
- Enriching the full pool before applying free elimination. Biggest credit leak in the skill.
- Combining "is DTC AND in SF AND sells electrical" into one AI research prompt. Three columns, three sub-agents.
- Ending on "want me to proceed?" with no saved list. The skill is not done until activation happens or the user abandons.
- Quietly obeying a brief that contradicts the org's saved ICP segments.

---

## What good looks like

- The user sees the column plan and the `icp_pass` Boolean definition before any sourcing call.
- `swan-fetch-businesses` is called once with `size: 1` first to establish audience volume.
- Free elimination kills 60–80% of the pool before a single credit is spent.
- Every paid column has a run-when condition referencing an upstream Boolean.
- Each AI research column answers exactly one question; piloted on 10 rows before scaling.
- Final summary shows size, tier breakdown, column completeness, credit cost. User approves explicitly.
- A Swan list object exists at the end, tagged with segment + source, routed per activation defaults.

---

## Specificity sub-pages this skill will grow

Added when the org runs each motion for real. Not all at once.

- `LookalikeFromWon` — list lookalike to closed-won customers.
- `CompetitorCustomers` — suspected customers of a named competitor.
- `EventAttendees` — turn an attendee list into an enriched outreach list.
- `JobPostingSignal` — companies hiring for a specific role.
- `FundingSignal` — companies that recently raised.
- `LocalBusinesses` — local / SMB targets (Maps-style sourcing).
