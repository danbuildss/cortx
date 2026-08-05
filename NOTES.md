# Cortx — Session Notes

> This file is the persistent memory for this project. Update it at the end of every session or when a key decision is made. Read it at the start of any new session to get back up to speed.

---

## Project Overview

CORTX is a reliability monitoring tool for x402 endpoints. It runs a full synthetic payment through your endpoint (availability → payment terms → price check → payment → delivery → JSON parse → schema validation) every few minutes, records evidence at every stage, opens incidents on consecutive failures, and sends Telegram alerts. Built for Bankr builders who need to know if their paid API is actually working end-to-end, not just "up."

Stack: Next.js 14+ (App Router), Supabase (Postgres + Auth + RLS), AJV (JSON Schema validation), Vercel (hosting), cron-job.org (scheduled checks), Telegram Bot API, x402/client npm package (EIP-3009 payment signing).

## Current Status

- [x] In planning
- [x] Building MVP
- [ ] In testing
- [ ] Live

Core loop working end-to-end. PR #12 open with the latest batch of features.

---

## What's Been Built

### Infrastructure
- Next.js 14 App Router project on Vercel
- Supabase: Postgres + Auth + RLS (5 tables)
- Session hooks: gstack skill suite installed
- cron-job.org calls `GET /api/cron` every minute with `Authorization: Bearer {CRON_SECRET}`

### Database Tables
- `profiles` — user profiles (linked to Supabase auth)
- `services` — monitored x402 endpoints with config (expected_price, max_price, schema, interval, environment)
- `checks` — insert-only check results with per-stage evidence JSONB (status, latency_ms, stages, failure_stage)
- `incidents` — incident records with JSONB timeline (opened → escalated → resolved events)
- `alert_configs` — per-service Telegram alert configs (destination, on_open, on_severity_increase, on_resolve, enabled)

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
- `CORTX_TEST_WALLET_KEY` env var holds 0x-prefixed private key — never logged
- 2 consecutive failures required before incident opens
- `status = 'error'` (infra errors) does NOT update service status or open incidents
- Telegram alerts fire via `alert_configs` on incident open / severity escalate / resolve

### API Routes
- `GET /api/cron` — scheduled check runner, requires `Authorization: Bearer {CRON_SECRET}`
- `POST /api/check/[serviceId]` — manual "Run check" trigger from UI

### App Pages (auth-protected, under `(app)/`)
| Page | Route | What it does |
|---|---|---|
| Login | `/login` | Supabase auth |
| Overview | `/overview` | Service list, summary cards, status page copy link |
| Service detail | `/services/[id]` | Status, meta, latency sparkline chart, recent checks table, stage breakdown |
| Service add | `/services/new` | Full config form (endpoint, prices, schema, interval, alerts) |
| Service edit | `/services/[id]/edit` | Pre-filled edit form for all config fields |
| Incidents | `/incidents` | Open + resolved incident list, clickable rows |
| Incident detail | `/incidents/[id]` | Timeline view with colored event dots, meta cards |
| Alert settings | `/settings/alerts` | Telegram alert config per service (add/toggle/remove) |

### Public Pages
| Page | Route | What it does |
|---|---|---|
| Status page | `/status/[userId]` | Per-user public status page — overall banner, per-service 90-day uptime bars, active incidents |

### UI Features
- Overview: copy-link button for status page URL
- Service detail: SVG latency sparkline (avg/min/max, green=passed/red=failed dots)
- Service detail: stage breakdown with evidence JSON for last check
- Status page: 90-day colored bar grid per service (green/red/dim-gray), ISR 60s
- Alert settings: per-event toggles (on_open, on_severity_increase, on_resolve) with optimistic updates

---

## Key Environment Variables (Vercel)

| Var | What |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side queries |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key for client-side auth |
| `CORTX_TEST_WALLET_KEY` | 0x-prefixed 32-byte private key for test wallet (funded with USDC on Base mainnet) |
| `CRON_SECRET` | Bearer token cron-job.org sends in Authorization header |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for alerts |

---

## Key Decisions

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-08-05 | Base **mainnet** only, real USDC | Test with real stakes — testnet doesn't reflect production reliability |
| 2026-08-05 | x402/client npm package for payment signing | Coinbase's reference client handles EIP-712 domain correctly, avoids hand-rolled signing bugs |
| 2026-08-05 | cron-job.org instead of Vercel cron | Vercel Hobby plan only allows daily crons; cron-job.org gives per-minute scheduling free |
| 2026-08-05 | 2 consecutive failures to open incident | Reduces noise from transient failures |
| 2026-08-05 | `error` status never opens incidents | Infra errors (timeouts, DNS) shouldn't page you — only real payment failures matter |
| 2026-08-05 | Public status page at `/status/[userId]` | Makes CORTX feel like a real product; shareable without requiring login |

## Open Questions

- Who are the 5 Bankr builders for the private beta?
- Email alerts alongside Telegram? (infrastructure not built yet)
- Custom domain for status pages?

## Branch / PR History

- Branch: `claude/persistent-skills-sessions-727k7h`
- PRs 1–11: merged to main
- PR #12: open — service edit, incident detail, latency chart, 90-day uptime bars, nav fix
