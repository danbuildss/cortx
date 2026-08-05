---
name: "1-to-1-abm-ads"
title: 1:1 ABM ads
description: "Use this skill when running 1:1 ABM ads on LinkedIn — one ad set per named target company, each audience sized and narrowed to the buyers, personalized single-image creatives, and a DRAFT-first campaign build with a script for every step."
category: ABM
---

# SKILL: Run 1:1 ABM Ads on LinkedIn

**Use this when:** you need to run **1:1 ABM (Account-Based Marketing) ads on LinkedIn** -
paid ads aimed one company at a time: a named list of individual companies (one ad set per
company), each audience sized and narrowed to the buyers, with personalized single-image ads
that link to an asset built for that account. Self-contained; start here.

**Read `README.md` for the full end-to-end walkthrough.** This file is the one-screen index.

## The pipeline (each step → its doc + its script)

| # | Step | Do it with | Read |
|---|------|-----------|------|
| 0 | Understand strategy + build procedure | - | `sops/01-abm-strategy.md`, `sops/03-build-and-launch-sop.md` |
| 1 | Resolve companies → org URNs → audience size → runnable (≥300) | `scripts/resolve_and_size.py` | `sops/02-audience-sizing.md` |
| 2 | Narrow each audience to the target band (>300, ideally 300-1,000) | `scripts/narrow_audience.py` | `sops/04-audience-narrowing-sop.md` |
| 3 | Write the copy (creative / commentary / landing page) | - | `sops/03-build-and-launch-sop.md` → "Writing copy" |
| 4 | Generate personalized creatives (gpt-image-2) | `scripts/render_creatives.py` | `sops/05-ad-creative-skill.md`, `sops/06-image-generation-skill.md` |
| 5 | Build the campaign DRAFT (group + ad sets + conversions + UTMs + ads) | `scripts/build_campaign.py` | `sops/03-build-and-launch-sop.md` (Phases 1-7) |
| 6 | QA + activate (explicit go) | `scripts/build_campaign.py` (verify) | `sops/03-build-and-launch-sop.md` (Phase 7) |

## Setup
`python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`, then
`cp scripts/env.example.txt scripts/.env` and fill `LINKEDIN_ACCESS_TOKEN` + `OPENAI_API_KEY`.

## Rules that never bend
- Create everything **DRAFT** (no spend). Activation is separate + explicit.
- **Never delete** via API without a fresh human "CONFIRM DELETE".
- **Never fabricate** ad copy/numbers - trace every word to the landing page.
- Target band: **>300**, ideal **300-1,000**, ≤~1,200 fine, trim hard if >2,000. Entry-level **≤5%**.
- Secrets live in `scripts/.env` only - share `env.example.txt`, never `.env`.

---

> By Ivan Falco - Frontal
