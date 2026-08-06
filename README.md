# CORTX

**Uptime monitoring for x402 payment endpoints.**

CORTX runs a full synthetic payment through your endpoint every few minutes — checking availability, validating payment terms, verifying price, signing and sending payment, confirming delivery, and validating the response schema. If anything breaks at any stage, it opens an incident and alerts you on Telegram. Your customers get a public status page.

Built for [Bankr](https://bankr.bot) builders shipping paid APIs on Base.

---

## What it does

Most uptime monitors send a GET request and call it a day. CORTX goes further: it runs a complete end-to-end payment through your x402 endpoint, catches failures at every stage, and tells you exactly where things broke.

**7-stage check pipeline:**

1. **Availability** — basic HTTP reachability
2. **Payment terms** — validates the 402 response and parses the `X-Payment-Required` header
3. **Price check** — verifies the price is within your expected and maximum bounds
4. **Payment** — signs an EIP-3009 authorization via the `x402/client` package
5. **Delivery** — resends the request with the payment header, expects 200
6. **JSON parse** — parses the response body
7. **Schema validation** — validates against your expected JSON Schema (AJV)

Evidence is recorded at every stage. When two consecutive checks fail at the same stage, an incident opens.

---

## Features

- **Service monitoring** — add any x402 endpoint and get per-minute checks with full stage evidence
- **Incidents** — auto-opened on consecutive failures, auto-resolved on recovery, with a full timeline
- **Telegram alerts** — instant notifications when incidents open or resolve
- **Public status page** — shareable `/status/[userId]` page with 90-day uptime history per service
- **Overview dashboard** — response time chart, uptime donut, live incident panel, per-service metrics
- **Dark / light mode** — persisted to localStorage, no flash on load
- **Mobile responsive** — full hamburger nav on mobile, same feature parity

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components) |
| Database | Supabase — Postgres + Auth + Row Level Security |
| Payments | `x402/client` — EIP-3009 signing, Base mainnet USDC |
| Alerts | Telegram Bot API |
| Hosting | Vercel |
| Scheduling | cron-job.org (per-minute, free tier) |

---

## Running locally

```bash
git clone https://github.com/danbuildss/cortx.git
cd cortx
npm install
cp .env.example .env.local   # fill in values below
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client-side auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `CORTX_TEST_WALLET_KEY` | `0x`-prefixed private key for the test wallet that signs payments |
| `CRON_SECRET` | Bearer token — sent by cron-job.org in `Authorization: Bearer` header |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for sending alerts |
| `TELEGRAM_BOT_USERNAME` | Bot username without `@`, used to build deep-link URLs |
| `FEEDBACK_TELEGRAM_CHAT_ID` | Your personal Telegram chat ID — receives beta feedback submissions |

---

## Database

Six core tables, all protected by Row Level Security:

| Table | Purpose |
|---|---|
| `profiles` | User display names, linked to Supabase auth |
| `services` | Monitored endpoints with config (price bounds, schema, interval, environment) |
| `checks` | Insert-only check results — status, latency, per-stage evidence JSONB |
| `incidents` | Incident records with JSONB timeline (opened → acknowledged → resolved) |
| `alert_configs` | Per-service Telegram alert preferences |
| `telegram_connections` | User → Telegram chat ID, established via bot deep-link |

Migrations live in `supabase/migrations/`.

---

## Architecture notes

**Check runner** (`lib/check-runner/`): Executes the 7-stage pipeline, records evidence at each stage, enforces a 1MB response body cap, and applies a cumulative daily + monthly spend cap. `status = 'error'` (infra failures) never opens incidents — only real payment failures do.

**Cron** (`/api/cron`): Called by cron-job.org with `Authorization: Bearer {CRON_SECRET}`. Fetches all active services and runs checks sequentially.

**Telegram auth**: Deep-link flow — user clicks a link → Telegram sends `/start {token}` to the bot webhook → webhook atomically claims the single-use token and stores the chat ID.

**RLS**: Every query is scoped to `auth.uid()`. The check runner uses the Supabase service role key only on the server, never exposed to the client.

---

## Security

- Cron authenticated via `Authorization: Bearer` header (not a query parameter)
- Telegram webhook verified with `timingSafeEqual` constant-time comparison
- Telegram tokens are single-use and expire after 10 minutes
- Private key fully redacted in all error/log paths
- Response bodies capped at 1MB via streaming reader
- Cumulative spend cap enforced daily and monthly

---

## Roadmap

- [ ] Email and Slack alert channels
- [ ] Multi-user teams and organizations
- [ ] Custom domains for status pages
- [ ] Incident acknowledgement from the UI
- [ ] Per-service custom check intervals (UI — backend already supports it)

---

## License

MIT
