# CORTX — Build Plan

This document defines the implementation sequence. Each phase has a clear output: something testable and demonstrably working. No phase assumes the next one.

---

## Phase 0 — Prove the Core (No UI, No DB)

**Goal:** Confirm the check pipeline works end-to-end against a real x402 endpoint before building anything else.

**Output:** A TypeScript script that accepts a service config object, runs the full pipeline, and prints stage results to the console.

### Tasks

**0.1 — Controlled test service**
- Build a minimal x402 endpoint (Node/Express or Vercel serverless) with two variants:
  - `healthy`: returns 402 with valid payment terms, accepts payment, returns valid JSON
  - `broken`: returns 402, accepts payment, returns empty body (delivery failure)
- Deploy to a known URL (Vercel preview or local ngrok for initial testing)
- Confirm the endpoint correctly returns `402 Payment Required` with no payment headers

**0.2 — Check runner script**
- Implement `runCheck(config: ServiceConfig): Promise<CheckResult>` in TypeScript
- Implement all 14 stages from `CHECK_RUNNER_SPEC.md`:
  - Stage 1: URL validation + SSRF check
  - Stage 2: Start timer
  - Stage 3: Availability (POST, expect 402)
  - Stage 4: Payment terms (parse 402 body, validate x402 fields)
  - Stage 5: Parse observed price
  - Stage 6: Price comparison + max price gate
  - Stage 7: Execute controlled payment (sign + submit transaction)
  - Stage 8: Confirm delivery (re-send with payment receipt, expect 2xx)
  - Stage 9: JSON parse
  - Stage 10: AJV schema validation
  - Stage 11: Record latency
  - Stage 12: Classify status
  - Stage 13: Placeholder (no DB yet — print result)
  - Stage 14: Placeholder (no incident logic yet)
- Use the TypeScript types from `CHECK_RUNNER_SPEC.md` exactly

**0.3 — Console runner**
- Write a `scripts/run-check.ts` entry point
- Accept `--url`, `--expected-price`, `--max-price` flags (or hardcode for initial run)
- Print the full `CheckResult` as formatted JSON
- Run against the healthy and broken test endpoints

**0.4 — AJV integration**
- Wire up AJV with Draft-07
- Test against a sample schema and confirm validation errors are collected correctly

**0.5 — SSRF protection**
- Test the URL validator against private IPs, loopback, link-local
- Confirm blocked IPs throw `SSRF_BLOCKED`
- Test against a public URL to confirm it passes

**Acceptance:** `ts-node scripts/run-check.ts` runs against the healthy endpoint, prints all stages as `passed: true`, and the overall status is `passed`. Running against the broken endpoint prints `delivery` stage as `passed: false` with the correct error evidence.

---

## Phase 1 — Make It Real

**Goal:** Full working product with a UI, database, and manual check trigger. A builder can register a service and see check results.

**Output:** Deployed Vercel app with Supabase backend. A user can sign up, add a service, trigger a check manually, and see the results.

### Tasks

**1.1 — Supabase schema**
- Run all migrations from `DATA_MODEL.md` in order:
  1. `profiles`
  2. `services`
  3. `checks`
  4. `incidents`
  5. `alert_destinations`
- Enable RLS on all tables
- Apply all RLS policies
- Apply the partial unique index on `incidents` (one open per service)
- Verify RLS is working: confirm user A cannot read user B's services via the anon client

**1.2 — Next.js project setup**
- Initialize Next.js 14+ with App Router
- Install: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `ajv`, `ajv-formats`, `geist`, `tailwindcss`
- Configure Tailwind with the color tokens from `UI_SPEC.md` (bg-page, bg-surface, etc.)
- Configure Geist and Geist Mono fonts
- Set environment variables (see `SECURITY.md` env var table)

**1.3 — Auth**
- Implement sign up and login pages (`/signup`, `/login`) per `UI_SPEC.md` Page 2
- Use Supabase Auth email/password
- Session persistence via `@supabase/ssr` middleware
- Redirect unauthenticated users to `/login`
- Redirect authenticated users away from `/login` and `/signup` to `/overview`

