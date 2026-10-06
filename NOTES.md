# Cortx — Session Notes

> This file is the persistent memory for this project. Update it at the end of every session or when a key decision is made. Read it at the start of any new session to get back up to speed.

---

## Project Overview

CORTX is the reliability layer for x402. It runs a full synthetic payment through your endpoint (availability → payment terms → price check → payment → delivery → JSON parse → schema validation) every few minutes, records evidence at every stage, opens incidents on consecutive failures, and sends Telegram alerts. Most monitoring asks "is your server alive?" CORTX asks "did someone actually pay for your service and receive the expected result?" — a fundamentally different problem.

Stack: Next.js 16.3.0 (App Router), Supabase (Postgres + Auth + RLS), AJV (JSON Schema validation), Vercel (hosting), cron-job.org (scheduled checks), Telegram Bot API, x402/client npm package (EIP-3009 payment signing).

**Official domain: usecortx.dev**

## Permanent principle: DATA COMPOUNDS (Oct 5, 2026)

CORTX's historical observations are one of the most valuable things it owns. Preserve the lifecycle — **discovery → endpoint → check → payment terms → price → payment attempt → settlement → delivery → parsing/schema → evidence → incident → recovery → repeated behaviour → historical reliability** — and keep the underlying evidence and its changes over time, never just a current healthy/unhealthy state. **The open checker/spec can be copied; the accumulated real-world reliability history cannot.**

Rules: append, don't overwrite · never hard-delete evidence · every check reconstructable on its own (what, with which config, by which code, what the service said, what we concluded) · corrections are additive · record "couldn't check" · keep evidence, not secrets or payloads · back the data up off-platform. Full audit and proposed changes: `docs/DATA_COMPOUNDS.md`.

**Audit (Oct 5), headline findings (the cascade, config-overwrite and runner-version items are fixed by 026; backup still open — see below):**
- 🔥 Deleting a user account **cascades and deletes all their checks and incidents** (`user_id … on delete cascade`).
- 🔥 No off-platform backup.
- Editing a service **overwrites** URL / test input / schema / price limits and checks don't record what they ran with → old checks can't be reconstructed after an edit.
- No runner/code version on checks; V1 payment terms, request method, healthy response headers, authorization nonce and readiness "unavailable" observations are not kept; service status/readiness history overwritten; data repairs (020, 022) rewrote rows in place.
- `redact.ts` exists but isn't called (spec claims it is); all 402 response headers are stored unfiltered; as written it would also blank tx hashes.
- No privacy policy page.
- Proposed first batch (needs approval): S1 stop cascades, S2 off-platform backup, S3 config history trigger, S4 per-check context + runner version.
- **Approved Oct 5: "S1–S4, keep endpoint evidence".** Production FKs confirmed worse than assumed (services also cascaded from profiles; checks/incidents cascaded from services). Built: migration 026 (S1 FKs → set null / restrict + `detach_account_evidence()` on profile delete: soft-delete services, scrub typed input everywhere; S3 `service_config_history` + trigger + baseline; S4 `checks.config_version/context/runner_version/spec_version`), app writes context + runner version (falls back if 026 not run), `ops/backup/` template for S2 (founder sets up private repo + age key). Tested on Postgres 16 with the production FK shape (3 canary-column variants). DB 17 MB, checks 4,819 rows.
- **PR #123 merged + migration 026 run in production Oct 5 — verified:** `service_config_history` baseline = 6; FKs now services/checks/incidents `user_id` → SET NULL, checks/incidents `service_id` → RESTRICT. The cascade findings above are fixed. Still open: **S2 backup not set up yet** (founder follows `ops/backup/README.md`); S5–S9 + privacy policy page later.

## Company Roadmap (canonical — last updated Aug 2026)

```
V1    — Monitor           ✅  End-to-end x402 monitoring, incidents, alerts, evidence, public status
V1.1  — Monitoring        ⬅ NOW  Hardening milestone: spend safety, SSRF gaps, budget visibility,
        Integrity               rate limiting, production debug removal, paused-state UI
V1.5  — Reliability       ✅  Richer stage evidence: x402_protocol_version, payment_scheme,
        Data Foundation         atomic_units_detected, price_drift_usdc, verification_cost_usdc,
                                recipient_fingerprint. V2 header detection. No migration needed.
V2    — Verify +          ✅  Public submission modal (registry page), endpoint_submissions table,
        Reliability Network     admin review queue (approve → registry_seeds, reject with reason).
                                Migration 016 applied.
V3    — Intelligence            Reliability Explorer, CORTX Score (with confidence bands),
                                ecosystem intelligence — trends, price drift, schema drift
V4    — Preflight +             Preflight API, MCP tools (cortx_preflight / cortx_reliability /
        Select                  cortx_incidents / cortx_rank), Bankr integration, Cori layer
V5    — Protect           RES   Machine-commerce protection — delivery evidence powering refunds,
                                guarantees, or dispute resolution. DO NOT BUILD YET. Research first.
                                See "Machine Commerce Protection Direction" section below.
V6    — Trust /           OPT   ERC-8004 attestations — only if ecosystem adoption warrants it
        Attestations
V7    — Route             OPT   Only if CORTX's reliability intelligence creates demonstrable
                                selection advantage over existing routers
```

**Long-term arc: Monitor → Verify → Protect → Select → Route**
Each stage is only unlocked by proving the previous one. Do not skip ahead.

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

