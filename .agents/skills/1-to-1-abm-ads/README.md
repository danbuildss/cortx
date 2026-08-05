# 1:1 ABM Ads Skill

The complete skill for running **1:1 ABM (Account-Based Marketing) ads on LinkedIn** - paid
LinkedIn advertising aimed one company at a time. You build **one ad set per named target
company** (targeting `employers = {that company}` plus a narrowed buyer layer) and run
**personalized single-image ads** - the company's own name/logo in the creative - each
driving one click to an asset built for that account. This kit is everything needed to plan,
size, target, design, and launch that ad campaign end to end. Self-contained; no dependencies
on any other repo.

> **Safety first.** Every build step creates objects in **DRAFT** (no spend). Activation is
> a separate, explicit step. Nothing is ever deleted without an explicit human "CONFIRM
> DELETE". The scripts read credentials from `scripts/.env` - **never commit or share the
> real `.env`**, only `env.example.txt`.

---

## What a 1:1 ABM campaign is (the model)

- **One LinkedIn ad set per target company.** Targeting = `employers = {that company}` plus a
  narrowed layer (geo / function / titles / seniority) so the ad reaches the buyers, not the
  whole company.
- **All ad sets live under one campaign group**, managed and reported together.
- **Creative is personalized per account** - the company's name/logo in the creative is the
  whole point (5-10x CTR). Each ad drives one click to a landing page built for that account.
- Not the same as 1:few / 1:many (a single uploaded company list with title targeting). This
  kit is for the true 1:1 whale/enterprise play.

Full strategy and the "why" -> `sops/01-abm-strategy.md`.

---

## What's in the box

```
1-to-1-abm-ads/
├── README.md                        ← you are here: the full pipeline, end to end
├── SKILL.md                         ← one-screen index / router
├── requirements.txt                 ← Python deps (requests, python-dotenv)
│
├── sops/                            ← the knowledge: read these to understand the decisions
│   ├── 01-abm-strategy.md           ← strategy & the why: campaign types, list vs 1:1, sizing rules, sales orchestration
│   ├── 02-audience-sizing.md        ← the 300-member floor, sizing minimums, bidding for small audiences
│   ├── 03-build-and-launch-sop.md   ← THE build procedure: Phases 0-7 (inputs → size → group → ad sets → conversions → UTMs → ads → QA), plus the copywriting rules for the 3 layers (creative / commentary / landing page)
│   ├── 04-audience-narrowing-sop.md ← how to narrow each audience to the target band via the geo/function/titles/YoE levers + the entry-level rule
│   ├── 05-ad-creative-skill.md      ← how to design the personalized single-image ABM creative (copy structure, hierarchy, never-fabricate rule)
│   └── 06-image-generation-skill.md ← gpt-image-2 mechanics the creative skill depends on (endpoints, resolution, references, masks)
│
├── scripts/                         ← the executable pipeline (Python 3)
│   ├── env.example.txt              ← copy to .env, fill LINKEDIN_ACCESS_TOKEN + OPENAI_API_KEY
│   ├── resolve_and_size.py          ← STEP 1: company list → org URNs → audience size → runnable (≥300)  [read-only]
│   ├── narrow_audience.py           ← STEP 2: walk one account through the levers → recommended targetingCriteria  [read-only]
│   ├── render_creatives.py          ← STEP 4: generate personalized creatives via gpt-image-2  (template - adapt CONFIGS + brand)
│   └── build_campaign.py            ← STEP 5: config-driven builder - group + ad sets + conversions + UTMs + ads, all DRAFT
│
└── config/                          ← templates you copy and fill
    ├── account_list.example.csv     ← input for STEP 1 (name, linkedin_url)
    ├── narrow_config.example.json   ← input for STEP 2 (region, functions, titles, band, geo mode)
    └── build_config.example.json    ← input for STEP 5 (account/org IDs, budget, targeting, conversions, UTMs, per-company copy + image + landing page)
```

---

## Prerequisites