**1.4 — Sidebar and layout**
- Implement the authenticated layout shell with sidebar per `UI_SPEC.md`
- Sidebar items: Overview, Services, Incidents, Settings → Alert Settings
- Bottom: user email + sign out
- No icons in V1

**1.5 — Add service form**
- Implement `/services/new` per `UI_SPEC.md` Page 4 and `USER_FLOWS.md` Flow 2
- Zod schema matching `ServiceConfig` fields
- JSON textarea fields: validate JSON syntax on blur
- Schema field: validate JSON Schema against AJV meta-schema on blur
- On submit: insert to `services` table via Supabase client
- Redirect to service detail on success

**1.6 — Overview page**
- Implement `/overview` per `UI_SPEC.md` Page 3
- Fetch `services` for the current user (filtered: `deleted_at IS NULL`)
- Services table: Name (link), Status badge, Last check, Latency, Frequency, Environment
- Empty state
- Loading skeleton

**1.7 — Service detail page**
- Implement `/services/[id]` per `UI_SPEC.md` Page 5
- Fetch service + most recent check + open incidents
- Signature pipeline component (6 stage boxes, hardcoded to "no checks yet" if no check exists)
- Open incidents section (if any)
- Check history table
- Service config summary (collapsible)

**1.8 — Check runner as a server action or API route**
- Move `runCheck` from the console script into a Next.js API route: `POST /api/checks/run`
- Accept `{ service_id: string }` in the request body
- Fetch the service config from DB using the service role client
- Call `runCheck(config)`
- Store the result in the `checks` table
- Update `services.status` and `services.last_check_at`
- Run incident logic (Rules 1–2 from `INCIDENT_RULES.md`)
- Return the check result

**1.9 — Manual check trigger**
- Add a "Run check" button to the service detail page
- Wire to `POST /api/checks/run`
- Refresh the page after the check completes
- Show the new result in the pipeline component

**1.10 — Check detail page**
- Implement `/checks/[id]` per `UI_SPEC.md` Page 6
- Per-stage evidence panels (expanded, not in a drawer)
- Terminal blocks for raw evidence
- Price expected vs observed table
- AJV schema validation output

**1.11 — Evidence drawer**
- Implement the right-side evidence drawer on service detail
- Triggered by clicking a pipeline stage box
- Shows full stage evidence in a terminal block

**Acceptance:** A user can sign up, add the test service from Phase 0, click "Run check," see all 6 stages pass in the pipeline, and click into the evidence for each stage.

---

## Phase 1.5 — Make It Automated

**Goal:** Checks run on a schedule without manual triggering. Incidents open and close. Telegram alerts fire.

**Output:** A deployed app where checks run automatically, incidents are managed, and the builder receives Telegram messages.

### Tasks

**1.5.1 — Vercel Cron**
- Create `GET /api/cron/run-checks` route
- Validate the `Authorization: Bearer $CRON_SECRET` header
- Query all services where:
  - `deleted_at IS NULL`
  - `last_check_at IS NULL OR last_check_at < now() - INTERVAL 'check_interval_minutes minutes'`
- For each service: call the check runner (reuse the logic from 1.8)
- Configure `vercel.json` with the cron schedule (every 5 minutes — the minimum check interval)

**1.5.2 — Telegram alert delivery**
- Implement `sendTelegramAlert(chatId: string, message: string): Promise<void>`
- Uses Telegram Bot API with `TELEGRAM_BOT_TOKEN`
- Retry logic: 3 attempts, 2s/4s/8s backoff
- Called from incident creation (Rule 1) and auto-resolution (Rule 2)
- Format messages per `INCIDENT_RULES.md` Alert Rules section

**1.5.3 — Incident creation and resolution logic**
- Implement the consecutive failure count query
- On check complete: apply all rules from `INCIDENT_RULES.md`
- On check failed + threshold reached + no open incident: create incident, send alert
- On check failed + open incident exists: append timeline event only
- On check passed + open incident: resolve, send recovery alert
- On runner error: do nothing

