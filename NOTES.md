# Cortx — Session Notes

> This file is the persistent memory for this project. Update it at the end of every session or when a key decision is made. Read it at the start of any new session to get back up to speed.

---

## Project Overview

CORTX is the reliability layer for x402. It runs a full synthetic payment through your endpoint (availability → payment terms → price check → payment → delivery → JSON parse → schema validation) every few minutes, records evidence at every stage, opens incidents on consecutive failures, and sends Telegram alerts. Most monitoring asks "is your server alive?" CORTX asks "did someone actually pay for your service and receive the expected result?" — a fundamentally different problem.

Stack: Next.js 16.3.0 (App Router), Supabase (Postgres + Auth + RLS), AJV (JSON Schema validation), Vercel (hosting), cron-job.org (scheduled checks), Telegram Bot API, x402/client npm package (EIP-3009 payment signing).

**Official domain: usecortx.dev**

## Company Roadmap (locked)

```
V1 — Monitor  ✅  End-to-end x402 monitoring, incidents, alerts, evidence, public status
V2 — Verify       Ownership verification, trust labels, historical delivery reputation
V3 — Select       Agents/platforms compare providers by health, latency, price, delivery %
V4 — Route        CORTX automatically chooses and fails over between providers
```

**Current position:** V1 complete. V2 is next — endpoint ownership verification and trust labels are the missing piece before public launch is fully proven.

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
- [ ] Public launch — **next week**

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
- **BankrBot/skills PR #642 (open)**: CORTX skill — x402 endpoint reliability for agents

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
