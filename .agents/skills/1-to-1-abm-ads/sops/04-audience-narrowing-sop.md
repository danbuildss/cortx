# 1:1 ABM Audience Narrowing SOP (LinkedIn)

How to take a 1:1 ABM account's raw addressable audience and narrow it down to a
targeted, deliverable ad-set audience - the right decision-makers at that account,
in the right size band. This is the companion to `03-build-and-launch-sop.md`: that SOP sizes
each company (Phase 1) and builds the ad sets (Phase 3+); THIS doc is the logic for
what targeting to actually put on each ad set so it lands in the band.

**Read `03-build-and-launch-sop.md` first** for the build mechanics. This doc only covers the
targeting-narrowing decision. It is read-only analysis - it never writes to the API.

Tool: `../scripts/narrow_audience.py` implements the mechanical part (sizes an account
through each lever and reports the seniority mix). The judgment calls (how much geo
matters, which countries, which titles) stay with the human/agent - the tool reports
the numbers, you decide the levers.

## The target band (the whole point)

Every ad set audience must land here:

| Band | Verdict |
|---|---|
| **< 300** | ❌ Won't deliver. LinkedIn's hard floor. Never ship below this. |
| **300 - 1,000** | ✅ Sweet spot. Ideal. |
| **1,000 - ~1,200** | ✅ Fine. Leave it if you can't trim further without dropping under 300. |
| **~1,200 - 2,000** | 🟡 Acceptable, but try to trim toward 1,000. |
| **2,000+** | 🔴 Too broad. Trim hard - get it back toward the 1,000 range. |

- 400-500 is completely fine - do not trim a small audience just to trim it.
- The goal is not "as small as possible." It is **> 300, as close to the 300-1,000 range as you can get without going under 300.**
- If an account simply cannot get above 300 even at its broadest (whole company, whole region), it is not runnable as a 1:1 ad set - flag it (expand region, or drop the account).

## Step 0 - Decide how important geography is FIRST

Geography is not a fixed step in the sequence - it is a strategic decision you make
before anything else, because geo can cut a LOT and cutting it wrong throws away the
exact decision-makers you want.

Ask: **is this a geo-specific play?**

- **Geo IS the strategy** (e.g. you only sell/serve one country, or the campaign is deliberately country-scoped) -> **strict-geo-first**: narrow to the target country up front, then trim by function/titles/YoE from there.
- **Geo is NOT the strategy** (default for most 1:1 ABM - you want the right buyer wherever they sit) -> **light-geo**: keep the region broad (e.g. North America + Europe), drop only *clearly* irrelevant countries, then narrow by function -> titles -> years-of-experience, and only apply a **final aggressive geo** trim (down to the one country you care about) as the last resort if nothing else got it into band.

Default to light-geo unless there's a real geo reason. Keeping geo broad is usually
right for 1:1 ABM: you want the decision-maker, not a postcode.

## The narrowing sequence

Start from the base (`employers` + region, from `03-build-and-launch-sop.md` Phase 1). Apply the
next lever ONLY while the audience is still above the band. Stop the moment it lands
in band. After every lever, re-check the size and the seniority mix (below).

**Light-geo path (default):**
1. **Light geography** - drop only clearly-irrelevant countries from the broad region. Keep it broad.
2. **Job function** - narrow the include to the buyer functions, and exclude the junior seniority tier {1,2,3}.
3. **Job titles** - if still over band, switch to specific job titles. Include the titles; put seniority + function in the **exclude** block (see API constraint below).
4. **Years of experience** - if the entry-level share is still high, trim years-of-experience to push entry-level out.
5. **Final geography** - if still over band, narrow all the way down to the single country you care about.

**Strict-geo path (geo is the strategy):**
1. **Strict geography** - narrow to the target country/countries up front.
2. **Job function** - buyer functions + exclude junior seniorities.
3. **Job titles** - specific titles (exclude seniority + function).
4. **Years of experience** - trim entry-level out if needed.

Back-off rule: if a lever drops the audience **below 300**, that lever was too
aggressive - revert it and either stop at the previous in-band config or try a
lighter version (fewer countries excluded, more functions/titles kept). Always keep
the last in-band config.

## Seniority mix - the entry-level rule

Narrowing is not just about the total number. It's about *who* is in the audience.