**1.5.4 — Incidents list page**
- Implement `/incidents` per `UI_SPEC.md` Page 7
- Fetch all incidents for the current user, newest first
- Filter tabs: All / Open / Resolved
- Incident detail: expandable row or drawer
  - Timeline
  - Acknowledge button (if Open)
  - Resolve button (if Open or Acknowledged)
  - Link to triggering check

**1.5.5 — Acknowledge and Resolve endpoints**
- `POST /api/incidents/[id]/acknowledge` — applies Rule 3
- `POST /api/incidents/[id]/resolve` — applies Rule 4
- Both protected by session auth
- Return updated incident state

**1.5.6 — Alert settings page**
- Implement `/settings/alerts` per `UI_SPEC.md` Page 8
- List all services with their current `telegram_chat_id`
- Inline edit per service
- "Test alert" button: sends a test Telegram message and shows success/error inline
- "How to get your Telegram Chat ID" instructions (collapsible)

**1.5.7 — Soft delete**
- Add a "Delete service" button on service detail
- Sets `deleted_at = now()` on the service
- Redirects to overview
- Deleted services do not appear in the overview or scheduler queries
- Check history is preserved (joins still work, but the check detail page shows "(deleted service)")

**Acceptance:** Check scheduler runs on cron, consecutive failures open an incident, a Telegram alert arrives within 60 seconds, a passing check auto-resolves the incident, and a recovery alert arrives.

---

## Phase 2 — Open to Real Users

**Goal:** The product is ready for a private beta with 5 real Bankr builders.

**Output:** Deployed production app with a landing page, stable auth, and at least 5 monitored services.

### Tasks

**2.1 — Landing page**
- Implement `/` per `UI_SPEC.md` Page 1 and `USER_FLOWS.md` Flow 1
- Nav: wordmark + Sign in + Get started
- Hero section with copy from `UI_SPEC.md`
- Pipeline diagram (static, terminal aesthetic)
- How it works (3 steps)
- Footer

**2.2 — Edit service**
- Implement service edit form at `/services/[id]/edit`
- Pre-populate all fields from existing service
- Same validation as add form
- Update DB record on save

**2.3 — Production environment hardening**
- Set all environment variables in Vercel production
- Confirm `CRON_SECRET` is set and cron endpoint rejects requests without it
- Confirm RLS policies are in effect on the production Supabase project
- Confirm `CORTX_TEST_WALLET_KEY` is set and refers to the dedicated test wallet
- Confirm spend caps are configured

**2.4 — Private beta onboarding**
- Invite 5 Bankr builders
- Walk each through adding their x402 service
- Confirm alerts are received
- Collect feedback

**Acceptance:** 5 real services monitored, checks running on schedule, incidents opened and resolved accurately, Telegram alerts received, no production errors in Vercel logs.

---

## Implementation Notes

### Ordering Within Phases

Within each phase, tasks can be parallelized where there are no dependencies. The dependency chain is roughly:

- Phase 0: 0.1 → 0.2 → 0.3 (sequential); 0.4, 0.5 can be parallel with 0.2
- Phase 1: 1.1 → 1.2 → 1.3 → 1.4 (then 1.5–1.11 mostly parallel after 1.4)
- Phase 1.5: 1.5.1 and 1.5.2 are independent; 1.5.3 needs 1.5.2; 1.5.4–1.5.7 need 1.5.3
- Phase 2: 2.1 is independent; 2.2 needs 1.5 complete; 2.3 before 2.4

### What Not to Build

No feature not listed in this plan is in scope for V1. If something seems like it "belongs" here but isn't listed, consult `V1_SCOPE.md`. The answer is almost certainly: it's deferred.

### Test Service

The Phase 0 test service should remain deployed throughout development. It is used for all manual check testing and any automated test runs. It should never be torn down until the product is in private beta with real services.