**Current position:** Public launch live (Aug 25, 2026). V1.5 + V2 shipped. Beta closed, open signups. Free reliability report live at /report. Next: V3 Intelligence — Reliability Explorer, CORTX Score.

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
- [x] Private beta ready — invite codes seeded, all infra confirmed working (historical)
- [x] Partnership Readiness Sprint — **COMPLETE** (Phase 1 + Partner Integration Sprint + audit)
- [x] Layered Verification Sprint — **COMPLETE** (PR #54 merged, migration 007 applied)
- [x] $CORTX token tiers + public registry — **COMPLETE** (PRs #57, #58 merged, migrations 008+009 applied)
- [x] Paid check every 4h + lightweight every 15min cron — **COMPLETE** (PR #61 merged, migration 011 applied ✓)
- [x] Public launch — **live Aug 25, 2026** — beta closed, open signups, price cap removed, feedback widget removed
- [x] Free reliability report — **`/report`** — no-auth one-time end-to-end check, emails results via Resend, migration 017 applied ✓
- [x] Bankr skill — **merged into BankrBot/skills main** (PR #642, Aug 24 2026) — CORTX now live in the Bankr skill catalog
- [x] Aeon skill — **merged into aeonfun/aeon main** (PR #954, Aug 27 2026) — CORTX now live in the Aeon skill catalog

**Public launch live.** Blog posts updated for launch. GitHub links updated to open source repo (x402-reliability-spec). Free reliability report live at /report. Bankr skill **merged** (BankrBot/skills #642 merged Aug 24, 2026). Registry seeding in progress.

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
| 2026-10-05 | **DATA COMPOUNDS** — preserve evidence and its history; append, never overwrite or hard-delete | The checker/spec is open and copyable; the accumulated real-world reliability history is the moat (`docs/DATA_COMPOUNDS.md`) |
| 2026-08-05 | Base **mainnet** only, real USDC | Test with real stakes — testnet doesn't reflect production reliability |
| 2026-08-05 | x402/client npm package for payment signing | Coinbase's reference client handles EIP-712 domain correctly |
| 2026-08-05 | cron-job.org instead of Vercel cron | Vercel Hobby plan only allows daily crons; cron-job.org gives per-minute scheduling free |
| 2026-08-05 | 2 consecutive failures to open incident | Reduces noise from transient failures |
| 2026-08-05 | `error` status never opens incidents | Infra errors shouldn't page you — only real payment failures matter |
| 2026-08-05 | Public status page at `/status/[userId]` | Makes CORTX feel like a real product; shareable without login |
| 2026-08-06 | 3-step onboarding wizard (detect → configure → run) | Reduces time-to-first-monitor to under 2 minutes |
| 2026-08-06 | Feedback button in app (not modal) | Bottom-right fixed button keeps it accessible without interrupting workflow |

## Roadmap — Next 3 Months (Aug 2026)

### Month 1 — September: Prove it (builder acquisition)

Product is live. Only job is getting builders using it and finding real failures.

**GTM (CEO focus, not product):**
- Onboard first 10 builders personally — DM every x402 builder you can find
- Use /report as the entry point — no friction, no account needed, real result
- Get Bankr skill PR #642 merged — distribution channel
- Post GitHub Discussion on coinbase/x402 to get spec visibility
- Record Loom demo + submit Base Builder Grant

**One product thing:**
- Data/incident blog post — "We ran X checks across Y x402 endpoints. Here's what we found." Write once you have 1,000+ checks and at least one real failure caught. Most credible content possible.

**Do not build:** anything until you have 5 active builders.

---

### Month 2 — October: Validate the network

**If builders are staying:**
- Endpoint ownership verification (V2 Verify) — token challenge flow. Aaron @aeon.fun explicitly asked for this.
- Email alerts — alongside Telegram. Non-crypto builders won't set up a bot.
- `@cortx/check` npm package — open source the check runner. npm distribution drives spec adoption.

**If builders are churning:** talk to them before building anything.

---

### Month 3 — November: Intelligence layer (V3)

Only start once Phase 1 metrics hit (10 builders, 30 endpoints, 10,000 checks, 10 real incidents detected).

- **CORTX Score** — reliability rating with confidence bands. Requires 30+ observations over 30+ days per endpoint.
- **Reliability Explorer** — ecosystem trends: which stages fail most, price drift, schema regression frequency.
- **Open Registry read API** — public read access to reliability scores once 50+ endpoints verified. Distribution moat.

---

### Cori (Sibyl Hackathon) — Sep 1–10

Parallel track, separate repo (`danbuildss/cori`). 10-day sprint. If it wins, AI incident-response becomes CORTX V4.

---

### What not to build in the next 3 months

- Dashboard redesigns or more chart types
- Discord notifications (do email, skip Discord)
- V4 Preflight API / MCP tools — too early
- ERC-8004 attestations — only if ecosystem adopts spec first

---

## Open Items

- ~~Add `RESEND_API_KEY` to Vercel env~~ ✅ Done (Aug 25, 2026)
- Post GitHub Discussion on coinbase/x402 Discussions (template ready)
- Merge PR #71 (methodology page → main)
- BankrBot/skills PR #642 — follow up on merge
- Loom demo for Base Builder Grant
- Fill in real usage numbers for grant application (users, DAU, WAU)
- Email alerts alongside Telegram? (not built)
- Custom domain for status pages?
- @cortx/check npm package — open source the check runner after launch data accumulates

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

## Open source audit (Sep 28, 2026)

Checked all public repos while paused before Phase D.
- **Secrets: clean.** Full history scanned (cortx 370 commits / 7 branches, spec 10, cori 2): no wallet keys, Supabase keys, cron secret, API keys or bot tokens; `.env.example` files are placeholders only.
- **`cortx` is public but has no LICENSE file** (README says "MIT") → legally all-rights-reserved until the file is added. Recommendation: add MIT (code isn't the moat; evidence network is).
- **`x402-reliability-spec` v0.2 is behind reality:** V1-only (a conforming checker would fail all Bankr V2 services); tells implementers to fall back to `x402.org` facilitator (CORTX no longer does; x402 keeps facilitators opaque); no "facilitator requires auth → unavailable"; no checker-side error concept; stage-5 `tx_hash` source unspecified (CORTX reads PAYMENT-RESPONSE, confirmed/failed/unconfirmed); $0 price = fail without known-good input note; test vectors still "planned for v0.3". Stale merged branch `spec/v0.2-payment-readiness`.
- **CORTX (the "reference implementation") doesn't emit spec-shaped records:** different stage names (`price_check`/`payment` vs `price_validity`/`payment_processing`, no separate `402_response`), no `spec_version`.
- **`danbuildss/cori` is a stale Aug 19 Python scaffold** (2 commits): README describes token price/whale alerts, and its design has `X402_PRIVATE_KEY` on the agent server — contradicts the locked no-key-on-server rule. Real Cori = `cortx/agent/cori`.
- **`@cortx/check` not on npm** (name free).
- **Approved Sep 28 ("I approve the open source work"), MIT by default. Built:**
  - OS-1: MIT `LICENSE` in cortx.
  - OS-2: `danbuildss/cori` PR #1 — README "moved to cortx/agent/cori" notice, `X402_PRIVATE_KEY` → `X402_PAY_TO_ADDRESS`. Founder archives the repo after merge.
  - OS-3: spec **v0.3** PR on `x402-reliability-spec`: x402 V1+V2 section, Checker-Side Errors (`outcome: checker_error`, `fault`), Test Input (`input_source`), stage-5 settlement receipt rules (`settlement_status`, receipt-only `tx_hash`), Error Codes, no x402.org facilitator fallback, stage 5 doesn't call a facilitator, readiness `unavailable` + new codes, BLOCKED_ADDRESS, conformance 7–10, **8 test vectors** + CI validation.
  - OS-4: cortx `lib/check-runner/spec-record.ts` (`toSpecRecord`), vendored vectors in `test/spec-vectors/`, `spec-conformance.test.ts` runs all 8 through the real runner — **CORTX passes all 8**. Public API `/api/v1/reliability/[id]` adds `evidence_spec_version` + `latest_paid_evidence` (checker-side error text redacted). Partner docs updated.
  - OS-5 (npm `@cortx/check`) later.
- **Sep 30:** founder merged cortx #118, spec #6, cori #1 and **archived `danbuildss/cori`**. README alignment pass: cortx README rewritten (it described August: "uptime monitoring", per-minute checks, `X-Payment-Required` only, 6 tables, stale roadmap) to match the positioning *"Reliability infrastructure for x402 — verify paid services actually deliver"*, V1+V2, check tiers, CORTX-side errors, public surfaces, open source, Cori, full env list; spec README links the CORTX conformance test + API. Cori (archived) README already points to cortx/agent/cori.
- **Security finding (Sep 30, not fixed yet):** the check runner's `fetchWithTimeout` (runner.ts) and readiness probe validate the endpoint's DNS once, then call `fetch` with default redirect following — a public endpoint could redirect CORTX to an internal address, and DNS could change between validation and connect. Cori's `lib/net/safe-fetch.ts` already does this right (connect-time pinning, manual re-validated redirects). Fix = use it (or `redirect: 'manual'` + re-validate) in the runner. Proposed to founder.
- **Fixed (approved Sep 30, added to PR #119):** new `lib/net/checked-fetch.ts` (safeFetch → standard `Response`) and `lib/check-runner/fetch-endpoint.ts` (StageError codes, 1 MB cap). Now used by the paid runner, readiness (service + facilitator, facilitator with 0 redirects), the **lightweight check (which had no address check at all)**, `/api/services/detect` and `/api/services/verify`. Tests: `checked-fetch.test.ts` (real HTTPS server: redirect to cloud metadata / internal refused, public redirect followed, http refused, body cap); runner tests use a plain-fetch stub via `test/hooks.mjs`. Discord alerts were already limited to discord.com webhook URLs.
- **Also fixed:** Cori's pipeline test failed from Sep 30 — `MemoryStore` stamped events with the real date while the test used a fake clock; it now takes the test's clock (`MemorySeed.now`). Production (Postgres `now()`) was unaffected.
- Original proposal: A) MIT LICENSE in cortx; B) cori README → "moved to cortx/agent/cori", drop the key var, founder archives the repo; C) spec v0.3 (V2, checker-side errors, facilitator auth = unavailable, no x402.org fallback, receipt rules, known-good input, first test vectors from our e2e fakes); D) CORTX exports spec-conformant evidence records with `spec_version`, validated against the spec schema; E) publish `@cortx/check` after C+D.

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
- **PR #86 (merged)**: Public launch prep — V2 public submissions, endpoint registry, blog CTA update, GitHub links → x402-reliability-spec, mobile audit pass.
- **PR #87 (merged)**: Blog CTA update (private beta → public), GitHub links to x402-reliability-spec, Open Source footer link.
- **PR #88 (merged)**: Free reliability report — /report page, POST /api/reliability-report, runner null-safe expected_price/schema/latency, migration 017 applied ✓, Resend email (add RESEND_API_KEY to Vercel env).

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

---

## Status snapshot (Oct 4, 2026)

**All merged:** cortx #108–#119, spec #6–#7, cori #1 (repo archived). Nothing open.

**Built since the Sep 28 reboot:** honest failures (CORTX-side `error`), x402 V2 payments + settlement receipts, readiness (blocked in practice: Bankr facilitator needs a bearer token), stage-name bug fixed + history repaired, admin numbers fixed, Cori Scout v0 (code done, **not running** — needs Phase D server), Cori admin page + watchdog, MIT licence, spec v0.3 + 8 test vectors, CORTX passes all 8, public API returns spec evidence, READMEs aligned, SSRF redirect fix (incl. lightweight check). ~100 tests.

**Live numbers (last seen Sep 28 /admin):** 4 signups, **0 outside builders with a service**; 6 services, all the founder's (5 Bankr + Exa test); ~2,900 checks; wallet $3.84; caps in Vercel $5/day, $50/month.

**Open risks:** (1) `/report` pays up to $0.10 to any URL, limited only per email/IP — with $5/day caps someone rotating emails/IPs can drain ~$5/day to their own endpoint (audit #5, still open). (2) Cron is serial within a 60 s limit (audit #6) — fine for 6 services, not for dozens. (3) Readiness can't run for Bankr services without a verify-only key.

**Oct 4 — approved "1, 4" (founder SQL: only one /report ever, Aug 24, stopped at payment_terms → no money ever left through /report):**
- **#1 /report hardening (migration 025):** free stages always run; paid part only for services ≤ $0.01 (`REPORT_MAX_PRICE_USDC`) within a $0.25/day report budget (`REPORT_DAILY_BUDGET_USDC`), reserved by `reserve_report_spend()` under the same advisory lock as `reserve_spend()`; report spend stored in `reliability_report_requests.paid_usdc` and **added to `get_spend_totals()`** (so caps, cron pause/unpause and admin spend cards count it). Released if no payment was sent. Runner gained an optional `payment_gate` (types.ts) — monitoring checks unchanged. A price above the report limit is no longer reported as a service failure. Email HTML now escapes the URL and error text (was an HTML-injection vector from reports@usecortx.dev). Report URL must be public https. Fail closed: if the RPC is missing (025 not run), the paid part simply doesn't run. Migration tested on Postgres 16 (budget, platform caps, monitoring sees report spend, release, day rollover, anon can't execute).
- **#4 parallel cron:** `lib/cron/pool.ts` (tested) — lightweight 5 / readiness 3 / paid 3 at once; stop starting new checks at 15 s / 25 s / 30 s; unstarted services stay due, most overdue first next tick. Response adds `deferred` counts + `duration_ms`. No SQL.
- 110 tests.
- **PR #120 merged + migration 025 run (Oct 4).** `get_spend_totals()` after: today $0.005, October $0.02 — matches 5 Bankr paid checks/day × $0.001 since Oct 1. Report spend now inside the caps.

**Blog (Oct 5–6):** "What 4,500+ x402 checks taught us about measuring reliability" (PR #121, publish Oct 6) — founder edits applied (title/subtitle, opening, principle-based ending, quiet CTAs). Kept the stage-name bug. x402 V1/V2 wording verified against official specs. Numbers from admin Oct 5: 4,663 checks, 351 paid checks ($0.351 USDC). **No success-rate % published** (24h 90.9% includes the founder's always-failing Exa test and only founder services). Aug 29 post got a dated correction note. Cori gets its own post after its first live week.

**Left to build (proposed order):** /report hardening → Phase D (Cori server, with founder) → Phase E (watch a week, review Cori's queue) → cron scaling → `@cortx/check` npm → later Cori phases (Observer/Memory, Verifier queue via DB → Vercel, Investigator, public Reliability Index / weekly report, preflight API/MCP). Biggest non-code gap: outside builders (Phase 1 target 10).

## Cori — LOCKED DIRECTION (Sep 28, 2026)

**Cori is the autonomous reliability agent for CORTX.** Not a bigger x402 scanner or another trust score (ScoutScore owns breadth). Differentiation = depth of evidence and incident investigation. The question CORTX answers: *"What exactly happened to this machine payment/service interaction, and can we prove it?"*

- Loop (eventual): discover → observe → detect anomaly → reproduce → trace failing stage → payment/settlement/delivery evidence → incident → notify provider → watch recovery → paid recovery verification → close → preserve history.
- Evidence states kept separate: **Observed → Reproduced → Confirmed → Resolved.** Nothing about a third-party service becomes a public failure automatically; human confirmation stays in the loop.
- Infra: Cori gets its **own Hetzner VPS in a separate CORTX project from Phase 1**. VPS = discovery, free probes, baselines, anomaly detection, investigation orchestration. **No wallet key on the VPS**; paid checks go DB queue → existing Vercel payment path. Spending is deterministic (price cap, global daily/monthly budget, per-service limits, cooldowns, known-good input). **No AI controls spending.**
- Content style: specific, reproducible incident evidence + recovery — not dramatic ecosystem-wide percentages.
- Thesis: **the checker can be open; the network and accumulated evidence are the moat.**
- **Now building: Scout v0 only**: spec at `docs/CORI_SCOUT_V0_SPEC.md`, **approved with defaults Sep 28** ($0.05 eligible cap, 25/day queue cap, CDP Bazaar only, `cori_agent` least-privilege DB role, GitHub repo as UA contact). Discovery only, zero USDC, no public claims, no LLM, candidates into the existing admin review queue.
- **Phase A built (PR open):** migration 023 (tables + `cori_agent` role + RLS), shared allow-list IP rules, SSRF-safe fetch with connect-time DNS pinning, URL normalization, classification, Bazaar listing parser; 61 tests. Bazaar confirmed public (no API key), ~16k resources → listing-first classification, only probe what passes on paper. **Founder action after merge:** run migration 023, then set the role password (`alter role cori_agent with login password '…'`, kept in a password manager — it goes on the VPS in Phase D).
- **Production finding (Sep 28): public endpoint submissions were broken.** Live `endpoint_submissions` was created from an older draft of migration 016: no `description`/`x_handle`/`website_url`/`category`/`seed_id`, plus an extra `service_id`. So the public "Submit endpoint" form failed ("Failed to submit"), the admin pending list failed silently ("No pending submissions"), and approve failed on `seed_id`. Migration 024 adds the missing columns (tested on the production shape). Also migration 023's column grants now adapt to the columns that exist. Lesson: production schema has drifted from the repo in several places (incidents.resolution_type constraint, endpoint_submissions) — Phase B/C code is built against the live schema from `information_schema`, not the migration files.
- **Phase B built (PR open):** `agent/cori/` process (Bazaar client, pipeline, free probe, queue, limiter, Postgres + memory stores, advisory lock, dry-run/`--once`, heartbeat). 69 tests incl. full pipeline vs fake Bazaar/services (asserts no payment header ever sent) and real Postgres as `cori_agent`. Bundle smoke-tested (dry run, lock, SIGTERM). Rejected candidates are not auto re-queued in v0.
- **Phase C built (PR open):** admin **Cori panel** (heartbeat green/amber/red, live vs dry run, last Bazaar scan, counts by class, recent errors, recent activity; "not started yet" before Phase D); **Cori candidates in Pending Submissions** (badge, price/network/version/method, plain-English "why eligible", needs-input flag, first seen + source, "Observed (not verified)"); **approve/reject write back** to Cori (approve → `linked_seed_id` + `already_listed` + `approved` event; reject → `rejected` event with reason); **Telegram watchdog** in the CORTX cron (alert when Cori is silent 30+ min, repeat at most every 6 h, "back" message on recovery, silent until Cori's first run; state in `system_settings.cori_watchdog`). No SQL. 77 tests.
- **Phase C revised (same PR #117, approved Sep 28 after the founder sent the full /admin on their phone):** Cori moved to its **own sidebar item + page `/admin/cori`** (health dot + waiting count in the menu; status, "Waiting for you" review cards with Approve/Reject, what Cori knows, activity, errors). `/admin` keeps one slim Cori line; its Pending Submissions shows only people's submissions + a "N found by Cori →" line. **Admin page fixes in the same PR** (`lib/admin/stats.ts`, tested):
  - "USDC Verified" showed $0.00 and 90d/1y/all spend "—": the sums read at most 1,000 rows and only `passed` checks, and rounded to 2 decimals. Now: every check whose payment went through (same rule as the caps, `stages @> [{stage:payment,passed:true}]`, paged), 4 decimals under $1.
  - Today's / monthly spend cards now come from `get_spend_totals()` (exactly what the caps enforce, incl. reservations), UTC.
  - Success rate and Avg uptime exclude CORTX-side `error` checks (our wallet/facilitator-auth problems); Platform Stats shows them in a "CORTX-side" column. Screenshot numbers: 75.4% → ~91.5%.
  - Stage Failures split into "Service failures" and "CORTX-side". The 10 `facilitator_verify` of Sep 28 were readiness errors between PR #111 (10:22) and #112 (11:19); they age out after 24 h.
  - Open Incidents fetches all open incidents (was: only among the latest 20). Submission counts use head counts (Cori will pass 1,000 rows).
  - Recent Activity URLs wrap on phones.
  - Note: postgrest-js `.contains(col, [obj])` builds a Postgres array literal (`{[object Object]}`) — pass JSON text for jsonb.
- **Spend caps in production are $5/day and $50/month** (Vercel env `CORTX_DAILY_SPEND_CAP_USDC=5`, `CORTX_MONTHLY_SPEND_CAP_USDC=50`; code defaults are $1/$10). Founder did not set them this session. Recommended lowering to 1 / 10 in Vercel; wallet balance ($3.84) is the real ceiling today.
- **Exa "Contents" test service** (`api.exa.ai/contents`, open incident since ~Aug 24): founder's own test endpoint that never worked; **left as is on purpose**. Its failures (ZERO_PRICE at `price_check`) are real and stay in the stats.
- **Status Sep 28 (end of session): Phases A, B, C all merged (#114–#117). Paused by founder until they're home.** Resume with: founder checks /admin (USDC Verified real number, 24h uptime ~91%), optionally lowers Vercel caps to 1/10 and redeploys, then says "approve D".
- Next: Phase D (VPS go-live together: Hetzner CORTX project + server, `cori_agent` password, first **dry run** to confirm live Bazaar fields, then live), then E (observe a week).
- **Oct 5 — canonical Cori brief received from the founder → saved verbatim-in-substance as `docs/CORI_BRIEF.md` (source of truth for Cori: hierarchy CORTX ⊃ Cori, thesis, evidence states, no AI over money, VPS without key, Scout→Observer→Investigator→…→Resolution progression, Scout V0 scope, non-goals).** Founder rule: no Cori code until the Scout V0 spec is re-reviewed against the repo. I re-audited the built Scout against the brief + DATA COMPOUNDS → **spec v2** (`docs/CORI_SCOUT_V0_SPEC.md`, answers A–H, sections 1–30). Gaps G1–G11 → proposed **Phase B2 before go-live**: append-only `discovery_observations` (every probe) + `discovery_listings` (listing versions), no cascades on Cori tables, Bazaar `routeTemplate` identity + `unsupported_method`, POST probes send `{}` (never third-party example bodies), port 443 only, paginate to `total`, `disappeared` sweep, `cori_version` stamp, env-key refusal + "no payment code in bundle" test, global probe budget 600/h, firewall must allow Supabase 5432/6543. Corrected v1 claim: Bazaar does **not** list "only after a successful payment" (x402 spec: cataloged when a facilitator receives a payment payload) — a listing is a lead, never evidence. Decisions asked: B2 before go-live, store raw pay-to, no third-party POST bodies, port 443 only. Supabase free 500 MB is the cost to watch (observations ~150 MB/yr at 2k probes/day — measure in Phase E).
- **Oct 5 — founder: "approve spec v2, all 4 recommendations"** (B2 before go-live, store raw pay-to, never forward third-party POST bodies, port 443 only). **Phase B2 built** (PR open): migration `027_cori_memory.sql` (observations + listing versions, restrict FKs, `unsupported_method`, `pay_to`/`route_template`/`resource_url`/`source_last_updated`/`disappeared_at`, `cori_runs.cori_version`; history append-only for `cori_agent`), parser/classifier/probe/pipeline changes, disappearance sweep (only when every source had a complete pass in 24 h), global probe budget 600/h, key-refusal at startup, version-stamped bundle (`agent/cori/build.mjs`) + test that the bundle has no payment/signing code. Suite 137 tests (136 pass, 1 DB-gated skip); real-Postgres test as `cori_agent` passes with 027 (run twice). **Founder after merge: run 027 in the SQL editor, then Phase D.** Run 027 before deploying the B2 code.
- **Oct 5 — PR #124 merged.** First run of 027 in the SQL editor applied nothing: the check showed 0 tables, still CASCADE, 0 columns. The editor runs a script all-or-nothing, so most likely the "destructive operation" confirmation (the script has `drop constraint`) wasn't accepted, or an error rolled the whole script back. **Lesson: give long migrations as numbered blocks, and ask for the check row, not just "success".** The founder re-ran 027 as 5 blocks and reported "success"; the check row values were requested to confirm.
- **Oct 5 — Phase D scripts built** (`ops/cori/`): `setup.sh`, `deploy.sh`, `cori.service`, `cori-dryrun.service`, `cori.env.example`, `README.md` (founder's guide), and `npm run test:cori`.
  - setup.sh:
    - admin user `cortx` with the root SSH key
    - sshd drop-in `01-cori.conf` (named to load before cloud-init's 50-)
    - ufw outbound deny-by-default; DHCP allowed first because Hetzner's gateway 172.31.1.1 is in the denied 172.16/12; private ranges incl. 169.254.169.254 denied
    - Postgres 5432/6543 not IP-pinned (Supabase IPs change)
    - Node 22 from nodejs.org, SHA-256 verified
  - Dry-run unit forces `CORI_DRY_RUN=1` on the command line, because an EnvironmentFile overrides `Environment=`.
  - Deploy rehearsed in a fresh clone: `npm ci --ignore-scripts` (~1 min, node_modules 1.3 GB), `test:cori` 74 tests (73 pass, 1 DB-gated skip), build OK.
- **Oct 5 — PR #125 merged. Server choice (founder):** same as Luca: **Hetzner CX23** (Cost-Optimized x86, 2 vCPU / 4 GB), Ubuntu 24.04, Falkenstein, about $7.09/month incl. IPv4. Name **`cori`** (founder chose the short name), in a **separate Hetzner project "CORTX"** (not inside Luca's project). Falkenstein is right only if Supabase is in the EU; asked the founder for the Supabase region. The 027 check row was still not pasted (only "success"). **Decision (founder, Oct 5): Cori's server goes in the existing Hetzner "Default" project next to Luca** (`ubuntu-4gb-fsn1-3`, CX23, Falkenstein). A new "CORTX" project wouldn't offer the $6 CX23, only bigger types. Trade-off accepted: the Default project's access (console, rescue, API tokens) covers both servers. Mitigations: never touch the Luca server; treat any Default-project API token as controlling both; moving Cori to its own project later is optional. Cori still holds no wallet key or service-role key. **Oct 5 (later): server creation paused.** Cost-Optimized (CX23, and Arm) showed "Limited availability" (greyed out) in Falkenstein, and also in Nuremberg and Helsinki. The founder will check again later. Fallback: the smallest Regular Performance (AMD) type with ≥ 2 GB RAM (Cori needs < 512 MB; costs a few $ more). Resume Phase D at `ops/cori/README.md` step 2 once a server exists. Still owed by the founder: the 027 check row (2 / RESTRICT / 5) and the Supabase region. **Oct 6: server created**: Hetzner **CX23 "cori"** (#169102623) in the Default project, IPv4 **46.225.34.40**, IPv6 **2a01:4f8:c2c:11c8::/64**, $6.49/mo. Dedicated SSH key `~/.ssh/cori` on the founder's Mac (Luca keeps its own key). Mac shortcut: `ssh cori`. Ubuntu 24.04.4 (updated to 24.04.5 by setup). **setup.sh done Oct 6.** The first run stopped at `sshd -t` ("Missing privilege separation directory: /run/sshd", because 24.04 socket-activates sshd); re-run after `mkdir -p /run/sshd` worked, and setup.sh is fixed on the branch. `cortx` login + sudo OK; root SSH off; Mac shortcut `ssh cori` uses User cortx. Rebooted for the kernel update: SSH was "Connection refused" for ~3 min during boot, then fine; ufw active after the reboot. **027 verified in production Oct 6** (new_tables 2, both history FKs ON DELETE RESTRICT, new_columns 5). Next: `cori_agent` password (**the first generated password was pasted into chat on Oct 6, so it's treated as exposed and must never be used; the founder generates a new one**); new password set in Supabase Oct 6. Supabase project ref: `htivwyovukmtmmsxwfql` (public); direct DB host `db.htivwyovukmtmmsxwfql.supabase.co:5432` → env file → deploy.sh → dry run. **Founder is not a developer: one small step at a time, say which window/prompt to type in (Mac `%` vs server `$`), no jargon.**

## Proposal: Autonomous Reliability Network / "Cori" agent (Sep 28, 2026) — superseded by LOCKED DIRECTION above

Idea (inspired by Aeon's proof-of-work engine): CORTX stops waiting for builders to submit endpoints and independently watches the x402 ecosystem. Loop: DISCOVER → OBSERVE → VERIFY → INVESTIGATE → REMEMBER → WARN. Components (internal, one process): Scout (discovery), Observer (free probes + baselines), Verifier (paid checks under policy), Investigator (anomaly → reproduce → incident → recovery proof), Memory (longitudinal history). Surfaces: builders (monitoring), humans (public CORTX Reliability Index + weekly findings), agents (preflight API/MCP). Principle: **the checker is open, the network (observation history) is the moat.** Proposed to run as a long-lived agent ("Cori") on a separate Hetzner VPS in its own project.

**Assessment (Claude, Sep 28):** direction is right and fits "Open Tools, Paid Network", but five corrections from this week's facts:
1. **/verify experiment is finished and readiness is blocked in practice** — Bankr's facilitator now requires a bearer token; the x402 spec keeps facilitators opaque. The Observer can't rely on "payment readiness: verified". Observer = free 402 probes + change detection; truth comes from periodic cheap paid checks.
2. **The breadth version already exists.** ScoutScore: 2,079 domains, 20,662 endpoints, 198 paid-verified, MCP + SDK. Don't race for the biggest index number. Differentiate on depth: investigated incidents with stage-level + settlement evidence, longitudinal memory, recovery proof, builder loop.
3. **Wallet key stays on Vercel** (founder rule: never expose the key). VPS agent does only free work and writes paid-check *requests* to a DB queue; Vercel cron executes them under a deterministic policy. No key on the VPS.
4. **False-positive risk when publishing about third parties.** This week CORTX was wrong three ways (stage-name bug, wallet false incidents, Exa $0 from empty input). Discovered endpoints lack known-good inputs. Rule: no public failure claim about a third party until reproduced + human-confirmed (initially) + provider notified. Keep Observed vs Verified separate.
5. **Deterministic core.** V0 needs no LLM; policy rules control money. LLM later for incident write-ups / weekly report (fits Cori's original memory/incident-response design).

Phased build on existing primitives: (1) Scout v0 — Bazaar `/discovery/resources` + other lists, free probe via `x402.ts`, dedupe, into the existing admin review queue (`endpoint_submissions` / `registry_seeds`); runs on Vercel, no spending, no VPS. (2) Observer + Memory — baselines + change events; this is where the VPS starts paying off. (3) Policy + Verifier queue. (4) Investigator. (5) Public Reliability Index + weekly report, then preflight API/MCP. Economics: ~50 services × 1 paid/day × $0.002 ≈ $3/month; ~150 × $0.005 ≈ $22/month + triggers — caps (today $1/day, $10/month) must be raised deliberately.

## Sep 2026 Reboot — Days 1–3 plan (approved Sep 28)

Days 4–5 (/report hardening, paid preflight endpoint) and the "talk to builders vs build" decision are deferred until the founder is back with /admin numbers.

| Day | Scope | Status |
|---|---|---|
| 1 | Wallet/budget failures → `error` (never blame builders); spend-cap pause only lifts after cap resets; timing-safe cron secret; migration 020 cleanup of false incidents | ✅ Built — PR open, **run migration 020 after merge** |
| 2 | x402 V2 payments (`amount` field, V2 payment header, read official docs first); record real on-chain settlement from the receipt header | ✅ Built — PR open, no migration. After merge: click Run check on a V2 service (e.g. Exa) to confirm end to end |
| 3 | Wire zero-cost readiness (/verify) into cron: readiness every 15 min, paid check daily + on anomaly; readiness failures count toward incidents; "Payment readiness" card on service page; one migration | ✅ Built — PR open. **Run migration 021 BEFORE merging** (the service page and cron read the new columns) |

### Day 3 follow-up — stage-name bug + readiness auth (Sep 28)

**Live results after Day 3 merged (cron test run, 09:33 UTC):** cron healthy (200, 29s). 5 Bankr paid checks passed with real V2 payments (`PAYMENT-SIGNATURE`, $0.001 each). Contents (Exa) failed `ZERO_PRICE` — Exa quotes `"0"` for the empty test input; **founder action: set Contents test input to a real request, e.g. `{"urls": ["https://example.com"]}`**.

**Bankr's facilitator now requires auth.** `POST https://api.bankr.bot/facilitator/verify` → `401 {"error":"missing bearer token"}` (it answered without auth in the Aug Track 2 experiment). So readiness can't run for any current service. Fix: facilitator 401/403 → readiness `unavailable` ("Payment facilitator requires authentication"), no check row, re-checked daily. Options for later: ask Bankr for a verify-only API key; or verify against a facilitator CORTX has its own key for (e.g. CDP) — proves terms are payable, not that the service's own facilitator is up.

**Stage-name bug (live since PR #56, Aug 15).** The paid runner called `advance()` 8 times for 7 stage names (price parse + price compare each advanced), so every stage from the price step on was saved under the previous stage's name, and schema validation had no name. Impact: public "paid delivery %" actually measured price-OK + payment-signed; "schema validity %" measured JSON parsing; wrong `failure_stage` on checks/incidents/alerts; migration 020 found 0 because wallet failures were saved as `delivery`; spend-cap pause never triggered (budget cap itself still worked).
- Fix: parse + compare are one `price_check` stage; `advance()` now throws if called too often.
- Regression test: `lib/check-runner/runner.e2e.test.ts` runs the real `runFullCheck` against a local fake x402 service (V1 + V2, pass, no receipt, paid-not-delivered, schema fail, bad JSON, price over max) and asserts exact stage names + settlement. Confirmed it fails (7/7) against the old runner. Test-only hooks in `test/` stub SSRF (localhost) and the wallet balance read; `npm test` = 30 tests.
- Migration 022 repairs history: rebuilds shifted stages (verified on Postgres against real old-runner output — 10/10 scenarios match the fixed runner), fixes `failure_stage` on checks + incidents, re-runs the 020 wallet cleanup. Run AFTER merging. Historical public paid-delivery % may drop — the repaired numbers are the true ones.

**Production repair results (Sep 28, migration 022 + false_positive constraint fix):** 389 paid checks re-labelled with correct stage names; 8 wallet failures reclassified as CORTX-side errors (the ones 020 missed); 1 false incident closed (Aug 28, Bankr service, logged as "delivery failed" — was the CORTX wallet). Production had an undocumented `incidents_resolution_type_check` constraint rejecting `false_positive` — widened in step 0 of 020/022 (PR #113).

**Days 1–3 status: COMPLETE.** Open founder items: set Contents (Exa) test input to a real request; run a check on it to confirm V2 payment + settlement card against a non-Bankr service; share /admin numbers to decide Days 4–5 vs outreach.

### Day 3 details (what shipped)

- `lib/check-runner/readiness.ts` rewritten for production on the shared x402 code (V1 + V2). Probe 402 → parse terms → find facilitator → price ≤ max → sign EIP-3009 → facilitator `/verify` (never `/settle`).
- **Only works for services that publish their facilitator** (the x402 spec keeps it opaque — confirmed in the V2 spec, no discovery field). Others → `unavailable`, no check row, re-probed daily, stay on the 4h paid schedule.
- Status mapping: `ready` → check passed; `not_ready` (service-side: 402 broken, price over max, facilitator down/5xx, rejection reasons `invalid_network`, `invalid_scheme`, `unsupported_scheme`, `invalid_payment_requirements`, `recipient_mismatch`) → check failed; `error` (CORTX-side: `insufficient_funds`, signature/amount/timing rejections, unknown reasons, 4xx without verdict, blocked facilitator URL, missing wallet key) → check error, never blames the builder.
- Facilitator URL is SSRF-checked like endpoints; redirects refused.
- Schedule: readiness every 15 min. Paid checks move to daily only after a passing paid check on a readiness-`ready` service; a failing paid check keeps the 4h interval so incidents still open within hours (`lib/check-runner/schedule.ts`).
- Incidents: readiness has its own failure counter (`readiness_consecutive_failures`) — 2 in a row opens an incident. Tiers: lightweight 0, readiness 1, canary 2, full 3; a pass resolves incidents of its tier or lower. Readiness failure never downgrades a worse paid status; readiness pass only restores "operational" when paid checks agree and no higher-tier incident is open.
- Readiness rows store `observed_price: null` so they never count as spend.
- Service page: "Payment readiness" card (Ready / Not ready + reason / Couldn't check / Not available). Paid card shows the effective interval.
- Verified: 23 unit tests; end-to-end against a local fake service + fake facilitator that verifies signatures (V1 body, V2 header, rejections, CORTX-side errors, facilitator down, no facilitator, price over max, no 402) — all 9 scenarios as designed; migration 021 tested on Postgres 16 (re-runnable, constraints enforced).
- Not built (deferred): parallel cron, readiness-triggered paid checks, /report changes.

### Day 2 details (what shipped)

- `lib/check-runner/x402.ts` — shared parser: 402 body (V1), base64 `PAYMENT-REQUIRED` (V2), `X-PAYMENT-REQUIRED` (Bankr flat). Reads V2 `amount` (always atomic) and CAIP-2 networks. Found while building: V2 header-only services were already failing at `payment_terms` because the base64 header was parsed as plain JSON.
- V2 payments: same EIP-3009 authorization wrapped in the V2 PaymentPayload, sent as `PAYMENT-SIGNATURE`. Built by hand from the official spec (no new dependency). Verified with a throwaway key that the signature recovers to the signer. V1 services unchanged (`X-PAYMENT` via x402 v1 client).
- Settlement proof: delivery stage stores `settlement` (confirmed/failed/unconfirmed, tx hash, Basescan link) on every outcome — makes "paid but not delivered" provable. Payment stage now says `signed: true`, not `confirmed: true`.
- Decision (founder, Sep 28): show the settlement tx hash with a "View on Basescan" link on the service page. Reveals the CORTX wallet address, never the key.
- `UNSUPPORTED_PAYMENT_METHOD` (e.g. Permit2) is CORTX-side → `error`, not a builder failure.
- `readiness.ts` still has its own parser — switch it to `x402.ts` on Day 3.
- Tests: 17 passing (`npm test`).

### Day 1 details (what shipped)

- `lib/check-runner/classify.ts` — `isCortxSidePaymentFailure()`: WALLET_NOT_CONFIGURED, INSUFFICIENT_BALANCE, BALANCE_READ_FAILED, SPEND_RESERVATION_FAILED, DAILY/MONTHLY_SPEND_CAP_EXCEEDED, PAYMENT_TIMEOUT → check status `error`. Service-side codes stay `failed`: NO_USDC_OPTION, PAYMENT_SIGNING_FAILED (replaces the old catch-all WALLET_ERROR).
- `app/api/cron/route.ts` — unpause only when `get_spend_totals()` shows room under the cap (falls back to old behaviour if the RPC is missing); pause alert to builders now says it's CORTX's budget, not their service; timing-safe CRON_SECRET check.
- Migration 020 — `get_spend_totals()`; `reserve_spend()` now counts every check whose payment went through (previously only fully passed checks, so payments that failed at delivery were missed); reclassifies past false failures, closes/relabels their incidents as `false_positive`, recomputes affected service status. Also revokes anon/authenticated EXECUTE on `reserve_spend`, `get_spend_totals`, `check_and_record_rate_limit` (Supabase exposed them over REST — anyone could burn the budget).
- Public service status page hides `false_positive` incidents.
- First automated tests: `npm test` (Node built-in runner, no new deps).

**Founder action items:** merge PR → run `supabase/migrations/020_cortx_side_failures.sql` in Supabase (preview SELECTs at the top of the file) → top up the CORTX wallet with $5–10 USDC on Base (send to the address; key stays in Vercel).

---

## Product Audit + Market Check (Sep 28, 2026)

Context: ~1 month away from CORTX. Deployment was down, now back. Test wallet is empty. Audit done from code (live site + DB not reachable from the Claude container, so real usage numbers still need pulling from /admin).

### Critical findings (code)

1. **Empty wallet blames builders (P0).** `INSUFFICIENT_BALANCE`, missing key, and spend-cap hits all fail the `payment` stage → check `failed` → service `critical` → incident + Telegram/Discord alert after 2 checks. Public status pages, badges and the reliability API then show the builder's service as broken when the fault is CORTX's wallet. Fix: classify CORTX-side payment failures as `error`, not `failed`. Clean up past checks/incidents caused by it.
2. **Spend-cap pause does nothing.** `app/api/cron/route.ts` clears `monitoring_paused_reason` for every capped service on every tick without checking whether the cap reset (`todayStart`/`monthStart` computed but unused).
3. **No x402 V2 payments.** Runner parses V2 402 responses but pays with the V1 client (`x402` v1, `X-Payment` header, `maxAmountRequired` only). V2-only services (`PAYMENT-SIGNATURE` header, `amount` field — e.g. Exa) will fail and look broken.
4. **"Payment confirmed" isn't verified.** Payment stage records `confirmed: true` after signing only; settlement response header is never read. Evidence claims more than it proves.
5. **/report can drain the budget.** Free report pays up to $0.10 to any URL. Rotating IPs/emails can send CORTX money to an attacker endpoint until the global cap is hit, which then starves (and via #1, falsely fails) every monitored service.
6. **Cron is serial with a 60s limit** — will not scale past a handful of paid checks per tick.
7. **Readiness (/verify, zero-settlement) is built but not wired** — only the admin experiment route uses it. Track 2 result was GO.
8. **No automated tests** for the check runner.

### Market (Sep 2026) — the category is now crowded

- **ScoutScore** (scoutscore.ai) — closest competitor. 2,079 domains scored, 198 paid-verified with real USDC, V1+V2 headers, MCP + npm SDK + ElizaOS plugin, ERC-8004 registered. Their data: of 169 services accepting payment, **only 36% delivered a working response**. Validates CORTX's thesis hard.
- **x402-trust.com / x402-trust-mcp** — probes, 402 compliance, price history, on-chain settlement volume. No real paid calls. Paid MCP tools via x402.
- **402audit** — proxy/resale detection + markup, leaderboard, MCP yes/no.
- **PayCrow, x402r** — escrow/refund around x402 payments (the Protect layer is being built by others).
- **ERC-8183 (Agentic Commerce)** — job escrow with an *evaluator* who attests delivery. Natural home for CORTX's verdicts.

### Strategic takeaway

Don't race ScoutScore on breadth with an empty wallet. CORTX's defensible ground:
- **Depth:** owner-verified endpoints with an owner-defined delivery contract (schema), verified continuously.
- **Live evidence over synthetic:** a client SDK that wraps an agent's x402 calls (preflight before, delivery check after, report outcome) turns every real agent call into reliability data without CORTX spending.
- **Self-funding:** an x402-paid preflight endpoint makes checks pay for themselves.
- **Evaluator role:** CORTX as the neutral delivery verifier (ERC-8183 evaluator) is the path to "agents only pay for delivered results".

---

## Market Signal — Bankr: Pre-flight Validation (Aug 29, 2026)

After CORTX posted about the Bankr reliability skill ("check any endpoint with one click"), Bankr publicly replied:

> "pre-flight validation before micropayment execution is essential for autonomous agent workflows. cuts down on failed calls, saves fees, and builds verifiable reliability across x402 routes."

**Why this matters:** Bankr independently described CORTX using language very close to Payment Readiness — without prompting. This is external validation of the problem direction, not proof of PMF.

**Key language Bankr used:**
- pre-flight validation before payment execution
- reducing failed calls
- saving fees
- building verifiable reliability across x402 routes

**Positioning note:** "Pre-flight validation" is useful language for the agent-facing layer. Do NOT replace current positioning yet:
> *Reliability infrastructure for x402 — verify paid services actually deliver.*

Preserve "pre-flight validation" as a potential product/category concept as Payment Readiness develops.

**Emerging product progression:**

```
MONITOR    → Is the x402 service operational?
VERIFY     → Has CORTX independently confirmed successful paid delivery?
PREFLIGHT  → Should an agent trust this service/payment path before spending right now?
PROTECT    → What happens when an agent pays but valid delivery does not occur? (DO NOT BUILD YET)
```

**Possible future agent interaction:**
> Agent wants to call x402 service → CORTX preflight → reliability/history + current payment readiness → SAFE / CAUTION / AVOID → agent decides whether to spend

**This does NOT change the roadmap.** Current priorities remain:
1. Validate triggered paid checks
2. Run the /verify experiment
3. Upgrade Payment Readiness only if experiment succeeds
4. Get more builders/endpoints monitored
5. Accumulate real incident and reliability history

This strengthens the reason for the current /verify experiment — the same infrastructure could eventually support agent-facing pre-flight validation.

---

## Hackathon Insight — "Memory is Load-Bearing" (Aug 29, 2026)

**Context:** Sibyl Labs hackathon with theme "build agents where memory is load-bearing." SingIt Agent entered, building an agent that remembers budget approvals and trusted/rejected merchants — so it stops asking about what you already allowed.

**Why this matters for CORTX:**

This is the same thesis as CORTX, one layer deeper. SingIt solves the *approval memory* layer — the agent remembers what the user said yes/no to. CORTX solves the layer underneath: *are the services those agents are spending on actually working?*

Approval memory is useless if the endpoint is broken and the agent pays into a silent failure. CORTX's reliability data is the trust infrastructure the whole category needs.

**The Cori framing this unlocks:**

> "Cori remembers which x402 services are safe to spend on. CORTX verifies they actually work. Wipe the memory and the agent either stops transacting or starts trusting broken endpoints. That's load-bearing."

Cori's memory isn't just "you approved this merchant once" — it's "this endpoint passed 47 consecutive end-to-end checks." That's a stronger, verifiable form of the same idea.

**Takeaway:** The agentic payments category is converging on this problem. CORTX is building the right layer at the right time.

---

## x402 Ecosystem — Key Clarification (Aug 29, 2026)

**From DukeOphir (@DukeOphir) — x402 team — replying to our blog post:**

> "The x402.org facilitator is a dev tool for local testing, it is NOT intended for production and does not support any mainnet. For production, servers can opt-in to use 3rd party services, see eg docs.x402.org/dev-tools/faci... or self-facilitate. This choice remains opaque to clients, they can't influence nor need to know it."

**Implications for CORTX and spec:**

- x402.org is intentionally dev/local only — not a production fallback
- This makes the three-level facilitator discovery pattern we documented even more critical: any client defaulting to x402.org in production will silently fail for every real service
- The spec language should eventually clarify that x402.org is a dev tool, not a default — currently the spec doesn't state this explicitly
- "This choice remains opaque to clients" — confirms the facilitator URL is the authoritative source; clients must read the 402 response, not assume a universal endpoint

**Action:** Note for future spec update (Track 3 or later). Do not update the blog post — it's already published and the finding stands.

**Follow-up from DukeOphir — second reply (Aug 29, 2026):**

> "Services listed on the CDP bazaar are only indexed after a successful mainnet payment. So if this is how you discover services, you can be assured they are configured correctly with a prod facilitator"

**What this means:**

- **CDP bazaar** (Coinbase Developer Platform service directory) = curated list of production-ready x402 services
- Services are only listed after a *successful mainnet payment* — this is an on-chain proof of a working production facilitator
- This is the cleanest signal available for "this service has a valid production facilitator" — stronger than any client-side check
- **Future opportunity:** CORTX could cross-reference against CDP bazaar when verifying a new endpoint submission — if it's listed there, the facilitator issue is already solved; if it's not, our facilitator verification is even more valuable
- **Roadmap note:** Track 3 (Verify) could include a CDP bazaar check as part of the submission flow or the CORTX Score computation

---

## Machine Commerce Protection Direction (Aug 28, 2026)

**DO NOT BUILD THIS YET.** This is a research direction, not a roadmap item.

### Core insight

x402 proves that payment happened. Payment does not prove the buyer received what they paid for.

An x402 transaction can result in:
- payment succeeds → USDC leaves the buyer → endpoint/facilitator fails or times out → valid service never delivered

CORTX currently asks: *"Did this paid endpoint actually work end-to-end?"*
A future protection layer would ask: *"If it didn't work, should the seller actually keep the money?"*

Do NOT treat these as the same product today.

### Why CORTX is already building the prerequisite

CORTX's verification pipeline already produces a machine-readable verdict:

- `PAID + VALID DELIVERY`
- `PAID + FAILED DELIVERY`

That verdict is the foundation any protection mechanism would need. CORTX's strongest position is likely **neutral independent verifier** — not the party holding funds.

### Potential future concept: CORTX Protect

Long-term promise: **Agents should never lose money to failed delivery.**

Possible protected flow:
```
Agent wants service
→ delivery requirements established (price, timeout, HTTP success, schema, etc.)
→ x402 payment
→ CORTX verifies delivery
→ valid delivery = PASS
→ failed delivery = recovery/protection mechanism
```

Possible architectures to research (do not assume one is correct):
- seller-funded automatic refunds
- facilitator integrations
- escrow / delayed settlement
- payment channels
- protocol-native refund mechanisms
- signed delivery receipts
- deterministic dispute resolution

### Data opportunity

Long-term: combine synthetic evidence (periodic CORTX-funded checks) with live commerce evidence (verification of actual agent transactions). This reduces dependence on CORTX spending its own USDC while building a much more valuable dataset covering paid delivery success, payment-without-delivery events, settlement failures, response validity, latency, price drift, refunds, provider reliability, and facilitator reliability.

This shifts CORTX from "did this endpoint work during our test?" toward "across actual machine-commerce transactions, how reliably does this service deliver what agents pay for?"

### The key strategic question

**Can CORTX own the independent verification layer that determines whether a machine transaction was commercially completed?**

Do not assume yes. Research and validate first.

### Research required before any implementation

1. Existing x402 refund mechanisms
2. Existing delivery receipt proposals
3. Correctness/dispute proposals in the x402 ecosystem
4. Facilitator timeout and payment edge cases
5. Existing "delivery or refund" implementations
6. Whether facilitators are likely to absorb this functionality
7. How CORTX could participate without custody
8. What evidence is required to objectively determine failed delivery
9. Which failures can be deterministically verified vs. subjective service-quality disputes
10. Whether CORTX can become the neutral verifier used by agents, sellers, facilitators, and marketplaces

### Current priorities remain unchanged

- endpoint coverage
- real monitoring
- builder adoption
- historical reliability data
- incidents
- monitoring economics
- external consumption of CORTX reliability data

Protect the existing wedge: **real end-to-end x402 reliability verification.**