- The API returns a total, not a distribution. To see the mix, size the audience once **per seniority segment** (1-10) and divide. `../scripts/narrow_audience.py` does this and prints the breakdown + the entry-level %.
- **Seniority IDs** (grounded, from `API_REFERENCE.md`): 1=Unpaid, 2=Training, 3=Entry, 4=Senior, 5=Manager, 6=Director, 7=VP, 8=CXO, 9=Partner, 10=Owner.
- **Entry-level tier = {1 Unpaid, 2 Training, 3 Entry}.** This is what the live Acme SaaS ABM ad sets already exclude.
- **Main decision-maker cluster = {5 Manager, 4 Senior, 6 Director, 7 VP, 8 CXO}.**

Rules:
- **Do not run at entry level.** Entry-level is at the top of the list when you build an audience in the UI - that's the trap.
- Keep entry-level at **≤ 5% of the audience, ideally 0%.** Play with the levers (exclude junior seniorities, trim years-of-experience) until it's there.
- The **main seniority cluster (Manager / Senior / VP) should sit at the top** of the audience. If it doesn't, keep fighting with geo / function / titles / YoE until the audience is genuinely the decision-makers, not the intern pool.
- Whether senior-and-above only, or senior-plus-manager, depends on the account and the offer - that's the judgment part. The rule is: entry-level out, decision cluster on top.

Each ad set is a fresh chance to play with this. There is no single formula - it's a
game of levers against the band and the mix.

## The API levers (grounded facts)

From `API_REFERENCE.md` "Targeting Criteria Structure":

- **Geography:** `urn:li:adTargetingFacet:profileLocations` (profile location - what the Acme SaaS ABM uses). Country = `urn:li:country:{code}` or `urn:li:geo:{id}`. Region rollups: North America `urn:li:geo:102221843`, Europe `urn:li:geo:100506914`.
- **Job function:** `urn:li:adTargetingFacet:jobFunctions` = `urn:li:function:{id}`.
- **Job titles:** `urn:li:adTargetingFacet:titles` = `urn:li:title:{id}` (resolve via typeahead).
- **Seniority:** `urn:li:adTargetingFacet:seniorities` = `urn:li:seniority:{1-10}`.
- **Years of experience:** `urn:li:adTargetingFacet:yearsOfExperienceRanges` = `urn:li:yearsOfExperience:{1-12}` (1-2 URNs to express a range).
- **Employer (the account):** `urn:li:adTargetingFacet:employers` = `urn:li:organization:{id}`.

**Hard constraints (cannot AND together in the include block):**
- `titles` **cannot** AND with `jobFunctions`.
- `titles` **cannot** AND with `seniorities`.
- => When you use the **titles** lever, titles go in `include`, and function + seniority go in `exclude`. You cannot include titles AND include functions/seniorities at the same time.
- `industries` and `staffCountRanges` cannot AND with `employers` (irrelevant here - 1:1 ABM always targets `employers`).

## The live Acme SaaS ABM starting point (grounded)

The active `NA-EU_ABM_*` ad sets in the Acme SaaS account (e.g. `NA-EU_ABM_Autotrader`)
already run a narrowed cut. Use it as the default "job function" step:

- include: `employers` = the account · `profileLocations` = North America + Europe · `jobFunctions` = {4, 15, 16, 18, 25} (the buyer functions) · `interfaceLocales` = en_US
- exclude: junior `seniorities` {1, 2, 3} · a geo blocklist of ~22 irrelevant regions · Acme SaaS' own org (75550113)

This is the concrete default the tool applies at the "job function" step. Swap the
function set / geo blocklist per client.

## How to use `../scripts/narrow_audience.py`

Read-only. Give it an account (slug or org URN) and a config (region, buyer
functions, optional titles, target band, geo mode). It:
1. Sizes the base (`employers` + region).
2. Prints the seniority distribution + entry-level %.
3. Walks the lever sequence for the chosen geo mode, printing the size after each step.
4. Stops when the audience is in band (or reports that it couldn't get above 300).
5. Outputs the recommended `targetingCriteria` JSON for that ad set - hand it straight to `03-build-and-launch-sop.md` Phase 3.

It never writes. It produces a recommendation you review before any build.

## Related files

- `03-build-and-launch-sop.md` - the build procedure (sizing, ad-set creation, conversions, UTMs, ad build).
- `02-audience-sizing.md` - sizing minimums and bidding for small audiences.
- `API_REFERENCE.md` - the full facet list and conflict rules.

---

> By Ivan Falco - Frontal
