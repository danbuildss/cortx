# 1:1 ABM Campaign Build SOP (LinkedIn)

How to build and launch a true 1:1 Account-Based Marketing campaign on LinkedIn for ANY client, the same way it was done for Acme SaaS. This is the execution procedure (API + build steps). For the strategy/why behind ABM, read `01-abm-strategy.md` first.

**When to use this:** the client wants to target a named list of individual companies (whale/enterprise accounts), one company per ad set, with no title/seniority layer. If the client instead wants a single uploaded company list with title targeting, that is 1:few / 1:many - use the `01-abm-strategy.md` list-based approach, not this SOP.

**Writing the ad copy?** Read the "Writing copy for 1:1 ABM ads" section below BEFORE drafting any creative or commentary. The goal, the three-layer model (creative / commentary / landing page), and the cohesion rules are non-negotiable. Most ABM copy mistakes come from skipping it.

**Building the campaign via the API?** Follow the "MANDATORY build procedure (step by step)" section below EXACTLY - phases in order, verify gate after each, no steps skipped. It exists because builds keep failing on the same misses: ads built as `content.media` (no destination URL / headline / CTA), abandoning on a transient 500, and forgetting conversions + UTMs. Do not freelance the build.

**Reusable engine (use this, do not re-write the build each time):** `../scripts/build_campaign.py` is the client-agnostic execution engine for this SOP. It is driven entirely by a `--config` JSON (`../config/build_config.example.json` is the template) and runs Phases 1-7 with a verify gate after every create. Default mode is `--dry-run` (resolve + size + print the plan, zero writes); `--execute` builds everything DRAFT. It supersedes the hardcoded `acme-abm_*.py` scripts. Fill the config from the client's `KNOWLEDGE_BASE.md` + the landing pages; resolve geo/function/seniority URNs from the API (never guess); confirm the plan, then run with `--execute`.

## The 1:1 ABM model

- **One ad set (LinkedIn "campaign") per target company.**
- **Targeting = `employers={company URN}` only.** No job title, seniority, or function layer. This is true 1:1: anyone employed at that account, in the chosen geo.
- **All ad sets live under one campaign group** so they are managed and reported together.
- Creative is personalized per account where possible (company name/logo in the creative can drive roughly 5-10x CTR per `01-abm-strategy.md`). At minimum, one shared creative across all ad sets.

## Per-client variables (fill these in before building)

Pull these from `clients/{client}/KNOWLEDGE_BASE.md` and confirm with the user:

| Variable | Where to get it | Acme SaaS example |
|---|---|---|
| LinkedIn ad account ID | client KNOWLEDGE_BASE | `513219382` |
| Org ID (company page) | client KNOWLEDGE_BASE | `75550113` |
| Campaign group name + id | create new, or reuse existing ABM group | `ABM` / `953312466` |
| Account list source | sheet / sales team / closed-won | "Find Enterprise ICP - Lane 1", tab "Current Top 60" |
| Daily budget per account | confirm with user | `$10` USD |
| Geo | confirm with user | NA (`urn:li:geo:102221843`) + Europe (`urn:li:geo:100506914`) |
| Objective + cost + optimization | copy account's active working combo | ENGAGEMENT + CPM + MAX_CLICK |
| Conversion set | copy account's active campaign conversions | (ASK - replicate active set) |
| UTM convention | copy account's existing adTrackingParameters | (match active campaign) |
| Creative (post + CTA + landing page) | client provides copy/image | (per brief) |

## Config defaults applied to every ad set

| Field | Value | Notes |
|---|---|---|
| Type | SPONSORED_UPDATES | Sponsored Content |
| Format | STANDARD_UPDATE | single image - CREATE-ONLY, cannot be patched later |
| Objective | ENGAGEMENT | use the account's known-good combo |
| Cost type | CPM | |
| Optimization | MAX_CLICK | `ENGAGEMENT + CPM + MAX_CLICK` is known-good in these accounts |
| Daily budget | per-client variable | |
| Geo | per-client variable | |
| Locale | en_US | adjust per client |
| Offsite delivery | disabled | |
| Political intent | NOT_POLITICAL | string, not bool |
| Status | DRAFT | LinkedIn does not allow create-as-PAUSED; DRAFT = not delivering |
| Targeting | `employers={URN}` only | no title/seniority/function |

