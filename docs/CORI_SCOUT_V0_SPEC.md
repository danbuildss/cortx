# Cori Scout v0 — Technical Spec

**Status:** APPROVED with defaults (Sep 28, 2026) · Phase A built
**Scope:** discovery only. Zero USDC. No public claims. No LLM.

---

## 0. Product thesis this serves

Cori is the autonomous reliability agent for CORTX. It is **not** a bigger x402 scanner or another trust score (ScoutScore already covers breadth: 2,000+ domains, paid probes, SDK/MCP). Cori's destination is **autonomous incident investigation**: for any machine payment that went wrong, answer *"what exactly happened, and can we prove it?"*

```
discover → observe → detect anomaly → reproduce → trace failing stage →
collect payment/settlement/delivery evidence → open incident → notify provider →
watch recovery → paid recovery verification → close → preserve history
```

Evidence states (kept separate everywhere, from day one): **Observed → Reproduced → Confirmed → Resolved.** Nothing about a third-party service becomes a public failure automatically; a human confirms until Cori has earned trust.

> The checker can be open. The network and the accumulated evidence are the moat.

**Scout is only how Cori starts seeing the ecosystem.** Scout v0 answers one question: *how many real, cheaply verifiable x402 services exist on Base, and where do they come from?*

---

## 1. Architecture

```
                 ┌──────────────────────── CORI VPS (Hetzner, CORTX project) ─────────────┐
 Bazaar /        │  cori (one Node process, systemd)                                        │
 facilitator  ──►│   scheduler ─► sources ─► normalize ─► dedupe ─► probe ─► classify ─► queue │
 discovery APIs  │                                     (free, no payment, no wallet)          │
                 └──────────────────────────────┬───────────────────────────────────────────┘
                                                │ Postgres (least-privilege role `cori_agent`)
                                                ▼
                         ┌────────────── Supabase Postgres ──────────────┐
                         │ discovered_services  discovery_sources_seen    │
                         │ discovery_events     cori_runs                 │
                         │ endpoint_submissions (source = 'cori_scout') ──┼──► existing admin review
                         └───────────────────────────────────────────────┘        │ approve
                                                ▲                                   ▼
                              CORTX app on Vercel (unchanged wallet/payment path)  registry_seeds
                              - /admin: Cori panel + candidate metadata
                              - cron watchdog: alert if Cori heartbeat is stale
```

Key boundaries:
- **The VPS never holds money.** No wallet key, no Supabase service-role key, no Telegram token. Scout never signs anything.
- **The admin review queue is the only path to the public registry.** Scout writes *candidates*; only a human approval creates a `registry_seeds` row (the existing flow).
- **Reuse, don't fork:** payment-terms parsing, pricing and facilitator discovery come from `lib/check-runner/x402.ts` (Day 2/3). URL safety comes from `lib/check-runner/ssrf.ts`, tightened for Cori (§10).

---

## 2. Discovery sources

| # | Source | How | Trust | v0 |
|---|---|---|---|---|
| S1 | **CDP Bazaar** (Coinbase facilitator) | `GET {CDP facilitator}/discovery/resources?type=http&limit=&offset=` (paginate). Filterable by `network`, `scheme`, `payTo`. Items: `resource`, `type`, `x402Version`, `accepts[]`, `lastUpdated`, `description`, `mimeType`, `serviceName`, `tags`, `iconUrl`, `extensions` (Bazaar input/output metadata). Listed only after a successful mainnet payment, so a production facilitator is configured (confirmed by the x402 team on X, Aug 29). | High | ✅ |
| S2 | **Other facilitators' Bazaar endpoints** | Same `/discovery/resources` contract (Bazaar extension, v1 + v2). Configured list in `cori_sources`; each can be switched off. | Medium | ✅ configurable, starts with S1 only |
| S3 | **CORTX's own records** | `services`, `registry_seeds`, `endpoint_submissions`. Used for dedupe/linking, never re-queued. | Internal | ✅ read-only |
| S4 | **Merchant expansion** | For an eligible service, query S1 with `payTo=<merchant>` to find the merchant's other resources. | High (same source) | ✅ capped |
| — | ScoutScore API, x402 directory websites, on-chain settlement crawling | Not used in v0: competitor data dependency / scraping terms / cost. Revisit with permission or an official API. | — | ❌ |

