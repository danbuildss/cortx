# Cortx — Session Notes

> This file is the persistent memory for this project. Update it at the end of every session or when a key decision is made. Read it at the start of any new session to get back up to speed.

---

## Project Overview

CORTX is a reliability monitoring tool for x402 endpoints. It runs a full synthetic payment through your endpoint (availability → payment terms → price check → payment → delivery → JSON parse → schema validation) every few minutes, records evidence at every stage, opens incidents on consecutive failures, and sends Telegram alerts. Built for Bankr builders who need to know if their paid API is actually working end-to-end, not just "up."

Stack: Next.js 14+ (App Router), Supabase (Postgres + Auth + RLS), AJV (JSON Schema validation), Vercel (hosting + cron), Telegram Bot API. x402 protocol for payment flow.

## Current Status

<!-- What stage is the project at right now? -->
- [x] In planning
- [ ] Building MVP
- [ ] In testing
- [ ] Live

## What's Been Built

<!-- List completed work with dates -->
- **2026-08-05** — Session infrastructure: gstack + 26 GTM skills + 3 custom skills (frontend-ui-engineering, landing-page-design, web-quality-audit) via session hooks + CLAUDE.md routing
- **2026-08-05** — Full product documentation set (10 files):
  - `docs/PRODUCT_SPEC.md` — executive summary, problem, target user, principles
  - `docs/V1_SCOPE.md` — exact boundaries, must-haves, deferred, definition of done
  - `docs/USER_FLOWS.md` — 9 complete user flows with success/failure states
  - `docs/UI_SPEC.md` — all 8 pages, design language, shared components
  - `docs/DATA_MODEL.md` — 5 Supabase tables with full SQL migrations + RLS
  - `docs/CHECK_RUNNER_SPEC.md` — 14-stage pipeline with TypeScript types, timeouts, security
  - `docs/INCIDENT_RULES.md` — deterministic incident rules, alert rules, deduplication
  - `docs/SECURITY.md` — wallet key storage, spend caps, SSRF, redaction, RLS, cron auth
  - `docs/BUILD_PLAN.md` — 4-phase plan (Phase 0 → 1 → 1.5 → 2) with task breakdown
  - `docs/ACCEPTANCE_CRITERIA.md` — 16 Given/When/Then scenarios covering all V1 features

## What's In Progress

<!-- Current active work -->
Nothing — planning phase complete. Ready to start Phase 0 (check runner + test service).

## What's Next

<!-- Prioritized queue of upcoming work -->
1. **Phase 0**: Build controlled test x402 endpoint (healthy + broken variants), implement check runner script, run end-to-end against test endpoint
2. **Phase 1**: Supabase schema + migrations, Next.js project setup, auth, add service form, service detail page, check runner as API route
3. **Phase 1.5**: Vercel Cron scheduler, Telegram alerts, incident management UI
4. **Phase 2**: Landing page, edit service, production hardening, private beta with 5 Bankr builders

## Key Decisions

<!-- Log important decisions made and why, so we never re-litigate them -->

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-08-05 | Set up gstack + 26 GTM skills + 3 custom skills via session hooks | Skills persist across all sessions without bloating the repo |

## Open Questions

- What x402 test endpoint URL will Phase 0 deploy to? (ngrok vs Vercel preview)
- Is the dedicated test wallet already funded on testnet? Which network — Base testnet?
- Who are the 5 Bankr builders for the private beta? Need their Telegram chat IDs.

## Useful Context

- Docs are the source of truth — if code ever conflicts with a doc, fix the code
- SSRF check must resolve DNS at validation time, not request time (DNS rebinding prevention)
- Max-price check in Stage 6 is a hard gate — no payment under any circumstances if exceeded
- Runner errors (`status = 'error'`) do NOT open incidents and do NOT update service status
- Two consecutive failures are needed before an incident opens (not one)
- The `checks` table is insert-only via service role — users never insert checks directly
- `CORTX_TEST_WALLET_KEY` env var holds the private key — never log it, never store it, never include in errors
- PR #1 is the active PR: https://github.com/danbuildss/cortx/pull/1
- Branch: `claude/persistent-skills-sessions-727k7h`