## Build sequence

### Step 1 - Build the account list and resolve each company to a LinkedIn org URN
- Get the named account list (sheet, sales team, closed-won analysis - see `01-abm-strategy.md` "Account List Building Best Practices").
- For each company, resolve to its LinkedIn organization URN via typeahead.
- If a company has no reliable typeahead match, do NOT guess - flag it and get the user to approve a skip. (Acme SaaS skipped "rocket companies" - no match, and "Money" - ambiguous, only "Money, Inc." which was unverifiable.)

### Step 2 - Check per-company audience size BEFORE creating anything
- Query size with `employers={URN}` + the chosen `profileLocations` (geo) only - no other layer. This is the true 1:1 audience.
- **300 LinkedIn members is the hard launch minimum.** Below 300, LinkedIn will not let the ad set deliver.
- Flag and surface to the user:
  - **Zero audience** (below LinkedIn's reportable band) - the ad set can be created but will never deliver. Decide: expand geo, change entity, or archive. (Acme SaaS: Neighbor = 0, Connecteam = 0 because Israel-HQ.)
  - **Tight audience** (just above 300, e.g. 350-400) - will deliver slowly. (Acme SaaS: Whop = 350, Resy = 390.)
- Note: LinkedIn rounds audience estimates to reporting bands (nearest 10 / 100 / 1000). A "0" means below threshold, not literally zero people.

### Step 3 - Create the campaign group, then one ad set per company
- Create (or reuse) the ABM campaign group.
- Create one ad set per resolved company with the config defaults above, `employers={URN}` targeting, status DRAFT.
- Record the mapping: sheet row -> resolved org -> campaign ID -> audience size -> any flag. (See the Acme SaaS tracker format: `your ABM status tracker` + `.json` + `.csv`.)

### Step 4 - Run the LinkedIn Campaign Creation Checklist (NON-NEGOTIABLE)
The LinkedIn Campaign Creation Checklist (summarized here). The two that have burned us:
1. **Conversions** - ASK the user, then attach the account's existing ACTIVE conversion set to EVERY ad set (engagement objective still needs them). Conversion URN type is `urn:lla:llaPartnerConversion:{id}`. Never ship empty tracking.
2. **UTMs** - set at the CAMPAIGN (ad-set) level via `PUT /rest/adTrackingParameters/...`, NOT baked into ad URLs. Keep each ad's landing page clean. Match the account's existing convention.

Also confirm: format matches creative type (create-only), valid objective+cost+optimization combo, and CTA + landing page set together.

### Step 5 - Attach creative to each ad set
- Build the personalized creative(s). For 1:1, putting the target company name/logo in the creative is the whole point (5-10x CTR).
- Set BOTH `contentCallToActionLabel` AND `contentLandingPage` (CTA is silently dropped if landing page is missing).
- Creative `intendedStatus: ACTIVE` is correct on create - the DRAFT/PAUSED campaign prevents spend.
- **Legal: do NOT use personalized company name/logo ads in Germany** (privacy regulation, not a LinkedIn policy).

### Step 6 - Activation (real spend - needs explicit go from the user)
- Activation = real money. Get an explicit confirmation first.
- Two-step transition: (1) campaign group to ACTIVE, then (2) each ad set to ACTIVE.
- Nothing delivers until both happen.

## Writing copy for 1:1 ABM ads

The hardest part of a 1:1 ABM ad is not the build, it is the copy. The copy spans three layers - the creative, the commentary, and the landing page - and they only work when designed together. Read this whole section before writing a single line.

### The ad's job is one click: get them to the landing page

A 1:1 ABM ad does NOT close the deal or book the meeting. The landing page does that. The ad earns the click. Reverse-engineer every line from "what makes this person click through to the page," not from the final conversion.

This is the #1 mistake: writing the ad as if it has to sell the meeting. It does not. It has to make the right person at the target company want to see the page.

### Never put landing-page-internal language in the ad

Offer names, CTAs, and concepts that the landing page defines (a named teardown, a "30-day custom proposal", a specific framework) mean NOTHING to a cold reader who has not scrolled the page yet. Putting them in the ad reads as nonsense - you are asking them to book something they cannot understand.

- The ad's CTA points to the page in plain, self-evident words: "see the playbook", "take a look", "see the {N} plays".
- Do NOT copy-paste a sentence from the landing page into the ad. Before reusing any page language, ask: does this still make sense to someone who has never seen the page? If not, rewrite it for a cold reader.
- This SOP is generic - do not bake campaign-specific offer names into it.

### Write for a cold reader

The ad must stand on its own and answer, in the reader's head:
- What is this?
- What did this agency build for MY company specifically?
- What am I getting?
- Why should I click?
- Why does it matter to me?

If a line does not move one of those forward, cut it.

### Point of view: speak TO the targeted company's own employees

Targeting is `employers={that company}`, so the reader works there. Write as the agency addressing them directly - "your buyers", "your team", "what you sell". NEVER write about the company in the third person ("plays we built for them", "we audited their GTM") - that reads as talking to outsiders and is wrong.

### Read all three layers before writing, and never invent

The copy is grounded in assets that already exist. Read all of them, including the full landing page, before writing. Never fill a gap with an invented play, number, or offer - if it is not on the page, it does not go in the ad.

- **Creative (image)** = the hook, and the first thing they see. One headline/angle that creates curiosity and signals "we built something specifically for you." It does NOT contain the play's mechanics - it points to them.
- **Commentary (feed text)** = the enticement. Speaks directly to the reader. Explains what the creative's hook actually is, says there is more behind it (the full set / playbook), and gives the reason to click. One hook, one angle - you can run 3+ angle variants across the set. NEVER narrates the ad ("this ad shows...") and NEVER repeats the creative's headline.
- **Landing page** = the substance: the real plays, the system, the proof, the booking CTA. Every specific named in the ad (plays, numbers, competitor names) must come from the page.

### Design the creative and commentary together

The commentary can only reference what the creative has already established. If the commentary says "this is one of five plays," the creative must make that obvious, or the line has nothing to stand on. Give the creative a deliberate structure:

- **Headline:** address the company by name and state, in plain terms, what this single play does for them. ("{Company}: know the moment a company leaves {Competitor 1} or {Competitor 2}.")
- **Subheadline:** establish that this is one of several. ("We built this play and {N-1} more into a playbook for {Company}.")
- **CTA:** point to the full set. ("See the {N} GTM plays for {Company}.")

Before finalizing the commentary, check it against the creative: every claim the commentary makes ("one of five", "built for you", "a playbook") must be something the reader can already see in the creative. If the creative does not support it, fix the creative copy first (which may mean re-rendering the image).

### Cohesion without redundancy

Creative, commentary, and landing page must align and reinforce, never repeat.
- Creative = the one play hook + the promise of more.
- Commentary = why it matters + the nudge to click.
- Landing page = the full detail + the booking.

If the ad and the page are inconsistent on any fact, FLAG it - do not smooth it over.

### Audit before shipping

Run the 15-pattern AI-slop audit + the plain-enterprise-voice check on every line: an AI-slop / plain-voice copy audit. Ground every specific in the landing page; cite nothing the page does not say.

### Worked example (all three layers cohesive)

Target: HubSpot (ad served to HubSpot's own GTM team). Landing page: a playbook of five signal-based plays + a booking CTA.

**Creative (image copy):**
- Headline: *HubSpot: know the moment a company leaves Salesforce or Marketo.*
- Subheadline: *We built this play and four more into a playbook for HubSpot.*
- CTA: *See the 5 GTM plays for HubSpot*

**Commentary (feed text):**
> That's one of five plays we built for your team, each tied to a moment when your next customer starts shopping for what you sell. See the full playbook 👇

**Landing page:** the five plays in full, the buying committee, the proof, and the booking CTA.

Why it works: the creative establishes the one play + the promise of four more; the commentary reinforces why it matters and drives the click without repeating the headline or naming any page-internal offer; the page holds the substance. Second person throughout. Nothing invented - the five plays and the competitor names come straight off the page.

## MANDATORY build procedure (step by step - do not skip, do not reorder)

This is a forcing function, not a guideline. Every 1:1 ABM ad build runs through these phases IN ORDER, and each phase has a verification gate: you do not move to the next phase until the current one is GET-verified. Tick every box. The specific mistakes this prevents are catalogued at the end - read them first so you know what you are guarding against.

### Hard guardrails (apply to EVERY phase)

- **Verify after every create.** GET the object back and confirm the fields you set are actually present. "It returned 201" is NOT proof the field stuck. Verify.
- **`action=createInline` returns HTTP 200 with the URN in the response BODY** (`value.creative`), not 201 with a header. Do NOT treat 200 as a failure and stop.
- **On a hard 4xx** (field rejected), STOP and report the exact `status` + body. Do not improvise a workaround.
- **On a transient 5xx**, retry once; if it persists, switch to the two-step create (`/posts` then `/creatives`). Do NOT abandon the build and leave ad sets empty.
- **Everything is DRAFT.** Never set ACTIVE. Activation is a separate, explicitly-confirmed step.
- **Never delete anything without a fresh explicit "CONFIRM DELETE".**

### Phase 0 - Inputs gate (collect and CONFIRM before any API call)

Do not create anything until every item is in hand. If one is missing, STOP and ask - do not assume, do not default (budget especially).

- [ ] Ad account ID + advertiser org ID (the company page that authors the ads). Org = `GET /adAccounts/{id}` -> `reference`.
- [ ] Company list, each resolved to a LinkedIn org URN (Phase 1).
- [ ] Geo (e.g. United States = `urn:li:geo:103644278`).
- [ ] Targeting layers: `employers` always; optional `jobFunctions` and `seniorities` exclusion. Resolve all facet IDs from the API, never memory. Confirm the exact set with the user.
- [ ] Daily budget per ad set. ASK - never default.
- [ ] Objective + cost + optimization combo (known-good: ENGAGEMENT + CPM + MAX_CLICK).
- [ ] Landing page URL per company, each verified live: HTTP 200 AND the correct personalized page (not a 404 or placeholder).
- [ ] Creative image per company, verified (dimensions, format).
- [ ] Copy per ad: commentary, headline, CTA label (valid enum, Phase 6) - per the "Writing copy for 1:1 ABM ads" section above.
- [ ] Conversions: the account's active conversion set (Phase 4).
- [ ] UTM convention: the account's existing tracking params (Phase 5).

### Phase 1 - Resolve + size each company (read-only)

Per company: typeahead to the org URN, verify identity (a "0 audience" or a duplicate exact-name match is a red flag - confirm with the user), then `audienceCounts` with the FULL include targeting (employers + geo + functions) and the seniority exclusion. Confirm each is >= 300. Record URN, audience size, any flag. GATE: do not build an ad set for a company under 300.

### Phase 2 - Campaign group (DRAFT)

Create the group. GET it back, confirm name + DRAFT.

### Phase 3 - One ad set per company (DRAFT)

Create each campaign with: `name`, `campaignGroup`, `associatedEntity` (advertiser org), `type: SPONSORED_UPDATES`, `status: DRAFT`, the objective/cost/optimization combo, `dailyBudget`, `unitCost: 0`, `locale`, `runSchedule.start`, `politicalIntent: NOT_POLITICAL`, and the full `targetingCriteria` (include employers + geo + jobFunctions; exclude seniorities). GET each back; confirm targeting + budget + status.

`targetingCriteria` JSON shape:
```
{"include":{"and":[
  {"or":{"urn:li:adTargetingFacet:employers":["urn:li:organization:{id}"]}},
  {"or":{"urn:li:adTargetingFacet:profileLocations":["urn:li:geo:103644278"]}},
  {"or":{"urn:li:adTargetingFacet:jobFunctions":["urn:li:function:4","urn:li:function:15","urn:li:function:16","urn:li:function:25"]}}
]},"exclude":{"or":{"urn:li:adTargetingFacet:seniorities":["urn:li:seniority:1","urn:li:seniority:2","urn:li:seniority:3"]}}}
```

### Phase 4 - Conversions (attach to EVERY ad set)

List `GET /rest/conversions?q=account&account={enc sponsoredAccount urn}`, replicate the account's ACTIVE campaign's conversion set onto each new ad set. URN type is `urn:lla:llaPartnerConversion:{id}` (NOT `urn:li:conversion:`). `PUT /rest/campaignConversions/(campaign:{enc},conversion:{enc})` -> 204. GET back to confirm. Engagement-objective campaigns still get conversions - do not skip.

### Phase 5 - UTMs (campaign / ad-set level)

`PUT /rest/adTrackingParameters/(adEntity:(sponsoredCampaign:{enc urn}))`, body includes `adEntity`. Match the account's existing convention (GET an active campaign's params first). Keep individual ad URLs clean - do NOT bake UTMs into the landing page. GET back to confirm.

### Phase 6 - Build the ad (per ad set) - THE STEP THAT BREAKS

This is where the headline, destination URL, and CTA get silently dropped if done wrong. Follow exactly.

**GUARDRAIL - a single-image LINK ad MUST be an ARTICLE post, NEVER a media post.**
- Correct: `content.article = {"title": <headline>, "source": <landing page URL>, "thumbnail": <image URN>}` PLUS top-level `contentCallToActionLabel` and `contentLandingPage`.
- `content.media` (a plain image) has NO destination URL, NO headline, NO CTA. If you use it, the ad renders with an empty Destination URL and a "Select Option" CTA. This is the exact bug to never repeat.

**Valid `contentCallToActionLabel` enums:** LEARN_MORE, SIGN_UP, DOWNLOAD, REGISTER, SUBSCRIBE, REQUEST_DEMO, JOIN, ATTEND, VIEW_QUOTE, APPLY. There is NO custom-text CTA button - any custom phrasing lives inside the creative image, not the button.

Steps per ad:
1. **Upload the image:** `POST /images?action=initializeUpload` (owner = advertiser org) -> PUT the bytes to `uploadUrl` (Authorization Bearer only, no Content-Type) -> poll `GET /images/{enc urn}` until `status == AVAILABLE`.
2. **Create the post:** `POST /rest/posts` with the ARTICLE structure above + `commentary` + `distribution.feedDistribution: NONE` + `adContext: {dscAdAccount, dscStatus: ACTIVE}`. Prefer this two-step path over `createInline` (the inline endpoint 500s intermittently).
3. **Create the creative:** `POST /adAccounts/{id}/creatives` with `{campaign, content.reference: <post URN>, intendedStatus: ACTIVE, name}`. (ACTIVE creative + DRAFT campaign = no spend.)
4. **VERIFY:** `GET /rest/posts/{enc post URN}` and confirm `contentLandingPage`, `contentCallToActionLabel`, AND `content.article.title` are ALL present and correct. If any is null, the ad is broken - fix before moving on. Do not report success without this GET.

```
post = {"author": ORG, "lifecycleState":"PUBLISHED", "visibility":"PUBLIC",
  "commentary": COMMENTARY, "contentCallToActionLabel":"LEARN_MORE", "contentLandingPage": LP,
  "distribution":{"feedDistribution":"NONE","targetEntities":[],"thirdPartyDistributionChannels":[]},
  "content":{"article":{"title": HEADLINE, "source": LP, "thumbnail": IMAGE_URN}},
  "adContext":{"dscAdAccount":"urn:li:sponsoredAccount:{ACCT}","dscStatus":"ACTIVE"}}
creative = {"campaign":"urn:li:sponsoredCampaign:{cid}","content":{"reference": POST_URN},
  "intendedStatus":"ACTIVE","name":"<name>"}
```

### Phase 7 - Final QA (all ad sets)

For each ad set, GET the campaign and its creative and confirm: targeting, budget, status DRAFT, conversions attached, UTMs set, and the ad's destination URL + CTA + headline present. Build the preview URL for each and share for review:
`https://www.linkedin.com/feed/update/urn:li:sponsoredContentV2:({post URN},urn:li:sponsoredCreative:{id})/?actorCompanyId={org id}&viewContext=REVIEWER`

Only after Phase 7 passes for all ad sets is the build complete. Activation (group -> ACTIVE, then each ad set -> ACTIVE) is a separate step requiring explicit user go.

### Failure modes this procedure exists to prevent (all happened in real builds)

- Built single-image ads as `content.media` -> no Destination URL, no headline, no CTA on the rendered ad. FIX: always `content.article` (Phase 6 guardrail).
- Treated the `createInline` 200 response as a failure and stopped mid-build. FIX: 200 with a `value.creative` body IS success.
- Hit a transient 500 and abandoned the build, leaving ad sets with no ad. FIX: retry once, then two-step; never leave an ad set empty.
- Forgot conversions and UTMs entirely. FIX: Phases 4 and 5 are mandatory, not optional.
- Assumed/defaulted the daily budget. FIX: Phase 0 - ask, never default.
- Claimed an ad was done without GET-verifying the destination URL and CTA. FIX: every phase has a verify gate; Phase 6 step 4 is non-negotiable.

## Build scripts

- **`../scripts/build_campaign.py` (USE THIS)** - the reusable, config-driven engine. Implements Phases 1-7 for any client from a `--config` JSON. Default `--dry-run` (plan only), `--execute` builds DRAFT. See `../config/build_config.example.json` for the config shape (account/org IDs, geo, job functions, seniority exclusions, objective, budget, conversions, UTMs, and the per-company list with landing page + image + headline + commentary).
- **`acme-abm_*.py` (LEGACY - do not reuse as-is)** - the original Acme SaaS build, with Acme SaaS IDs and `/tmp` paths hardcoded and no ad/conversion/UTM steps. Kept as a historical reference only; `../scripts/build_campaign.py` replaces it.

The Acme SaaS worked example (records): `your ABM status tracker` (status tracker - config table, 49 companies, audience sizes, caveats) and `acme-abm-tracker.json` / `.csv`.

## Gotchas

- LinkedIn cannot create campaigns in PAUSED. Create in DRAFT; DRAFT is the equivalent non-spending state.
- Campaign `format` is CREATE-ONLY. Wrong format = delete the ad set and recreate (cannot patch).
- Moving an ad set to a different campaign group is immutable - create new, archive old.
- `targetingCriteria`, budget, status, costType, optimizationTargetType ARE patchable after creation.
- A company can match the wrong LinkedIn entity (renamed/acquired). Verify ambiguous matches with the user. (Acme SaaS: cars.com -> Cars Commerce after 2023 rename; ClassPass USA LLC -> ClassPass.)

## Related files

- `04-audience-narrowing-sop.md` - how to narrow each account's audience to the target band (>300, ideally 300-1,000) via the geo/function/titles/YoE levers + the entry-level rule. Tool: `../scripts/narrow_audience.py` (read-only). Use this to decide the `targetingCriteria` for Phase 3.
- `01-abm-strategy.md` - strategy and the why (campaign types, sizing rules, list vs 1:1, frequency, sales orchestration).
- The LinkedIn campaign-creation checklist (conversions, UTMs, format, objective/cost/optimization, CTA) is summarized in Step 4 above.
- `02-audience-sizing.md` - sizing minimums and bidding for small audiences.

---

> By Ivan Falco - Frontal