**Confirmed in Phase A:** `GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources`. Bazaar discovery is **public: no CDP API key needed**. About **16,170 resources** were indexed as of Sep 2026 (per coinbase/cdp-sdk#806). **Still to confirm on the first dry run** (not reachable from the build container): rate limits, and the exact field names of the Bazaar input/output metadata inside `extensions`. `lib/cori/bazaar.ts` reads them leniently.

---

## 3. Discovery / normalization pipeline

One **cycle** per source (default every 6 h, jittered), plus a continuous **probe worker**:

1. **Fetch** source pages: max 50 pages × 100 items per cycle, 5 MB response cap, validated with `zod` (already a dependency). Invalid items are counted and skipped, not fatal.
2. **Extract** per item: resource URL, `type` (only `http` in v0), x402 version, every `accepts[]` option, name, description, tags, Bazaar input/output metadata.
3. **Normalize** the URL → `canonical_url` (§5). Reject non-https.
4. **Upsert** `discovered_services` (by `canonical_url`) and `discovery_sources_seen` (by service + source). Write a `discovery_events` row for `first_seen`, `listing_changed` (content hash differs) and `reappeared`.
5. **Link** against CORTX records (S3): set `linked_service_id` / `linked_seed_id` / `linked_submission_id`.
6. **Schedule a probe**: new → now; listing changed → now; otherwise per the cadence in §6.
6b. **Listing-first classification.** Each listing already carries its `accepts[]` (network, asset, scheme, price), so Scout classifies from the listing first. Only services that pass on paper (class `pending`) get a live probe. With about 16k listings, that avoids probing thousands of off-network or expensive endpoints.
7. **Probe** (free; §6) → parse the 402 with `parsePaymentRequired()` → choose the Base+USDC option (same rule as the runner) → `priceToUsdc()`, `findFacilitatorUrl()`.
8. **Classify** (§7). On a class change, write a `discovery_events` row.
9. **Queue**: `eligible` / `needs_input` candidates not yet queued → insert into `endpoint_submissions` with `source = 'cori_scout'` (§4). Daily cap (default 25).
10. **Heartbeat + run stats** → `cori_runs`.

Disappearance: a service not seen in any source for 7 days **and** failing probes for 7 days → class `gone` (history kept, never deleted).

---

## 4. Database changes (migration `023_cori_scout.sql`)

All new tables: RLS on, no anon/authenticated access. Safe to re-run; no temp tables or explicit transactions (Supabase SQL editor lessons from 020–022).

```sql
-- One row per canonical endpoint Cori has ever seen
discovered_services (
  id uuid pk,
  canonical_url text unique not null,
  host text not null,
  first_seen_at timestamptz not null, first_source text not null,
  last_seen_at timestamptz not null,               -- last time any source listed it
  service_name text, description text, tags text[],  -- untrusted, length-capped
  bazaar_metadata jsonb,                            -- input/output info, capped at 16 KB
  http_method text,                                 -- from metadata; default GET
  x402_version smallint, network text, asset text, scheme text, transfer_method text,
  price_atomic numeric, price_usdc numeric,
  pay_to_fingerprint text,                          -- sha256 prefix, same as the runner
  facilitator_url text,                             -- only if the service publishes one
  last_probe_at timestamptz, next_probe_at timestamptz, probe_failures int default 0,
  last_probe jsonb,                                 -- latest free-probe evidence (capped)
  classification text not null default 'pending',   -- §7
  classification_reasons text[] not null default '{}',
  evidence_state text not null default 'observed'   -- observed only in v0 (§0)
     check (evidence_state in ('observed','reproduced','confirmed','resolved')),
  linked_service_id uuid references services(id),
  linked_seed_id uuid references registry_seeds(id),
  linked_submission_id uuid references endpoint_submissions(id),
  created_at, updated_at
)

-- Where/when each source listed it (first/last), plus a content hash to spot changes
discovery_sources_seen (
  discovered_service_id uuid, source text,
  first_seen_at, last_seen_at, last_listing_hash text,
  primary key (discovered_service_id, source)
)

-- Append-only history: Cori's first memory
discovery_events (
  id bigserial pk, discovered_service_id uuid, at timestamptz,
  event text check (event in ('first_seen','listing_changed','reappeared','disappeared',
                              'terms_changed','price_changed','probe_status_changed',
                              'classification_changed','queued','approved','rejected')),
  details jsonb
)

-- Heartbeat + per-cycle stats
cori_runs (
  id bigserial pk, started_at, finished_at, kind text,   -- 'discover:<source>' | 'probe' | 'heartbeat'
  ok boolean, stats jsonb, error text
)

-- Configurable sources (on/off, cadence) and a host denylist (opt-out/abuse)
cori_sources (id text pk, url text, enabled boolean, interval_minutes int, last_run_at timestamptz)
cori_denylist (host text pk, reason text, added_at timestamptz)
```

**Existing table change (reuse the admin queue):**
```sql
alter table endpoint_submissions
  add column source text not null default 'public' check (source in ('public','cori_scout')),
  add column discovered_service_id uuid references discovered_services(id),
  add column candidate_metadata jsonb;   -- network, asset, price, x402 version, class, reasons, sources
create unique index ... on endpoint_submissions (discovered_service_id) where status = 'pending';
```
`name` is required by the table: Scout uses `serviceName`, falling back to `host + path`.

**Least-privilege role** `cori_agent` (LOGIN, password set by the founder in Supabase):
- select/insert/update on the six Cori tables above
- insert on `endpoint_submissions`, limited by column privileges to `endpoint_url, name, description, website_url, category, source, discovered_service_id, candidate_metadata`
- select on `services(id, endpoint_url, deleted_at)`, `registry_seeds(id, endpoint_url)`, `endpoint_submissions(id, endpoint_url, status, discovered_service_id)`
- **nothing else**: no checks, incidents, wallets/spend, users, settings.

---

## 5. Deduplication strategy

`canonical_url` rules:
- lowercase scheme and host; punycode for internationalized hosts
- drop the default port (443), the fragment, userinfo, and `utm_*` / known tracking params
- keep the path case-sensitive; collapse duplicate slashes; strip one trailing slash (except root)
- sort the remaining query params

Matching:
1. **Exact** `canonical_url` → same row (upsert).
2. **Against CORTX records**: canonicalize `services.endpoint_url`, `registry_seeds.endpoint_url` and `endpoint_submissions.endpoint_url` at match time → `linked_*`, class `already_monitored` / `already_listed` / `already_submitted`. Never re-queued.
3. **Grouping, not merging**: same `host + path` with different queries, or the same `pay_to_fingerprint`, are recorded as related (for merchant view later) but stay separate rows.
4. **Queue idempotency**: the unique pending index + `linked_submission_id` → never two pending submissions for one service. A **rejected** candidate is re-queued only after a material change (`price_changed`, `terms_changed`, or a new source), and at most once per 30 days.

---

## 6. Free-probe rules

A probe asks "does this URL answer with valid x402 payment terms?". **It can never pay:**
- **Never** sends `X-PAYMENT` / `PAYMENT-SIGNATURE`, never signs, has no wallet, sends no cookies or auth headers.
- **Method:** `GET` first. `POST` only if GET didn't return 402 **and** the Bazaar metadata declares POST. Body = the Bazaar example if it's JSON and ≤ 8 KB, else `{}`. No other methods.
- **Limits:** 10 s timeout; 64 KB body cap (payment terms are small); ≤ 2 redirects, each re-validated (§10).
- **Politeness:**
  - global concurrency 4
  - per host: 1 at a time, ≥ 2 s apart, ≤ 30 probes an hour
  - `User-Agent: CORTX-Cori/0.1 (+https://github.com/danbuildss/cortx)`
  - denylist honored (`cori_denylist`, opt-out on request)
- **Cadence:**
  - new or changed listing → now
  - known → every 24 h (the Observer phase makes this smarter)
  - failures back off 1 h → 6 h → 24 h
- **Recorded:** HTTP status, latency, which header/body carried the terms, x402 version, the chosen option, price, facilitator (if published), plus terms/price change events vs the previous probe.

---

## 7. Eligibility / classification rules (deterministic, in order)

| Class | Rule | Queued? |
|---|---|---|
| `blocked` | fails SSRF checks, non-https, or host on the denylist | no |
| `already_monitored` / `already_listed` / `already_submitted` | linked to an existing CORTX record | no |
| `unreachable` | network error / timeout / 5xx on the latest probe | no |
| `not_x402` | answered, but no 402 with parseable terms | no |
| `invalid_terms` | 402, but terms missing payTo/amount/network | no |
| `unsupported_network` | no Base mainnet option (`base` / `eip155:8453`) | no |
| `unsupported_asset` | no USDC option | no |
| `unsupported_scheme` | scheme ≠ `exact`, or transfer method ≠ EIP-3009 (e.g. Permit2) | no |
| `too_expensive` | price > `CORI_MAX_ELIGIBLE_PRICE_USDC` (default **$0.05**) | no |
| `needs_input` | would be eligible, but POST without a usable example input | yes (flagged) |
| `eligible` | Base + USDC + exact/EIP-3009 + price ≤ cap + GET, or POST with an example input | **yes** |
| `gone` | §3 disappearance rule | no |

`classification_reasons` lists every rule that matched (e.g. `["network:base","asset:usdc","price:0.001","input:bazaar_example","facilitator:unpublished"]`), so an admin can see why at a glance. "Eligible" means *eligible for review and later verification*. **Scout itself never verifies.**

---

## 8. VPS process / service design

- **Server:** Hetzner Cloud, separate **CORTX** project, smallest shared vCPU (CX22 / CAX11), Ubuntu 24.04 LTS, IPv4 + IPv6.
- **Hardening:**
  - SSH keys only, no root login, `fail2ban`, `unattended-upgrades`
  - `ufw`: deny all incoming except SSH; outbound 443 / 53 / 123 only
- **Runtime:** Node 22 LTS. User `cori` (no sudo). Code at `/opt/cori` (git clone of this repo, read-only deploy key).
- **Code:** `agent/cori/` in this repo (open source):
  ```
  agent/cori/
    index.ts          # entry: config, advisory lock, scheduler, graceful shutdown
    scheduler.ts      # timers for source cycles, probe worker, heartbeat
    config.ts         # env + cori_sources, validated with zod
    db.ts             # Postgres pool (role cori_agent), typed queries
    sources/bazaar.ts # /discovery/resources client (paginated, capped, validated)
    normalize.ts      # canonical_url + matching keys
    probe.ts          # free probe using lib/check-runner/x402.ts + safe fetch
    classify.ts       # §7, pure
    queue.ts          # endpoint_submissions candidates, caps, idempotency
    log.ts            # JSON logs
  ```
  Reuses `lib/check-runner/x402.ts` and `ssrf.ts` directly. Built with **esbuild** into one `agent/cori/dist/cori.mjs` (new devDependency `esbuild`). New runtime dependency **`postgres`** (direct Postgres driver, for the least-privilege role).
- **Single instance:** `pg_try_advisory_lock` at startup; a second copy exits.
- **systemd:** `cori.service`
  - `Restart=always`, `RestartSec=10`, `MemoryMax=512M`
  - `NoNewPrivileges`, `ProtectSystem=strict`
  - env file `/etc/cori/cori.env` (0600, owner `cori`)
- **Deploy:** `git pull && npm ci && npm run build:cori && sudo systemctl restart cori`, scripted as `agent/cori/deploy.sh`. The founder creates the server; I provide the setup script and unit file.
- **Modes:** `CORI_DRY_RUN=1` (fetch, probe and classify, but write nothing except `cori_runs`) and `npm run cori:once` (single cycle, for testing).

---

## 9. Communication with the existing CORTX app / database

- **Cori → DB:** direct Postgres over TLS as `cori_agent`. Supabase direct connections are IPv6; Hetzner has IPv6. The Supavisor pooler with custom roles is the fallback, to confirm in Phase A. No Vercel API calls in v0.
- **App → Cori data:** server-side reads with the service role (as the admin page does today).
  - **/admin** gets a **Cori** panel: last heartbeat, last cycle stats, counts by class, recent `discovery_events`.
  - The existing **pending submissions** list shows a `Cori` badge, network/asset/price/x402 version/class/reasons/first-seen/sources, and a link to the endpoint.
  - Approve and reject use the existing `/api/admin/submissions`. After approval, the app sets `discovered_services.linked_seed_id` and logs an `approved` event.
- **Watchdog (Vercel cron, existing):** if the newest `cori_runs.started_at` is older than 30 min → admin Telegram alert (6 h cooldown, same `system_settings` pattern as the wallet alert).
- **Nothing public changes in v0:** `/registry` still shows only admin-approved `registry_seeds`.

---

## 10. Security / SSRF protections

- **Address rules are now an allow-list** (`lib/net/ip.ts`, shared with the existing runner): only public unicast addresses pass. This closes gaps in the old block-list: IPv4-mapped IPv6 (`::ffff:127.0.0.1`), 6to4, multicast and similar.
- **Tightened URL safety for Cori:** today `validateAndResolveUrl()` checks DNS once, but `fetch()` resolves again, which leaves a DNS-rebinding window. Cori uses a **pinned fetch**: an `undici` `Agent` whose `connect.lookup` rejects private/reserved addresses **at connect time** (same `ipaddr.js` rules as today). https only, blocked ports as today.
- **Redirects:** manual, ≤ 2, each hop re-validated; never follow to http or to a private address.
- **Caps everywhere:** response bodies (64 KB probes / 5 MB source pages), JSON metadata stored (16 KB), text fields (name 120 chars, description 1,000), tags (20).
- **Untrusted content:** names, descriptions and metadata from sources are data, never instructions. Stored parameterized, rendered escaped (React). Nothing is forwarded into requests except a size-capped JSON example body.
- **Secrets on the VPS:** only the `cori_agent` DB password (plus a CDP read-only API key if Bazaar needs one). **No wallet key, no service-role key, no Telegram token.**
- **Least privilege** (§4): even a fully compromised VPS can't read checks/incidents/users, can't touch spend or settings, and can't publish to the registry. It can only add candidates to a queue a human reviews.
- **Abuse safety:** per-host rate limits, an identifying User-Agent, a denylist/opt-out.

---

## 11. Logging / observability

- **JSON logs** to journald: `ts, level, run_id, component, event, host, canonical_url, duration_ms, error_code`. No secrets, no full response bodies.
- **`cori_runs`** per cycle:
  - sources polled, pages, items seen, invalid items
  - new services, changed listings
  - probes ok/failed by reason
  - class counts, candidates queued, cap hits
- **`discovery_events`** = durable per-service history (first seen, where, changes).
- **Admin Cori panel** (§9) and the **watchdog** alert. `journalctl -u cori` for live debugging.

---

## 12. Failure / retry behavior

| Failure | Behavior |
|---|---|
| Source fetch error / 5xx / timeout | retry 3× (2 s, 4 s, 8 s), then record `cori_runs.ok=false` for that source; other sources continue; next cycle retries |
| Source returns malformed items | skip the item, count `invalid_items`, continue |
| Probe failure | backoff 1 h → 6 h → 24 h; classify `unreachable` after 3 consecutive failures |
| DB connection lost | exponential reconnect (max 60 s); no work lost (idempotent upserts); heartbeat gap triggers the watchdog if > 30 min |
| Process crash | systemd restarts in 10 s; the advisory lock releases on disconnect |
| Two instances started | the second fails `pg_try_advisory_lock` and exits cleanly |
| Queue cap reached | leftover candidates wait for the next day, oldest first |
| Poison item (parser throws) | classified `invalid_terms` with a reason; not re-probed until the listing changes |

All writes are idempotent (`ON CONFLICT` on `canonical_url` / primary keys), so any step can be retried safely.

---

## 13. Tests

Same stack as today (`npm test`, Node test runner, `test/` hooks):
- **Unit (pure):**
  - `normalize` (canonicalization cases, tracking params, trailing slashes, IDN)
  - `classify` (full matrix of §7, ordering, reasons)
  - Bazaar item parsing (v1 and v2 fixtures, malformed, oversized)
  - config validation, queue cap/idempotency logic
- **Safety:**
  - the pinned fetch rejects a host that resolves to a private IP at connect time (rebinding simulated with a custom resolver)
  - redirects to http/private are refused
  - body caps are enforced
- **Integration (end to end):** a fake Bazaar server and fake x402 endpoints (V1 body, V2 header, POST-with-example, non-402, too expensive, Permit2, unreachable) → one full cycle into a Postgres 16 database with migration 023 applied. Asserts:
  - rows, events and classes
  - queue inserts, and **no duplicate submissions on a second cycle**
  - a rejected candidate isn't re-queued without a material change
  - **fake endpoints assert no payment header was ever received**
- **Migration** (Postgres 16): re-run safe; the `cori_agent` role **cannot** read `checks`/`incidents`, update `registry_seeds`, or insert non-allowed submission columns.
- **First live run** in `CORI_DRY_RUN=1`, reviewed before switching writes on.

---

## 14. Implementation phases (one PR each; the founder approves each)

| Phase | Deliverable | Needs from founder |
|---|---|---|
| **A. Groundwork** | Confirm the Bazaar URL/auth/fields; migration 023 + `cori_agent` role; pinned fetch; `normalize` + `classify` with unit tests | Run the migration; set the role password |
| **B. Scout core** | `agent/cori/` sources, pipeline, probe, queue, scheduler, logs; integration tests; `cori:once` + dry-run | — |
| **C. Admin + watchdog** | Cori panel, candidate metadata in the submissions list, approve → link back, heartbeat watchdog | Merge |
| **D. VPS go-live** | Setup script, systemd unit, deploy script; first run in dry-run, then live | Create the Hetzner CORTX project + server, add SSH/deploy keys, fill `/etc/cori/cori.env` |
| **E. Observe 1 week** | Review the queue; tune caps/cadence; write down the real numbers (how many eligible services exist) in NOTES | Review candidates |

Estimated: A–C about a week of build; D a day with the founder; E one week of running.

---

## 15. Explicitly NOT built in v0

- ❌ Any payment, paid check, or verification request (Phase 3 Verifier/policy queue comes later)
- ❌ Readiness `/verify` from the VPS: it needs a signed authorization, and the VPS has no wallet
- ❌ Observer baselines beyond the discovery probe (latency distributions, schema learning), anomaly detection, reproduction, incidents
- ❌ Provider notifications
- ❌ Any public output: Reliability Index, counts, pages, posts, badges. `/registry` changes only through human approval.
- ❌ Scores or rankings
- ❌ Any LLM
- ❌ Auto-approval into the registry
- ❌ Scraping competitor data (ScoutScore) or directory websites; on-chain crawling
- ❌ MCP / preflight API
- ❌ Changes to existing monitoring, the paid-check path, the wallet, or spend caps (only the watchdog is added to the cron)
- ❌ Merging the older onboarding `detect` parser into `x402.ts` (worth doing, separate cleanup)
- ❌ HA / multi-region

---

## Decisions (approved Sep 28, 2026)

1. Eligible price cap: **$0.05** per call (`CORI_MAX_ELIGIBLE_PRICE_USDC`)
2. Daily queue cap: **25** new candidates/day
3. Sources at start: **CDP Bazaar only**, others added later via `cori_sources`
4. DB access: dedicated **`cori_agent`** least-privilege role (no service-role key on the VPS)
5. User-Agent contact: the **GitHub repo** for now; an "About Cori / opt-out" page later

## Phase A status (built)

- `supabase/migrations/023_cori_scout.sql`: tables, queue link, `cori_agent` role + RLS policies. Verified on Postgres 16 (re-runnable; the role can't read checks/incidents/private columns, can't approve, can't write the registry, and can only queue `cori_scout` + `pending`, once per service).
- `lib/net/ip.ts`: shared allow-list address rules (now also used by the existing runner).
- `lib/net/safe-fetch.ts`: connect-time DNS pinning, re-validated redirects that never replay a body, body/time caps.
- `lib/cori/normalize.ts`, `lib/cori/classify.ts`, `lib/cori/bazaar.ts`: pure pipeline pieces.
- `selectPaymentOption` / `NETWORK_ALIASES` / `isUsdcAsset` moved into `lib/check-runner/x402.ts`, so the runner, readiness and Scout share one rule.
- Tests: 61 total (31 new: normalization, full classification matrix, Bazaar V1/V2 parsing and caps, IP rules, safe-fetch against a real local HTTPS server incl. DNS rebinding).
