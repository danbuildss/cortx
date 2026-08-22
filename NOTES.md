# Cortx — Session Notes

> This file is the persistent memory for this project. Update it at the end of every session or when a key decision is made. Read it at the start of any new session to get back up to speed.

---

## Project Overview

CORTX is the reliability layer for x402. It runs a full synthetic payment through your endpoint (availability → payment terms → price check → payment → delivery → JSON parse → schema validation) every few minutes, records evidence at every stage, opens incidents on consecutive failures, and sends Telegram alerts. Most monitoring asks "is your server alive?" CORTX asks "did someone actually pay for your service and receive the expected result?" — a fundamentally different problem.

Stack: Next.js 16.3.0 (App Router), Supabase (Postgres + Auth + RLS), AJV (JSON Schema validation), Vercel (hosting), cron-job.org (scheduled checks), Telegram Bot API, x402/client npm package (EIP-3009 payment signing).

**Official domain: usecortx.dev**

## Company Roadmap (canonical — last updated Aug 2026)

```
V1    — Monitor           ✅  End-to-end x402 monitoring, incidents, alerts, evidence, public status
V1.1  — Monitoring        ⬅ NOW  Hardening milestone: spend safety, SSRF gaps, budget visibility,
        Integrity               rate limiting, production debug removal, paused-state UI
V1.5  — Reliability       NEXT  Audit and extend stored check data to capture all
        Data Foundation         non-reconstructable observations needed for V3 Intelligence
V2    — Verify +                Observed / Claimed / Verified model, public endpoint submission,
        Reliability Network     CORTX-funded observation tier, managed monitoring for owners
V3    — Intelligence            Reliability Explorer, CORTX Score (with confidence bands),
                                ecosystem intelligence — trends, price drift, schema drift
V4    — Preflight +             Preflight API, MCP tools (cortx_preflight / cortx_reliability /
        Select                  cortx_incidents / cortx_rank), Bankr integration, Cori layer
V5    — Trust /           OPT   ERC-8004 attestations — only if ecosystem adoption warrants it
        Attestations
V6    — Route             OPT   Only if CORTX's reliability intelligence creates demonstrable
                                selection advantage over existing routers
```

**V3 launch gate:** Do not expose CORTX Score until the dataset has sufficient density.
Minimum per endpoint before score is shown: enough paid observations to be statistically meaningful (exact threshold TBD when V3 is being designed, but in the range of 30+ observations over 30+ days).

**Business architecture — keep these three things separate forever:**

| Layer | What it is | Who funds it |
|---|---|---|
| Monitoring product | Monitoring, incidents, alerts, evidence | Builder subscription |
| Verification spend | Actual on-chain endpoint calls | CORTX-curated budget (public endpoints) or builder credits (managed monitoring) |
| Intelligence | Reliability API, preflight, rankings, integrations | Eventually the highest-margin layer |

**On customer-funded verification:** "Customer-funded" means builders buy CORTX verification credits (USDC, card, crypto checkout). The CORTX execution wallet performs the actual checks. Builders never need to operate their own wallets.

**On wallet architecture:** One controlled CORTX monitoring wallet with atomic budget accounting: global budget + per-service budget + per-check cap + concurrency-safe reservation + monitoring-credit ledger + low-balance alert + automatic pause. Per-service wallet isolation would add operational complexity with no benefit at current scale. Enterprise isolation is a later option.

**Current position:** V1.5 Reliability Data Foundation complete (no migration needed — additive JSONB only). Next: V2 Verify + Reliability Network.

## Inbound Feature Requests (from builders)

Track asks from real users — these validate roadmap priority and are proof points for grant applications.

| Date | From | Request | Roadmap fit |
|---|---|---|---|
| Aug 2026 | @aaronjmars (aeon.fun) | Link x402 endpoint to his CORTX account (`aaron@aeon.fun`) — wants ownership of `x402.miroshark.xyz/run` tied to his profile | V2 Verify — endpoint ownership verification |

**Notes on the aeon.fun request:** Aaron hit the detection bug (network/price/recipient/description not detected for his endpoint). Fix shipped in PR #78. He also wants claimed-endpoint-to-account linking, which is exactly the V2 Verify ownership flow. He's the first external builder to explicitly request it — cite him when prioritising V2.

---

## What to Stop Building (Aug 2026 decision)

The product has enough. No more:
- Dashboard redesigns / more charts / more UI polish
- Another settings page or public page
- AI summaries
- More documentation
- More token features

