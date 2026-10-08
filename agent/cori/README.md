# Cori — CORTX's autonomous reliability agent

**Scout v0 (discovery only).** Cori reads the Coinbase Bazaar, classifies x402 services with fixed rules, probes eligible ones for free, and queues candidates into the CORTX admin review. **It holds no wallet key and never pays** — it refuses to start if key material is in its environment, and a test checks the bundle contains no payment or signing code. Brief: [`docs/CORI_BRIEF.md`](../../docs/CORI_BRIEF.md) · Spec: [`docs/CORI_SCOUT_V0_SPEC.md`](../../docs/CORI_SCOUT_V0_SPEC.md).

```
discover (Bazaar) → normalize → dedupe → link to CORTX records → classify
      → free probe (402 terms only) → classify → queue (admin review)

memory (append-only): every listing version (discovery_listings), every probe
incl. failures (discovery_observations), every change (discovery_events)
```

**Quality over noise (Q1):** Cori keeps only listings on an own domain (not free app hosting) with a real name and description, at most 10 per company. A company is proposed for review **once**, as one card, after its website answers and a service passes the free check. Companies in `cori_watchlist` always pass.

Probes send only GET, or POST with an empty `{}` body — never a body taken from a listing — and only to port 443.

## Run

```bash
npm ci
npm run build:cori                       # → agent/cori/dist/cori.mjs (one file, git SHA stamped as cori_version)

# one read-only cycle: nothing written except the run log
CORI_DATABASE_URL=postgres://cori_agent:…@…/postgres CORI_DRY_RUN=1 node agent/cori/dist/cori.mjs --once

# one real cycle, then exit
CORI_DATABASE_URL=… npm run cori:once

# continuous (what systemd runs on the VPS)
CORI_DATABASE_URL=… node agent/cori/dist/cori.mjs
```

Only one instance runs at a time (Postgres advisory lock). `SIGTERM` stops it cleanly.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `CORI_DATABASE_URL` | required | Postgres URL for the **`cori_agent`** role (never the service-role key) |
| `CORI_DB_SSL` | `require` | `disable` only for local testing |
| `CORI_DRY_RUN` | `0` | `1` = read-only; writes only `cori_runs` (as `dry:*`) |
| `CORI_MAX_ELIGIBLE_PRICE_USDC` | `0.05` | services above this are `too_expensive` |
| `CORI_DAILY_QUEUE_CAP` | `25` | max new candidates added to the admin queue per UTC day |
| `CORI_PROBE_CONCURRENCY` | `4` | parallel probes |
| `CORI_PER_HOST_MIN_INTERVAL_MS` | `2000` | min gap between requests to one host |
| `CORI_PER_HOST_MAX_PER_HOUR` | `30` | max probes per host per hour |
| `CORI_PROBE_RECHECK_HOURS` | `168` | re-probe cadence for healthy services (weekly) |
| `CORI_PER_HOST_MAX_PER_DAY` | `5` | max free checks per host per rolling day (company-first) |
| `CORI_PROBE_PER_HOST_PER_BATCH` | `1` | max rows per host in one probe batch; hosts never checked go first |
| `CORI_MAX_SERVICES_PER_COMPANY` | `10` | services kept per company (the oldest); the rest are set aside as noise |
| `CORI_BAZAAR_PAGE_LIMIT` / `CORI_BAZAAR_MAX_PAGES` | `100` / `500` | pagination (up to 50k listings per pass) |
| `CORI_ALLOWED_PORTS` | `443` | ports Cori may contact (comma-separated) |
| `CORI_MAX_PROBES_PER_HOUR` | `600` | global probe budget across all hosts |
| `CORI_VERSION` | git SHA from the build | override the version stamped on runs and observations |
| `CORI_TICK_SECONDS` / `CORI_HEARTBEAT_SECONDS` | `30` / `300` | loop cadence / heartbeat row |

Sources (`cori_sources`) and the opt-out denylist (`cori_denylist`) live in the database.

## Layout

| File | What it does |
|---|---|
| `index.ts` | entry: config, lock, loop, dry-run, shutdown |
| `build.mjs` | esbuild bundle + version stamp (`npm run build:cori`) |
| `pipeline.ts` | discovery, probing, queueing, disappearance sweep, one full cycle |
| `probe.ts` | free probe (GET, or POST `{}`) — never a payment header, never a third-party body |
| `sources/bazaar.ts` | paginated Bazaar client with retries |
| `pg-store.ts` / `memory-store.ts` | Postgres (as `cori_agent`) / in-memory store |
| `limiter.ts` | per-host politeness |
| `../../lib/cori/*` | pure rules shared with the app: normalize, classify, Bazaar parsing |
| `../../lib/net/*` | SSRF-safe fetch (connect-time DNS pinning) + public-address rules |

## Tests

`npm test` runs everything, including the full pipeline against a fake Bazaar and fake x402 services. The real-Postgres test (as `cori_agent`) runs when `CORI_TEST_ADMIN_DATABASE_URL` points at a disposable Postgres superuser connection.
