# CORTX

**Reliability infrastructure for x402 — verify paid services actually deliver.**

An x402 service can be online and still be broken: its payment terms are malformed, it takes the payment and returns nothing, or it returns something the caller can't use. CORTX makes controlled paid test calls against x402 services and records what happened at every stage — payment terms, price, payment, settlement, delivery and response schema — so builders catch failures before agents and users do.

Live at [usecortx.dev](https://usecortx.dev). Built on Base, starting with [Bankr](https://bankr.bot) builders.

---

## How a check works

CORTX runs the open [x402 Reliability Spec](https://github.com/danbuildss/x402-reliability-spec) pipeline:

| # | Stage | What CORTX verifies | Pays? |
|---|---|---|---|
| 1 | Availability | The endpoint answers | No |
| 2 | 402 response | It asks for payment instead of answering for free | No |
| 3 | Payment terms | Terms parse, in x402 V1 (402 body) or V2 (`PAYMENT-REQUIRED` header), with a Base USDC option | No |
| 4 | Price | The price is valid and within the service's bounds | No |
| 5 | Payment | CORTX signs an EIP-3009 authorization, retries with `X-PAYMENT` (V1) or `PAYMENT-SIGNATURE` (V2), and reads the settlement receipt (`PAYMENT-RESPONSE`) — the transaction hash comes only from that receipt | Yes |
| 6 | Delivery | The paid response is a 2xx with a body | Yes |
| 7 | Schema | The body is JSON and matches the service's JSON Schema, if one is set | Yes |

**Check tiers**, from cheapest to most complete:

- **Lightweight** (stages 1–4, free) — frequent uptime and payment-terms checks.
- **Readiness** (free) — asks the service's own facilitator to `/verify` a signed authorization without settling it. Only possible when the service publishes its facilitator and that facilitator accepts CORTX's requests; otherwise it is "unavailable", never a failure.
- **Paid** (all 7 stages, real USDC) — the proof. Runs on each service's schedule; once a day when readiness is passing and the last paid check passed.

**CORTX's own problems are never blamed on a service.** An empty test wallet, a spent budget or an internal error is recorded as a CORTX-side `error`: it opens no incident, sends no alert to the builder and doesn't count in uptime.

Two failed checks in a row open an incident; a passing check of the same tier or higher closes it.

---

## What builders get

- **Monitoring and incidents** with stage-level evidence, including the settlement receipt and a Basescan link
- **Telegram and Discord alerts** when incidents open, get worse and resolve
- **Public status pages** — `/status/[userId]` and `/status/service/[serviceId]`
- **Badge** — `/api/badge/[serviceId]`
- **Reliability API** — `GET /api/v1/reliability/[serviceId]`: 30-day uptime, paid delivery, schema validity, latency, the open incident, and the latest paid check as an [x402 Reliability Spec](https://github.com/danbuildss/x402-reliability-spec) evidence record. Docs: [usecortx.dev/docs/partner-integration](https://usecortx.dev/docs/partner-integration)
- **Registry** — [usecortx.dev/registry](https://usecortx.dev/registry): monitored and observed x402 services
- **Free reliability report** — [usecortx.dev/report](https://usecortx.dev/report)

---

## Open source

**Open tools, paid network.** The checker is open; the accumulated evidence — months of checks, incidents and recoveries across services — is what CORTX builds.

- **[x402 Reliability Spec](https://github.com/danbuildss/x402-reliability-spec)** (Apache 2.0) — the open standard for x402 reliability evidence. CORTX is its reference implementation: `lib/check-runner/spec-conformance.test.ts` runs every spec test vector through the real check runner, and all pass.
- **This repository** (MIT) — the full CORTX app.

---

## Cori

Cori is CORTX's autonomous reliability agent. Today (Scout v0) it discovers paid x402 services from the Coinbase CDP Bazaar, checks them for free, and queues good candidates for human review in the admin. **Cori holds no wallet key and never pays**; all spending stays in CORTX's deterministic payment path. See [`agent/cori/`](agent/cori/README.md) and [`docs/CORI_SCOUT_V0_SPEC.md`](docs/CORI_SCOUT_V0_SPEC.md).

---

## Stack

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router, React Server Components) on Vercel |
| Database | Supabase — Postgres, Auth, Row Level Security |
| Payments | viem (EIP-3009, x402 V2) and `x402/client` (V1), Base mainnet USDC |
| Scheduling | cron-job.org calls `/api/cron` every 15 minutes |
| Alerts | Telegram Bot API, Discord webhooks; email reports via Resend |
| Cori | Node process on its own server, Postgres as a least-privilege role |

---

## Running locally

```bash
git clone https://github.com/danbuildss/cortx.git
cd cortx
npm install
cp .env.example .env.local   # fill in values below
npm run dev
npm test                     # unit, end-to-end and spec-conformance tests
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key (client-side auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase service role key (server only) |
| `CRON_SECRET` | yes | Bearer token cron-job.org sends to `/api/cron` |
| `CORTX_TEST_WALLET_KEY` | for paid checks | `0x`-prefixed private key of the dedicated test wallet. Set it only in your host's secret store — never in code or on any other server |
| `CORTX_DAILY_SPEND_CAP_USDC` | no (1.00) | Platform-wide daily spend cap for paid checks |
| `CORTX_MONTHLY_SPEND_CAP_USDC` | no (10.00) | Platform-wide monthly spend cap |
| `CORTX_WALLET_LOW_BALANCE_THRESHOLD_USDC` | no (0.05) | Admin alert when the test wallet drops below this |
| `BETA_MAX_ENDPOINT_PRICE_USDC` | no (1.00) | Highest per-call price CORTX will pay |
| `TELEGRAM_BOT_TOKEN` | for alerts | Telegram bot token |
| `TELEGRAM_BOT_USERNAME` | for alerts | Bot username without `@`, for deep links |
| `TELEGRAM_WEBHOOK_SECRET` | for alerts | Verifies Telegram webhook calls |
| `CORTX_ADMIN_USER_ID` | for admin | Supabase user id of the owner (enables `/admin`) |
| `CORTX_ADMIN_TELEGRAM_CHAT_ID` | for admin | Owner's Telegram chat for wallet and Cori alerts |
| `FEEDBACK_TELEGRAM_CHAT_ID` | no | Receives feedback-widget submissions |
| `RESEND_API_KEY` | for reports | Sends reliability report emails |
| `CORTX_TEST_PAYEE_ADDRESS` / `CORTX_TEST_WALLET_ADDRESS` | no | Payee for the built-in test service (`/api/test-service`) |
| `CORTX_SKIP_PAYMENT_VERIFY` | no | `true` lets the test service skip on-chain verification in local development |
| `BASE_RPC_URL` | no | Base RPC for token lookups (defaults to `https://mainnet.base.org`) |

Cori has its own settings — see [`agent/cori/README.md`](agent/cori/README.md).

---

## Repository layout

| Path | What's there |
|---|---|
| `app/` | Next.js app: dashboard, admin (`/admin`, `/admin/cori`), public pages, API routes |
| `lib/check-runner/` | The check pipeline: x402 parsing (`x402.ts`), payment (`payment.ts`), readiness, scheduling, persistence, spec records |
| `lib/cori/`, `lib/net/` | Cori's pure rules; SSRF-safe networking |
| `agent/cori/` | The Cori process |
| `supabase/migrations/` | SQL migrations, applied in order in the Supabase SQL editor |
| `test/` | Test hooks, stubs and the vendored spec test vectors |
| `docs/` | Specs: check runner, Cori Scout |

---

## Database

Postgres on Supabase with Row Level Security on every table. The main groups:

- **Monitoring** — `services`, `checks` (insert-only, per-stage evidence as JSONB), `incidents`, `alert_configs`, `telegram_connections`, `discord_connections`, `profiles`
- **Spending** — `spend_reservations` plus the `reserve_spend()` and `get_spend_totals()` functions (atomic budget reservation)
- **Registry and submissions** — `registry_seeds`, `endpoint_submissions`
- **Cori** — `discovered_services`, `discovery_events`, `cori_runs`, `cori_sources`, `cori_denylist`, and the `cori_agent` role
- **Settings** — `system_settings`

---

## Security

- The test wallet key lives only in the app host's secret store, is redacted from every error and log path, and never reaches Cori
- Every paid check reserves budget atomically against the daily and monthly caps first
- SSRF protection: checks only call HTTPS URLs that resolve to public addresses; Cori's fetcher also pins the address at connect time and re-validates every redirect
- Response bodies capped at 1 MB
- Cron and webhook secrets compared in constant time; Telegram link tokens are single-use and expire after 10 minutes
- The service role key is used only on the server; Cori connects as a least-privilege Postgres role
- Budget and wallet functions are not callable by anonymous or signed-in users

---

## License

[MIT](LICENSE)