Every build decision must move one of the Phase 1 success metrics.

## Phase 1 Success Metrics (prove CORTX)

Goal: become the default reliability monitor for x402 on Base.

| Metric | Target |
|---|---|
| Builders | 10 |
| Endpoints monitored | 30 |
| Total checks run | 10,000 |
| Real incidents detected | 10 |
| Partners embedding badge/API | 1 |

## CEO Focus (next 4–6 weeks, not product)

- Onboard builders
- Find real failures in the wild
- Publish reliability reports
- Collect testimonials
- Secure integrations
- Apply for Base ecosystem grants
- Talk to Base ecosystem teams

**Biggest risk:** building for six more months without proving builders leave CORTX running because it solves a problem they feel every day.

## One Missing Feature Before Launch

**Endpoint ownership verification.** Registry currently shows OBSERVED endpoints (admin-seeded) alongside builder-monitored ones, but no way to prove a builder owns the endpoint they're claiming.

Flow:
1. Builder pastes endpoint URL
2. CORTX generates a token
3. Builder returns token from their endpoint (in header or response)
4. CORTX marks as ✅ Verified by owner

Registry trust labels:
- ✅ **Verified** — owner confirmed via token challenge
- 👁 **Observed** — monitored by CORTX, owner unconfirmed
- 🌐 **Community** — submitted by third party (future)

This distinction is the foundation of V2 (Verify) and what makes the registry trustworthy rather than just a list.

## Current Status