1. **Python 3.9+.** `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
2. **LinkedIn Marketing API access token** with `r_ads`, `rw_ads`, `r_ads_reporting` on an app
   that can reach the target ad account. Put it in `scripts/.env` as `LINKEDIN_ACCESS_TOKEN`.
3. **OpenAI API key** (for creative generation) in `scripts/.env` as `OPENAI_API_KEY`.
4. `cp scripts/env.example.txt scripts/.env` and fill both in.
5. **A landing page per account** (personalized asset the ad links to) - you build these
   separately; the pipeline just needs the URLs.

---

## The full pipeline (run in order)

### Step 0 - Understand the decisions
Read `sops/01-abm-strategy.md` (why) and `sops/03-build-and-launch-sop.md` (the master build
procedure - Phases 0-7). Every later step maps to a phase there.

### Step 1 - Resolve + size the account list  → `scripts/resolve_and_size.py`
Turn a list of company names/LinkedIn URLs into resolved org URNs with their addressable
audience, and see which clear LinkedIn's **300-member floor**.
```bash
cd scripts
cp ../config/account_list.example.csv ../config/account_list.csv   # then edit it
python3 resolve_and_size.py                       # region defaults to North America + Europe
# → writes ../config/account_list_sized.csv  (org_id, audience_size, can_run_300, match_basis)
```
Rows flagged `first_unverified` matched a same-name entity - eyeball those before trusting
them. Anything under 300 isn't runnable as a 1:1 ad set (expand region or drop it). Details:
`sops/02-audience-sizing.md`.

### Step 2 - Narrow each audience to the band  → `scripts/narrow_audience.py`
For each runnable account, decide the targeting so the ad set lands in the sweet spot. The
tool sizes the account through the levers, prints the seniority mix + entry-level %, and
outputs a ready-to-use `targetingCriteria`.
```bash
cd scripts
python3 narrow_audience.py --org 3254263 --geo-mode light
# or, with a config:  python3 narrow_audience.py --slug robinhood --config ../config/narrow_config.json
```
**Target band:** > 300 (hard floor) · sweet spot 300-1,000 · up to ~1,200 fine · 2,000+ trim
hard toward 1,000. **Entry-level ≤ 5% (ideally 0%)**, decision cluster (Manager/Senior/VP) on
top. Full logic + the geo strategic fork: `sops/04-audience-narrowing-sop.md`.

### Step 3 - Write the copy (3 layers)
The ad spans creative + commentary + landing page, designed together. The ad's only job is
one click to the page. Rules, the point-of-view, and a worked example are in
`sops/03-build-and-launch-sop.md` → "Writing copy for 1:1 ABM ads". Never invent a play, number,
or claim that isn't on the page.

### Step 4 - Generate the personalized creatives  → `scripts/render_creatives.py`
Design the single-image ABM ad per account with gpt-image-2 (company name/logo as the hook).
`render_creatives.py` is the working **template** - adapt the `CONFIGS` list and the brand
values (colors, fonts, logos) to your brand, then run. Design rules: `sops/05-ad-creative-skill.md`;
image-gen mechanics: `sops/06-image-generation-skill.md`.
```bash
cd scripts
# edit CONFIGS + brand values inside render_creatives.py first
python3 -u render_creatives.py     # renders in parallel to ./output/{...}
```

### Step 5 - Build the campaign (DRAFT)  → `scripts/build_campaign.py`
Config-driven builder. Fill `build_config.json` from Steps 1-4 (org IDs, budget, the narrowed
targeting from Step 2, conversions, UTMs, and per-company landing page + image + headline +
commentary). Runs Phases 1-7 of the build SOP with a verify gate after every create.
```bash
cd scripts
cp ../config/build_config.example.json ../config/build_config.json   # then fill it
python3 build_campaign.py --config ../config/build_config.json               # DRY RUN (no writes)
python3 build_campaign.py --config ../config/build_config.json --execute     # builds everything DRAFT
```
**Mandatory and easy to forget:** attach the account's active **conversions** to every ad set,
and set **UTMs** at the ad-set level (not baked into ad URLs). Single-image link ads must be
built as an **article** post (not media) or they lose the destination URL + CTA. All in
`sops/03-build-and-launch-sop.md` (Phases 4, 5, 6).

### Step 6 - QA + activation
GET each ad set + creative back and confirm targeting, budget, DRAFT status, conversions, UTMs,
and that each ad has a destination URL + CTA + headline. Share the preview URL per ad set. Only
after QA passes, activate (group → ACTIVE, then each ad set → ACTIVE) - **real spend, explicit
go required.** Do NOT use personalized name/logo ads in Germany (privacy regulation).

---

## The target-band cheatsheet

| Audience | Verdict |
|---|---|
| < 300 | Won't deliver - not runnable |
| 300-1,000 | Sweet spot |
| 1,000-~1,200 | Fine |
| ~1,200-2,000 | Acceptable, trim toward 1,000 |
| 2,000+ | Too broad - trim hard |

Levers, in the order the narrowing skill applies them (light-geo default): light geography →
job function (+ exclude junior seniority) → job titles → years-of-experience → final geography.
Geo can also be the *first* lever if geo is the strategy - that's a decision you make up front
(see `sops/04-audience-narrowing-sop.md`).

## Non-negotiable safety rules

- Everything is created **DRAFT / PAUSED**. Never create ACTIVE.
- **Never delete anything** via the API without an explicit fresh human "CONFIRM DELETE".
- **Never fabricate** copy, numbers, or claims - every word on an ABM ad must trace to the
  landing page or something the client provided.
- Keep credentials in `scripts/.env` only. Share `env.example.txt`, never `.env`.

---

> By Ivan Falco - Frontal