- [x] In planning
- [x] Building MVP
- [x] Beta readiness sprint — **COMPLETE**
- [x] Private beta ready — invite codes seeded, all infra confirmed working
- [x] Partnership Readiness Sprint — **COMPLETE** (Phase 1 + Partner Integration Sprint + audit)
- [x] Layered Verification Sprint — **COMPLETE** (PR #54 merged, migration 007 applied)
- [x] $CORTX token tiers + public registry — **COMPLETE** (PRs #57, #58 merged, migrations 008+009 applied)
- [x] Paid check every 4h + lightweight every 15min cron — **COMPLETE** (PR #61 merged, migration 011 applied ✓)
- [ ] Public launch — **this week**

**Beta wrapping up.** Public launch planned for next week. Blog post live (usecortx.dev/blog/x402-failure-modes). Utility tweet posted (Aug 15). Ship thread scheduled for Monday. Bankr skill PR open (BankrBot/skills #642). Registry seeding in progress.

### Partnership Readiness Sprint (Phase 1 — shipped)

- **Incident polish**: open rows have red tint + border, pulsing red header dot with count, ACK pill, dedicated "Triggering check" card on detail page (queries most recent failed check within ±2h of incident opened_at), "View service →" nav — no more dead-end incident screens
- **Public reliability page** (`/status/[userId]`): added per-service paid delivery %, schema validity %, median latency, last verified metrics; 30-day parallel query for stage-derived stats; extracted palette to `const C`
- **CORTX Monitored badge** (`GET /api/badge/[serviceId]`): public SVG badge with status, paid delivery %, uptime %; cache-control 5min; graceful unknown badge for bad IDs
- **Service detail share panel**: "Share & embed" section with live badge preview, copy-to-clipboard for Markdown/HTML/URL snippets, public status page link with open button
- **Landing page**: status section updated to mention paid delivery %, schema validity %, median latency; status page mockup shows real metric labels; badge embed example in mockup

---

## What's Been Built

### Infrastructure
- Next.js 14 App Router project on Vercel
- Supabase: Postgres + Auth + RLS (6 tables, including feedback)
- Session hooks: gstack skill suite installed
- cron-job.org calls `GET /api/cron` with `Authorization: Bearer {CRON_SECRET}` (NOT query param)

### Database Tables
- `profiles` — user profiles (linked to Supabase auth)
- `services` — monitored x402 endpoints with config (expected_price, max_price, schema, interval, environment)
- `checks` — insert-only check results with per-stage evidence JSONB (status, latency_ms, stages, failure_stage)
- `incidents` — incident records with JSONB timeline (opened → escalated → resolved events)
- `alert_configs` — per-service Telegram alert configs (destination, on_open, on_severity_increase, on_resolve, enabled)
- `telegram_connections` — user → chat_id after bot deep-link auth
- `telegram_link_tokens` — single-use 10-min tokens for Telegram deep-link flow
- `feedback` — beta feedback submissions (task + problem, linked to user, forwarded to Telegram)

### Check Runner (`lib/check-runner/`)
7-stage synthetic payment pipeline:
1. `availability` — HTTP reachability check
2. `payment_terms` — validates 402 response + parses X-Payment-Required header
3. `price_check` — verifies price is within expected/max bounds
4. `payment` — signs EIP-3009 via x402/client, builds X-Payment header
5. `delivery` — resends request with payment header, expects 200
6. `json_parse` — parses response body as JSON
7. `schema_validation` — validates against expected JSON Schema (AJV)

Key implementation details:
- Uses `x402/client` npm package (`createPaymentHeader`) for EIP-3009 signing
- CAIP-2 normalization: `eip155:8453` → `base` (Bankr sends CAIP-2 format)
- Seeds EIP-712 domain with USDC defaults (`name: "USD Coin"`, `version: "2"`), overridable via `extra` field
- `CORTX_TEST_WALLET_KEY` env var holds 0x-prefixed private key — never logged (private key redacted in all catch paths)
- Response body capped at 1MB via `readBodyCapped()` streaming helper
- Cumulative spend cap enforced daily + monthly (not just per-request)
- 2 consecutive failures required before incident opens
- `status = 'error'` (infra errors) does NOT update service status or open incidents
- Telegram alerts fire via `alert_configs` on incident open / severity escalate / resolve

### API Routes
- `GET /api/cron` — scheduled check runner, requires `Authorization: Bearer {CRON_SECRET}`
- `POST /api/checks/run` — manual "Run check" trigger from UI
- `POST /api/services/detect` — SSRF-protected x402 endpoint prober (returns detected config + missing fields)
- `POST /api/services/onboard` — creates service + runs first check
- `POST /api/telegram/connect` — generates 10-min deep-link token
- `POST /api/telegram/webhook` — Telegram bot webhook (timing-safe secret verify, atomic token claim)
- `POST /api/feedback` — beta feedback submission (→ DB + owner Telegram)

### App Pages (auth-protected, under `(app)/`)
| Page | Route | What it does |
|---|---|---|
| Login | `/login` | Supabase auth (CSS token vars, network error handling) |
| Signup | `/signup` | Supabase auth (CSS token vars, network error handling) |
| Overview | `/overview` | Service list, summary cards, status page copy link |
| Service detail | `/services/[id]` | Status, meta, latency sparkline chart, recent checks table, stage breakdown |
| Service add | `/services/new` | 3-step onboarding wizard (detect → configure → run check) |
| Service edit | `/services/[id]/edit` | Pre-filled edit form, inline "Saved!" confirmation |
| Incidents | `/incidents` | Open + resolved incident list, clickable rows |
| Incident detail | `/incidents/[id]` | Timeline view with colored event dots, meta cards |
| Alert settings | `/settings/alerts` | Telegram alert config per service |
| Account | `/settings/account` | Display name edit (network error handling) |

All app pages have `loading.tsx` skeleton screens (no more blank screens during fetch).

### Public Pages
| Page | Route | What it does |
|---|---|---|
| Status page | `/status/[userId]` | Per-user public status page — overall banner, per-service 90-day uptime bars, active incidents |
| Landing page | `/` | Marketing page — usecortx.dev |
| Docs | `/docs` | Full documentation (single-page, sidebar nav, IntersectionObserver active state) |
| Docs cost | `/docs/cost` | Cost guide — per-stage breakdown, spend caps, cost matrix, planning calculators |
| Blog index | `/blog` | Lists all posts (TypeScript-based, zero new packages) |
| Blog post | `/blog/[slug]` | Individual post renderer with prose styling |
| About | `/about` | About page — what CORTX does, why mainnet, beta status, social links |

### UI Features
- Fixed bottom-right `💬 Feedback` button on all app pages
- Overview: copy-link button for status page URL
- Service detail: SVG latency sparkline (avg/min/max, CSS token colors)
- Service detail: stage breakdown with evidence JSON for last check
- Service detail: open incident banner links to specific incident
- Status page: 90-day colored bar grid per service (green/red/dim-gray), ISR 60s
- Alert settings: per-event toggles with optimistic updates
- Loading skeletons on all high-traffic pages

### Security (all resolved)
- Cron: `Authorization: Bearer` header (not query param)
- Telegram webhook: `timingSafeEqual` constant-time secret comparison
- Telegram token: atomic `UPDATE WHERE used_at IS NULL` (no TOCTOU)
- Checks RLS: policy requires `auth.uid() = user_id AND service belongs to user`
- Payment key: fully redacted in all error paths (`replaceAll`)
- Response bodies: capped at 1MB via streaming reader
- Spend cap: cumulative daily + monthly (not just single-payment check)
- Telegram tokens: expired tokens deleted on each `/api/telegram/connect` call
- **V1.1 P0 (PR #83, Aug 2026):** Atomic spend reservation via `reserve_spend()` Postgres RPC with `pg_advisory_xact_lock` — eliminates concurrent spend cap race. SSRF protection added to verify confirm endpoint. `monitoring_paused_reason` column on services — paused banner in UI, Telegram alert on cap hit, auto-unpause on cron tick. SECURITY.md §6 corrected (cron-job.org, not Vercel Cron). Migration 014 applied.
- **V1.1 P1 (PR #84, Aug 2026):** `_debug` object gated behind `NODE_ENV !== 'production'`. Hardcoded admin UUID replaced with `CORTX_ADMIN_USER_ID` env var. Rate limiting (Postgres sliding window) on checks/run (3/10min), detect (20/hr), verify (5/hr). Migration 015 applied.
- **V1.5 (Aug 2026):** Richer stage evidence in `checks.stages` JSONB — no migration, purely additive. payment_terms: `x402_protocol_version` (v1/v1_compat/v2 from headers), `payment_scheme`. price_check: `atomic_units_detected`, `price_drift_usdc`. payment: `verification_cost_usdc`, `recipient_fingerprint` (SHA-256 prefix — no raw wallet address logged). Runner now also parses `payment-required` (x402 V2 spec) in addition to `x-payment-required`.

---

## Key Environment Variables (Vercel)

| Var | What |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side queries |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key for client-side auth |
| `CORTX_TEST_WALLET_KEY` | 0x-prefixed 32-byte private key for test wallet |
| `CRON_SECRET` | Bearer token for cron-job.org Authorization header |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for alerts |
| `TELEGRAM_BOT_USERNAME` | Bot username (without @) for deep-link URL |
| `FEEDBACK_TELEGRAM_CHAT_ID` | Owner's Telegram chat ID for receiving feedback |

## User Action Items

- [x] Run migration 004 — `supabase/migrations/004_fix_checks_rls.sql` ✓
- [x] Run migration 005 — `supabase/migrations/005_feedback.sql` ✓
- [x] Update cron-job.org: `Authorization: Bearer {CRON_SECRET}` header ✓ (confirmed working)
- [x] Set `FEEDBACK_TELEGRAM_CHAT_ID` env var in Vercel ✓

---

## Key Decisions

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-08-05 | Base **mainnet** only, real USDC | Test with real stakes — testnet doesn't reflect production reliability |
| 2026-08-05 | x402/client npm package for payment signing | Coinbase's reference client handles EIP-712 domain correctly |
| 2026-08-05 | cron-job.org instead of Vercel cron | Vercel Hobby plan only allows daily crons; cron-job.org gives per-minute scheduling free |
| 2026-08-05 | 2 consecutive failures to open incident | Reduces noise from transient failures |
| 2026-08-05 | `error` status never opens incidents | Infra errors shouldn't page you — only real payment failures matter |
| 2026-08-05 | Public status page at `/status/[userId]` | Makes CORTX feel like a real product; shareable without login |
| 2026-08-06 | 3-step onboarding wizard (detect → configure → run) | Reduces time-to-first-monitor to under 2 minutes |
| 2026-08-06 | Feedback button in app (not modal) | Bottom-right fixed button keeps it accessible without interrupting workflow |

## Open Questions

- Email alerts alongside Telegram? (not built)
- Custom domain for status pages?
- On-demand check API (needed for Bankr skill v2 — currently skill requires known serviceId)

---

## Cori — Sibyl Memory Hackathon (Sep 1–10, 2026)

### What it is

**Cori** is CORTX's AI incident-response agent. Named after the raven mascot. Ravens = Huginn and Muninn ("thought" and "memory" in Norse mythology) — fits perfectly with Sibyl Memory's "forgetting is a bug" framing.

- Repo: `danbuildss/cori` (separate from CORTX)
- GitHub description: "AI incident-response agent for CORTX. She remembers every outage so you don't have to."
- License: MIT
- Stack: Python, FastAPI, Sibyl Memory (SQLite/FTS5), Claude API, x402

### Hackathon: Sibyl Memory Hackathon

- Registration: Aug 16–31, 2026
- Build window: Sep 1–10, 2026
- Prizes: $10,000 USDC pool (1st: $4k + Network School residency)
- Judging: Sep 11–12 · Winners: Sep 13–15

**Scoring formula:** `(rubric + PMF bonus) × partner multiplier`
- Rubric: 100 pts (memory 40 + innovation 25 + execution 20 + pitch 15)
- PMF bonus: up to +10
- Partner multiplier: Base +15%, Virtuals +10%, cap x1.25

### Why CORTX + Cori wins this

- **Gate**: delete Sibyl Memory → Cori loses all runbooks and history → core value gone. Load-bearing confirmed.
- **Base multiplier (x1.15)**: x402 is already on Base mainnet. Wire the deep-pattern analysis behind an x402 payment gate → Base stack verified in the demo.
- **PMF bonus (+7–10)**: CORTX launches this week → real users by Sep 1 = publicly verifiable evidence.
- **Score projection**: ~95 rubric+PMF × 1.15 = **~109 Builder Score** → top-3 realistic.

### Memory architecture (scores at top of the 40pt band)

Uses Sibyl's tier system deliberately (coordination + dynamic storage = not just recall):

| Tier | What Cori stores |
|------|-----------------|
| HOT | Current incident working context |
| WARM | Service entities — known failure modes, tech stack, owner, alert count |
| COLD | Incident journal — every alert with timestamp, error signature, duration, resolution |
| REFERENCE | Runbooks — proven fixes captured after user confirms resolution |

**Coordination pattern**: on alert, agent queries WARM entity + COLD journal for this service + cross-queries COLD for correlated services that failed in the same window. Synthesizes a diagnosis that changes its recommended action.

**Dynamic storage**: agent decides what to store — structured incident entity on alert, prompted runbook capture after resolution, deduplication for repeat patterns.

### The fresh-session recall beat (gate requirement)

1. Session 1: alert fires for `api-service`. User resolves — DB pool exhausted. Agent writes runbook. Timestamp shown on screen.
2. Close everything. New terminal. Timestamp shown.
3. Session 2: same service alerts. Agent recalls runbook from session 1. Recommended action changes — goes straight to DB pool fix.

### Demo video script (2–3 min)

- 0:00–0:30: Problem — 3am page, 45 min wasted because nobody remembered last month's fix
- 0:30–1:00: Session 1 — alert fires, Cori learns, user resolves, runbook written (timestamp)
- 1:00–1:10: Close everything, new session, timestamp shown
- 1:10–1:50: Session 2 — same alert, Cori recalls runbook instantly, resolved in 90 seconds
- 1:50–2:30: x402 payment for deep-pattern analysis (Base multiplier), cross-service correlation, PMF evidence

### 10-day build plan

| Day | Work |
|-----|------|
| 1 | Sibyl Memory setup + CORTX webhook listener |
| 2 | Write incident to COLD journal on alert |
| 3 | Write WARM service entity, update on repeat |
| 4 | Agent reads memory on new alert → changes response |
| 5 | Cross-service correlation query (coordination pattern) |
| 6 | x402 payment gate for deep-pattern analysis |
| 7 | Runbook capture flow (post-resolution → REFERENCE write) |
| 8 | Fresh-session recall test + polish |
| 9 | Demo video — cold-start recall beat with on-screen timestamp |
| 10 | README + two X posts + submit |

### Repo status — SCAFFOLDED ✅ (Aug 19, 2026)

Initial commit pushed to `danbuildss/cori` main. All files live:

```
cori/
  README.md                  ← submission-ready overview
  LICENSE                    ← MIT
  requirements.txt           ← fastapi, anthropic, sibyl-memory-cli[mcp], httpx
  .env.example               ← all required env vars documented
  agent/
    main.py                  ← FastAPI app entry point
    routes/
      webhook.py             ← /webhook/alert + /webhook/resolve (HMAC auth)
      analyze.py             ← /analyze (x402 payment gated)
      health.py              ← /health + /memory/stats
    memory/client.py         ← Sibyl HOT/WARM/COLD/REFERENCE tier wrappers
    llm/analyze.py           ← Claude Haiku (fast alerts) + Sonnet (deep)
    telegram/send.py         ← memory-enriched Telegram delivery
```

**Spec doc (Artifact):** https://claude.ai/code/artifact/e58b342c-0345-4282-a7fb-31a748e297f1

To run: `pip install -r requirements.txt && sibyl init && cp .env.example .env && uvicorn agent.main:app --reload`

### How CORTX and Cori connect

```
CORTX → fires webhook on incident
  → Cori receives it
    → queries Sibyl Memory
      → returns AI response with history
        → sends via CORTX's existing Telegram/Discord channels
```

### Key decisions

| Decision | Reasoning |
|----------|-----------|
| Named `cori` not `cortx-agent` | Raven mascot = thought + memory mythology. A name beats a label on the leaderboard. |
| Separate repo | Clean MIT license, commit history starts Sep 1, judges read focused code |
| Base only (not Virtuals) | x1.15 guaranteed via existing x402. Virtuals adds complexity for +0.10. Solo builder. |
| Python not TypeScript | Sibyl Memory CLI is Python-native. Faster to wire. |

## Open Source Strategy — "Open Tools. Paid Network." (Aug 18, 2026)

Decision locked: CORTX's OSS philosophy is Open Tools, Paid Network. Open the standard and client tooling; close the monitoring network, accumulated reliability data, and V2–V4 features.

### What's been shipped

**`danbuildss/x402-reliability-spec`** — public GitHub repo, live at https://github.com/danbuildss/x402-reliability-spec

The open specification for x402 service reliability. Defines the 7-stage verification pipeline as a machine-readable standard — not CORTX-specific, anyone can implement.

| File | What it is |
|------|-----------|
| `SPEC.md` | Full 7-stage definition with pass/fail conditions, evidence fields, and rationale notes |
| `schema/evidence-record.json` | JSON Schema for a complete check result |
| `schema/check-result.json` | JSON Schema for a single stage result |
| `examples/` | 3 example records (passing, failing stage 5, failing stage 2) |
| `CONTRIBUTING.md` | Contribution workflow — issues first for substantive changes |
| `CODE_OF_CONDUCT.md` | Required for GitHub community health checklist |
| `.github/workflows/validate-examples.yml` | CI: validates all examples against schema on every PR |
| `.github/ISSUE_TEMPLATE/` | Ambiguity report + edge case discussion templates |

**Current spec version:** v0.1.1 (working draft)

**CORTX is the reference implementation.** The spec is open; the monitoring network (historical data, scheduled infra, alerts, cross-service intelligence) is closed and commercial.

### Four plays (in order)

1. **x402-reliability-spec** ✅ DONE — publish open spec on GitHub
2. **@cortx/check npm package** — after public launch — open source the check runner (`lib/check-runner/`)
3. **Open Registry read API** — after 50+ endpoints verified — public read access to reliability scores
4. **Open Core / full dashboard** — SKIP for now, revisit at V3

### Distribution done

- Tweet posted (Aug 18): https://x.com/danbuildss/status/2089682066593972377 — quoted @base/Jesse Pollak "open standard" tweet while x402 was trending
- Methodology page on usecortx.dev now links to the spec (PR #71, pending merge)
- GitHub Discussion post drafted for coinbase/x402 — post manually

### Key naming decision

`x402-reliability-spec` chosen over `x402-health-spec` — reliability covers the full 7-stage picture (payment delivery, schema validity, latency, uptime). "Health check" only implies server availability.

### Open items

- Post GitHub Discussion on coinbase/x402 Discussions
- DM individual x402 contributors (template ready — see reach-out skill output)
- Merge PR #71 (methodology page → main)

---

## GTM — Launch Week Plan (week of Aug 18)

- Monday: ship update thread on X
- Beta closes → open signups
- BankrBot/skills PR #642 merged → announce CORTX as a Bankr skill
- Registry/founder blog post (next weekend)
- Registry push — outreach to x402 builders (DM templates ready)
- Next week: registry awareness tweet

## Branch / PR History

- Branch: `claude/persistent-skills-sessions-727k7h`
- PRs 1–29: all merged to main
- PR #29 (merged): admin wallet & spend tracking, copy buttons, extended metrics, cron maxDuration fix
- PR #30 (merged): /docs page built into the website
- PR #31 (merged): beta price hard cap ($0.10/call) + docs links fixed on landing page
- PR #32 (merged): static blog (/blog, /blog/[slug]), footer Company column (About + Blog), Cost Guide in Resources, /docs cost guide callout card
- PR #33 (merged): 24H/7D/30D time range toggle on Overview and service detail
- PR #34 (merged): fix — Suspense boundary for RangeToggle
- PR #35 (merged): fix — split range utilities out of 'use client' module (root cause of server crash)
- PR #36 (merged): CORTX logo favicon (app/icon.svg), /about page, domain fixes (usecortx.dev), docs example URL updated to x402.bankr.bot
- PRs #37–#49 (merged): historical check inspection, per-service uptime, pass/fail chart coloring, admin enhancements, mobile fixes
- PR #50 (merged): Partnership Readiness Sprint — incident polish, reliability page, badge, share panel
- PR #51 (merged): fix — mobile responsiveness for Partnership Readiness Sprint
- PR #52 (merged): Partner Integration Sprint — public reliability API, service status page, methodology page, partner integration docs, admin partner readiness table, `lib/metrics.ts` single source of truth, `--status-ok` CSS token, badge consistency fixes
- PR #53 (merged): fix — CORS headers on Reliability API + partner onboarding audit
- PR #54 (merged): Layered Verification Sprint — three-tier monitoring model
- PR #57 (merged): $CORTX token tiers, public registry, Telegram logo, nav polish (migrations 008+009)
- PR #58 (merged): blog post — "x402 has 7 failure modes. Standard monitoring catches one."
- PR #59 (merged): admin — multi-window platform stats table (24h/7d/30d/90d/1y/all) + registry seeds section with inline add form
- PR #60 (merged): paid check once per day, lightweight on every 2h cron fire — migration 010 applied ✓
- PR #61 (merged): paid check every 4h (migration 011), lightweight every 15min cron — migration 011 applied ✓
- PR #71 (open): methodology page — "Open Standard" section linking to x402-reliability-spec repo
- **BankrBot/skills PR #642 (open)**: CORTX skill — x402 endpoint reliability for agents
- **PR #83 (merged)**: V1.1 P0 — atomic spend reservation, SSRF fix in verify, monitoring paused state, migration 014 applied ✓
- **PR #84 (merged)**: V1.1 P1 — _debug removed from production, admin UUID → env var, rate limiting on checks/run + detect + verify, migration 015 applied ✓
- **V1.5 (no PR — direct commit 5889996)**: Reliability Data Foundation — richer stage evidence in runner.ts (x402_protocol_version, payment_scheme, atomic_units_detected, price_drift_usdc, verification_cost_usdc, recipient_fingerprint). No migration, additive JSONB only.

### Partner Integration Sprint deliverables (PR #52, merged)

- **`lib/metrics.ts`** — single source of truth for all reliability metrics (`computeMetrics`, `medianLatency`); infrastructure errors excluded; proper even-array median
- **`GET /api/v1/reliability/[serviceId]`** — public JSON reliability API, no auth, 30d window, 5-min cache; returns `{ service_id, service_name, status, window, uptime_percent, paid_delivery_percent, schema_validity_percent, median_latency_ms, last_verified_at, active_incident }`
- **`/status/service/[serviceId]`** — public per-service status page; 30d metrics grid, 90d availability bar, active incident banner, recent incident list, embed section with real URLs
- **`/methodology`** — public page explaining 7-stage pipeline, metric formulas, measurement windows, disclaimer
- **`/docs/partner-integration`** — partner docs with copy buttons for badge (Markdown/HTML/URL), status page URL, API curl + response examples + field table, use cases
- **Admin partner readiness table** — shows per-service status, last verified, incident flag, and direct links to status page/badge/API
- **Share panel** — added service status page URL (separate from account status page)
- **Docs sidebar** — Partner group added with Partner Integration + Methodology links
- **Badge + user status page** — both now use `computeMetrics()`, consistent 30d window

### Layered Verification Sprint (commit 019ce35 — on branch)

Three-tier monitoring model: every service now gets a free 5-min availability ping AND a paid full/canary verification on a separate configurable schedule.

**Migration 007** adds to `services`: `lightweight_check_interval_minutes`, `paid_verification_mode` (`full|canary|disabled`), `paid_verification_interval_minutes`, `canary_payload/expected_schema/max_price_usdc`, `last_lightweight/paid/full_check_at`, `next_paid_verification_at`. Adds `check_type` to `checks` and `trigger_check_type` to `incidents`.

**Runner**: `runLightweightCheck` (HEAD/GET ping, no payment), `runFullCheck` (renamed from `runCheck`, alias kept for compat), `runCanaryCheck` (full pipeline with canary config).

**Cron dual-loop**: Loop 1 fires lightweight pings; Loop 2 fires paid verifications for services with `next_paid_verification_at ≤ now AND mode != disabled`.

**Persist**: Lightweight results only advance the scheduler, no status/incident changes. Incident resolution respects tier hierarchy — canary can resolve canary, full resolves all; lightweight never resolves incidents.

**UI**: Service detail shows monitoring freshness cards (ping vs. paid, last timestamps). Checks table gains a Type chip column (ping/canary/full). Onboarding wizard hint updated. Public API `/v1/reliability` gains `verification{}` object with mode and timestamps; reliability metrics computed from paid checks only.

**User action required**: Run `supabase/migrations/007_layered_checks.sql` in Supabase SQL editor.

### Partner onboarding audit (PR #53)

Audited all integration surfaces as an external partner. One hard blocker found and fixed: missing CORS headers on `/api/v1/reliability/[serviceId]` — browser-side fetch calls were blocked. Fixed by adding `OPTIONS` preflight handler and `Access-Control-Allow-Origin: *` to all responses. No other hard blockers found.

---

## Base Builder Grant Program — Application (Aug 2026)

Up to $5,000 seed capital + GTM & Product support. Fits: Agents / Agentic Commerce (x402).

### Drafted answers

| Field | Answer |
|---|---|
| **Full name** | [YOUR FULL NAME] |
| **Email** | danewurum01@gmail.com |
| **X handle** | @danbuildss |
| **Telegram username** | [YOUR TELEGRAM @USERNAME] |
| **Project name + one-liner** | CORTX — End-to-end reliability monitoring for x402 payment endpoints on Base. |
| **Live product link** | https://usecortx.dev |
| **Demo (Loom)** | [RECORD — see below] |
| **Contract address on Base** | [BASE USDC CONTRACT or test wallet address — see below] |
| **Track** | Agents / Agentic Commerce |
| **GTM plan** | See below |
| **Base Builder Code** | [DO YOU HAVE ONE?] |
| **Primary challenge** | User acquisition |
| **Credits** | AWS, Privy |

### Founding team answer

Solo founder. Building the reliability infrastructure layer for x402 on Base. Shipped CORTX from zero to live product — end-to-end synthetic payment monitoring, incident detection, Telegram alerts, public status pages, and an open x402 reliability spec (github.com/danbuildss/x402-reliability-spec). Live on mainnet with real USDC payments.

### GTM plan (next 3 months)

- **Month 1**: Public launch — open signups, onboard first 10 builders, push CORTX into x402 ecosystem (coinbase/x402 GitHub, Bankr skill live)
- **Month 2**: Registry awareness — outreach to x402 endpoint operators, publish reliability reports, first integration partner embedding CORTX badge
- **Month 3**: V2 (Verify) — endpoint ownership verification + trust labels; target 30 monitored endpoints, 10,000 checks run

### Key usage numbers answer (fill in your real numbers)

- All-time users onboarded: [X]
- Current DAU: [X]
- Current WAU: [X]
- All-time volume processed: Real USDC payments on Base mainnet — every check runs a synthetic x402 payment
- Last-30-day volume: [X checks × avg payment value]

### How does CORTX make money

Currently free during beta. Monetization via $CORTX token tiers — higher token holdings unlock more monitored endpoints, faster check intervals, and advanced alerting. Premium tier planned at launch.

### Contract address note

CORTX does not deploy its own contract — it interacts with USDC on Base via the x402 protocol (EIP-3009 payment signing). Use the Base USDC contract address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` or your test wallet address if they want a specific address tied to the project.

### Open items before submitting

- [ ] Record Loom demo (see below)
- [ ] Fill in full name
- [ ] Fill in Telegram @username
- [ ] Fill in real usage numbers (users, DAU, WAU, volume)
- [ ] Confirm Base Builder Code (did Base give you one?)

### Demo recording — use Loom

They explicitly ask for a Loom link. Go to loom.com, create a free account, hit "New Recording" → Screen + Camera. Record:
1. usecortx.dev landing page (30s)
2. Add a service → wizard → first check runs (60s)
3. Alert fires → Telegram notification (30s)
4. Public status page (15s)
Keep it under 3 minutes. Loom gives you a shareable link instantly.
