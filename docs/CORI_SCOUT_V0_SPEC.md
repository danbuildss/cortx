# Cori Scout V0 — Technical Spec (v2, re-audited against the canonical brief)

**Status:** v2 **APPROVED Oct 5, 2026** ("approve spec v2, all 4 recommendations"). v1 (Sep 28) is built and merged (Phases A–C, #114–#117). **Phase B2 built** (Oct 5, see the status at the end). Nothing is running yet: Phase D, the server, comes next.
**Source of truth:** [`CORI_BRIEF.md`](CORI_BRIEF.md) (canonical brief, Oct 5) + [`DATA_COMPOUNDS.md`](DATA_COMPOUNDS.md).
**Scope:** discovery only. Zero USDC. No public failure claims. No LLM.

Legend used throughout: ✅ built and stays · 🔧 change proposed before go-live (Phase B2) · ⏳ later phase, not Scout V0.

---

## Summary

Scout V0 is **already specified, built and tested** (Sep 28, including a full pipeline run against a fake Bazaar and fake x402 services, and a run on real Postgres as the least-privilege role). It reads the Coinbase (CDP) Bazaar, classifies listings with fixed rules, sends free probes that can never pay, and puts up to 25 candidates a day into the existing admin review (`/admin/cori`).

I re-audited the built code against the brief. Most of it holds, but it falls short of the brief in **memory** and in four smaller places. It also has two security details to tighten and one wrong assumption about the Bazaar. I recommend fixing these **before** Cori goes live, because history that isn't recorded from day one can't be recovered later:

| # | Gap found | Brief / principle | Fix (Phase B2) |
|---|---|---|---|
| G1 | Each probe **overwrites** `last_probe`. Only "something changed" events survive, so there is no history of latency, failures or terms between changes. | §14 Memory, V0 item 14, DATA COMPOUNDS "append, don't overwrite", "record couldn't check" | New append-only `discovery_observations`: one row per probe, failures included |
| G2 | Each listing **overwrites** the stored listing (`accepts`, metadata, description). A `listing_changed` event says *that* it changed, not *what* changed. | §12 provenance, DATA COMPOUNDS | New `discovery_listings`: a new row only when the listing's content changes (content-addressed, cheap) |
| G3 | `discovery_events` and `discovery_sources_seen` are `on delete cascade` from `discovered_services` | DATA COMPOUNDS "never hard-delete evidence" | Change to `restrict` (like migration 026 did for checks) |
| G4 | The Bazaar spec has **dynamic routes** (`routeTemplate`, e.g. `/users/:id`) and methods we don't handle (HEAD, DELETE, PUT, PATCH). A DELETE-only endpoint gets a GET probe and is wrongly classed `not_x402`. | §12 normalize/dedupe, §7 false positives | Identity uses `routeTemplate` when present. New class `unsupported_method` (never probed, never sent). |
| G5 | A POST probe forwards the **listing's example body**, which a third party controls (the Bazaar spec itself warns that listings can be poisoned), to whatever URL the listing names | §27 SSRF / abuse | POST probes send `{}` only. Never forward third-party bodies. |
| G6 | Ports: any public port except 8 blocked ones is allowed | §27 "unusual ports" | Cori probes port **443 only**. Anything else is classed `blocked` with reason `port`. |
| G7 | The Bazaar is read from offset 0 every pass with a fixed page cap. If it grows past 20k items, the tail is never seen. | §12 discovery | Paginate to the reported `total`, with a hard cap of 50k items; the stats record any truncation |
| G8 | The `disappeared` event exists but is never written. Listing-level classes (e.g. `unsupported_network`) can never become `gone`. | §12 "how long has CORTX observed it" | A daily sweep writes `disappeared` (and later `reappeared`) from `last_seen_at` |
| G9 | Runs and observations don't record **which Cori code** produced them | DATA COMPOUNDS "reconstructable" | `cori_version` (git SHA) on every run and observation |
| G10 | The v1 spec says Bazaar lists a service "only after a successful mainnet payment". **The x402 spec doesn't say that.** A facilitator catalogs a listing when it *receives a payment payload*. | §7, §G below | Corrected here. A listing is a lead, never evidence that a service works. |
| G11 | The v1 firewall plan allowed outbound 443/53/123 only, but Cori talks to Supabase Postgres on **5432 / 6543** | §26 deployment | The Phase D firewall allows those ports, to the Supabase host only |

Phase B2 is about one PR: migration `027`, about 300 lines of code and tests. It doesn't change Phases A–C or the admin pages.

**Decisions (approved Oct 5, all four as recommended):**
1. **Do B2 before go-live** (recommended, about a day), or go live now and add memory after. The cost of waiting: the first days of observations are lost for good.
2. **Store the raw pay-to address** of discovered services (recommended). It's public on-chain data and the 402 response already shows it. The Investigator will need it to trace settlement. Today Cori keeps only a fingerprint (the earlier "no raw address in logs" rule was about logs).
3. **POST probes never forward third-party bodies** (recommended, G5). Services that price by request body then land in `needs_input` for a human to look at.
4. **Port 443 only** (recommended, G6). Phase E counts how many listings this excludes.

---

## Answers to the brief's questions A–H

### A. What is the smallest useful Scout we can ship?

What's built, plus G1–G3 (memory), deployed in one process on the VPS with **one source (CDP Bazaar)**:
- reads the whole Bazaar every 6 h
- keeps every listing version, every probe result and every change, from day one
- classifies with fixed rules
- puts up to 25 candidates a day into `/admin/cori` for you to approve or reject

Its first deliverable is a fact we don't have: *how many real, cheaply verifiable x402 services on Base exist, where they came from, and since when*. Its second is a reviewed queue.

Even smaller: the first **dry run** (`CORI_DRY_RUN=1 --once`) writes nothing except its run log. That alone answers the counts and confirms the live Bazaar fields. That's step 1 of Phase D.

### B. What existing CORTX code do we reuse instead of rewriting?

| Reused (already wired) | Where |
|---|---|
| x402 parsing for V1 body / V2 `PAYMENT-REQUIRED` header, Base+USDC option choice, price in atomic units → USDC, facilitator detection, network aliases | `lib/check-runner/x402.ts` (`parsePaymentRequired`, `selectPaymentOption`, `priceToUsdc`, `findFacilitatorUrl`, `NETWORK_ALIASES`, `isUsdcAsset`) — the same rule as the paid runner |
| Public-address rules (allow-list) | `lib/net/ip.ts`, shared with the runner |
| SSRF-safe fetch: connect-time DNS pinning, re-validated redirects, caps | `lib/net/safe-fetch.ts` (the runner now uses the same rules via `checked-fetch.ts`, #119) |
| The admin review queue | `endpoint_submissions` + `/api/admin/submissions` (approve → `registry_seeds`, reject with reason) |
| Admin UI | `/admin/cori`, sidebar health dot, candidate cards (#117) |
| Heartbeat alert | `/api/cron` watchdog → Telegram, state in `system_settings` |
| Stable JSON + hashing, zod validation, test hooks and fakes | `lib/cori/bazaar.ts`, `agent/cori/fake-ecosystem.ts`, `test/hooks.mjs` |
| Migration conventions (re-runnable, revoke functions, no temp tables) | `supabase/migrations/023`, `026` |

**Deliberately not reused in V0:**
- **The paid check runner.** Scout never pays. The Verifier will reuse it later through a DB queue → Vercel, never a second payment stack.
- **Readiness `/verify`.** It needs a signed authorization, which needs a wallet.
- **The older onboarding `detect` parser.** A separate cleanup.

### C. What new database state is genuinely necessary?

Already live: migration 023, run Sep 28. That's 6 tables plus 3 columns on `endpoint_submissions`.

New in 027, and only this:
- `discovery_observations`: append-only, one compact row per probe (G1)
- `discovery_listings`: one row per distinct listing version per source (G2)
- columns:
  - `discovered_services.route_template`, `pay_to` (if decision 2), `source_last_updated`
  - `cori_runs.cori_version`
- FK changes from cascade to restrict (G3)

**Not needed:**
- a separate candidates table: `discovered_services.classification` is the state
- a job/queue table: `next_probe_at` is the probe queue, and `endpoint_submissions` is the review queue
- Redis, or a second database

### D. What security risks come from probing arbitrary third-party URLs?

| Risk | Mitigation (✅ built · 🔧 B2) |
|---|---|
| SSRF to localhost, private ranges, link-local, cloud metadata (`169.254.169.254`, `metadata.google.internal` → link-local), CGNAT, IPv6 ULA/link-local, NAT64, 6to4, IPv4-mapped IPv6 | ✅ allow-list: only addresses `ipaddr.js` classifies as public unicast pass. IP literals are checked before connecting, hostnames at connect time. |
| DNS rebinding (public at check time, private at connect time) | ✅ The check runs inside the socket's DNS lookup, so the address checked is the address connected to. A test simulates rebinding. |
| Redirect to a private address or to http | ✅ manual redirects, at most 2, every hop re-validated, never replays a body |
| Unusual ports (SSH, SMTP, databases, internal admin panels) | 🔧 443 only (G6), plus the firewall allows outbound 443 only for web traffic |
| Malformed or credential-carrying URLs, non-https | ✅ refused (`INVALID_URL`, `CREDENTIALS_IN_URL`, `NON_HTTPS`) |
| Slow or huge responses, decompression bombs | ✅ 10 s total timeout, 64 KB probe cap / 5 MB source page cap, no `accept-encoding` sent (no automatic decompression), Node's 16 KB header cap |
| Cori used as a reflector against a victim (a poisoned listing names someone else's URL) | ✅ GET only by default, at most once per 24 h per URL and 30 per hour per host, identifying User-Agent, denylist/opt-out · 🔧 no third-party bodies (G5) · 🔧 global probe budget (`CORI_MAX_PROBES_PER_HOUR`, default 600) |
| Catalog flooding (someone lists 100k junk URLs) | ✅ listing-first classification: only listings that pass on paper (Base, USDC, exact, ≤ $0.05) get a probe; per-host limits · 🔧 hard cap of 50k items per pass, global probe budget |
| Hostile text in listings (names, descriptions, metadata) | ✅ length caps, control characters stripped, stored as parameters, rendered escaped by React. Never treated as instructions, never fetched (e.g. `iconUrl`). |
| A compromised VPS | ✅ nothing to steal: no wallet key, no service-role key, no Telegram token. `cori_agent` can't read checks, incidents, users or spend, can't approve, can't touch the registry, and can only insert `pending` candidates. 🔧 Cori refuses to start if any env var looks like a key (`*PRIVATE_KEY*`, `*SERVICE_ROLE*`, `*WALLET*`). |
| Abuse complaints against our IP | ✅ User-Agent with a contact link, a denylist honoured on the next pass, low request rates |

### E. How do we stop Scout from polluting the real reliability dataset?

- **Separate tables, enforced by the database.** Scout writes only `discovered_services`, `discovery_*`, `cori_runs` and pending rows in `endpoint_submissions`. The `cori_agent` role has **no** grant on `services`, `checks` or `incidents`, and can't read them either. This is a database permission, not a coding convention.
- **Nothing public is computed from Cori's tables.** Uptime, success rates, the reliability API, `/status`, badges and the registry's numbers come from `checks`. Only `/admin/cori` reads Cori's tables.
- **Only a human promotes.** Approve → `registry_seeds` (public, labelled "Observed", unverified, with no reliability numbers). A `services` row (monitored, paid checks) is still created by a person, through the existing flow.
- **Separate labels.** Admin counts keep people's submissions apart from Cori's (`source = 'cori_scout'`). Every Cori record carries `evidence_state = 'observed'`.

### F. Where are the boundaries between a discovered candidate, an observed service and a CORTX-verified service?

```
DISCOVERED CANDIDATE          OBSERVED SERVICE              CORTX-VERIFIED SERVICE
discovered_services           (Observer V1 — later)          services + checks
private (admin only)          private until reviewed         public evidence
"a source listed it; a        "we have a baseline of free    "a real paid check passed:
 free probe returned these     observations over time"        payment → settlement receipt
 terms"                                                        → delivery → schema"
evidence_state = observed     evidence_state = observed      evidence = checks rows
written by: Cori              written by: Cori               written by: Vercel runner,
                                                              under spend caps
            │ human approves                                       ▲
            ▼                                                      │ human creates
     registry_seeds  — public listing "Observed", no numbers ──────┘ a monitored service
```

Rule: **a claim moves right only on new evidence, and in V0 only through a human.** Scout never sets `reproduced`, `confirmed` or `resolved`. Those belong to the Investigator, later.

### G. What do the discovery sources actually provide, and what are we assuming?

Checked against the official x402 specs (`specs/x402-specification-v2.md` §8, `specs/extensions/bazaar.md`, x402-foundation/x402, Oct 5). The CDP API itself is blocked from my build container, so its live response is confirmed on the first dry run.

| Field / behaviour | Spec says | Our status |
|---|---|---|
| `GET /discovery/resources` with `type`, `payTo`, `scheme`, `network`, `extensions`, `limit` (1–100), `offset` | Defined (§8.1) | ✅ used. CDP URL and "no API key" were confirmed Sep 28 |
| Item fields `resource`, `type`, `x402Version`, `accepts[]`, `lastUpdated` | Required (§8.3) | ✅ parsed. 🔧 store `lastUpdated` |
| `extensions.bazaar.info.input` (method, queryParams/body, bodyType) and `info.output` (type, example) | Optional. Facilitators must validate them against the listing's own schema. | ✅ parsed leniently. V1 equivalent `accepts[].outputSchema` also read. 🔧 keep `output` as well (G2 listing rows keep the whole extension, capped) |
| `routeTemplate` for dynamic routes (`/users/:userId`) | Defined, it's the catalog key | ❌ ignored today → 🔧 G4 |
| Methods HEAD / DELETE / PUT / PATCH and `type: mcp` | Defined | MCP skipped (✅ `type=http`). Other methods → 🔧 `unsupported_method` |
| `serviceName`, `tags`, `iconUrl`, `description`, `mimeType` on items | **Not in §8.3.** They're defined on the 402's `resource` object. Whether CDP echoes them on items is unconfirmed. | ✅ optional. Name falls back to host + path |
| `pagination.total` | In the example response | ✅ read. 🔧 used to paginate to the end (G7) |
| Listed only after a successful payment | **Not stated.** A facilitator catalogs when it *receives a payment payload* (verify or settle) that includes the extension. | 🔧 v1 claim removed (G10). A listing is a lead, not evidence. |
| Listings removed when a service dies | **Not specified.** "Resources can be added, updated, or removed dynamically." No tombstones. | Absence over 7 days of passes → `disappeared`. A single missing pass means nothing, because offset paging over a changing list can skip items. |
| Rate limits | Not specified | Unknown → first dry run. ✅ 3 retries with backoff on 429/5xx, 30 min source cool-down |
| Listing content trustworthy? | No. The spec calls the facilitator a trust boundary and warns of catalog poisoning. | ✅ all listing content is untrusted data (§D) |

The other sources (Aeon's, ScoutScore, directory sites, GitHub awesome-lists) **aren't in V0**. CORTX's own records (services, seeds, submissions) are used only to deduplicate, and people's submissions keep using the existing form.

### H. How do we test Scout without spending USDC?

1. **There is no payment code in Cori at all.** No wallet, no signing library, no key in the environment. 🔧 Add a test that the built `cori.mjs` bundle contains no `viem` signing / `x402/client` modules (esbuild metafile check), and the env refusal rule from §D.
2. ✅ **Fake ecosystem:** a fake Bazaar plus 15 fake x402 services (V1 body, V2 header, POST, non-402, too expensive, Permit2, unreachable…). Every fake service **asserts that no payment header ever arrives**.
3. ✅ **Real Postgres as `cori_agent`** (Postgres 16, production-shaped schema): the permissions are enough for Scout and still restrictive.
4. ✅ **Unit tests:** normalization, the full classification matrix, Bazaar V1/V2 parsing and caps, IP rules, safe-fetch against a real local HTTPS server, including DNS rebinding.
5. 🔧 **New tests for B2:** observations append on every probe (including failures), listing versions only on change, no cascade deletes, `routeTemplate` identity, `unsupported_method`, POST without third-party body, port 443 only, pagination to `total`, `disappeared` sweep, version stamp.
6. **Live, without spending:** dry run on the VPS (writes nothing but its run log) → you review the numbers → live run. Probes are free by construction. The only "cost" is our requests to third parties, which are rate-limited.

---

## 1. Current CORTX components Scout reuses
See B. Also: `cori_sources` (sources switch on/off without a deploy), `cori_denylist` (opt-out), `system_settings` (watchdog state).

## 2. Architecture

```
                 ┌──────────── CORI VPS (Hetzner, CORTX project) ─────────────────┐
 CDP Bazaar ────►│ cori (one Node 22 process, systemd)                              │
 (public)        │  scheduler ─► source pass ─► normalize ─► dedupe/link ─► classify │
                 │        └─► probe worker (free, never pays) ─► classify ─► queue   │
                 │  memory: listings · observations · events (append-only)          │
                 └──────────────────────────┬─────────────────────────────────────┘
                                            │ Postgres/TLS as `cori_agent` (least privilege)
                                            ▼
     Supabase: discovered_services · discovery_listings · discovery_observations ·
               discovery_events · discovery_sources_seen · cori_runs · cori_sources ·
               cori_denylist · endpoint_submissions(source='cori_scout', pending only)
                                            ▲
     Vercel (unchanged wallet/payment path): /admin/cori review · approve → registry_seeds
                                             cron watchdog → Telegram if Cori goes quiet
```

In the brief's terms, **one process** (§11, §26): `scout` = sources + normalize + classify + queue; `scheduler` = the tick loop; `policy` = fixed caps in config (price cap, daily queue cap, probe budget, per-host limits). `observer` and `investigator` come later, as modules in the same process.

## 3. Discovery sources
✅ **CDP Bazaar only**, as approved Sep 28. More sources are configuration (`cori_sources`) plus an adapter. Candidates for later, each needing its own approval: other facilitators' `/discovery/resources` (same contract, so no new adapter), and ecosystem lists that have an official API or clear terms. Not used: ScoutScore's data (competitor dependency), scraping directory sites, on-chain crawling.

## 4. Source adapters
An adapter yields raw items. Parsing, normalization and classification are shared. ✅ `agent/cori/sources/bazaar.ts`: paginated, zod-validated per page, 5 MB page cap, 3 retries (2/4/8 s) on 429/5xx/network errors, fatal on other 4xx or SSRF refusal. 🔧 Paginate to `pagination.total`, with a hard cap of 500 pages × 100. A new adapter must output the same `Listing` shape (`lib/cori/bazaar.ts`), so the rest of the pipeline is unchanged.

## 5. Discovery scheduling
- ✅ Tick every 30 s. Each source is due every `interval_minutes` (Bazaar 360 = every 6 h). A failed source retries after 30 min. One source failing never stops the others.
- ✅ The probe worker runs every tick on due rows (`next_probe_at <= now`, batch 200, concurrency 4):
  - new or changed listing → now
  - healthy → every 24 h
  - failures back off 1 h → 6 h → 24 h
- 🔧 Global probe budget of 600 per hour.
- 🔧 Daily sweep: `disappeared` / `gone`.

## 6. Normalization
✅ `canonicalUrl()`:
- https only
- lowercase scheme and host (punycode)
- drop the default port, fragment, credentials and tracking params
- collapse `//`
- strip one trailing slash
- sort the query

✅ Untrusted text: names ≤ 120 characters, descriptions ≤ 1,000, at most 20 tags of ≤ 40 characters, metadata ≤ 16 KB, examples ≤ 8 KB.

🔧 When a listing has a `routeTemplate`, also store `route_template` and use `origin + template` as the identity (§7).

## 7. Endpoint identity / deduplication
- ✅ Identity is `canonical_url` (unique).
- ✅ Matched against CORTX `services`, `registry_seeds` and `endpoint_submissions`, each canonicalized at match time → `already_monitored`, `already_listed` or `already_submitted`. These are never queued.
- ✅ Related URLs (same host+path with a different query, or the same pay-to) are grouped, not merged.
- ✅ One pending submission per discovered service (unique index). A rejected candidate is never re-queued automatically in V0.
- 🔧 **Dynamic routes:** `/users/123` and `/users/456` from the same template are one service. Identity: `canonicalUrl(origin + routeTemplate)`. The concrete URL is kept as the probe URL.
- **Not merged:** different methods on the same URL. They're rare; Phase E counts them.

## 8. Provenance / history (the memory)
Per service:
- ✅ `first_seen_at`, `first_source`, `last_seen_at`
- ✅ per source: first/last seen and listing hash (`discovery_sources_seen`)

Append-only:
- ✅ `discovery_events`: first_seen, listing_changed, price_changed, terms_changed, probe_status_changed, classification_changed, queued, approved, rejected, reappeared
- 🔧 `disappeared` actually written
- 🔧 **`discovery_listings`** (G2): `(discovered_service_id, source, listing_hash)` unique, with `first_seen_at`, `last_seen_at`, `source_last_updated`, `x402_version`, `accepts` (jsonb), `resource_meta` (name / description / tags / mime), `extensions` (capped 16 KB). A new row only when the content changes, so a stable service costs one row ever. `listing_changed` events carry `{from_hash, to_hash}`.
- 🔧 **`discovery_observations`** (G1): one row per probe. Columns:
  - `at`, `outcome` (ok / unreachable / not_x402 / invalid_terms / blocked), `error_code`
  - `http_status`, `latency_ms`, `method`
  - `terms_source` (body / header), `x402_version`, `network`, `asset`, `scheme`, `transfer_method`
  - `price_atomic`, `price_usdc`
  - `pay_to` (or fingerprint, per decision 2), `facilitator_published`
  - `cori_version`

  No bodies are kept (the terms are extracted), and no request headers (we send only a User-Agent).

What stays a **cache** (allowed by DATA COMPOUNDS, since the history above makes it rebuildable): `discovered_services` current facts, `last_probe`, `classification`, `next_probe_at`.

## 9. Free probing
- ✅ **Never pays.** It never sends `X-PAYMENT` / `PAYMENT-SIGNATURE`, has no wallet, sends no cookies or auth, and the only headers are User-Agent, Accept and (for POST) Content-Type.
- ✅ **GET first.** POST only if GET didn't return 402 and the listing declares POST.
  - 🔧 The POST body is `{}`, never the listing's example (G5).
  - 🔧 HEAD / DELETE / PUT / PATCH → not probed, class `unsupported_method`.
- ✅ **Limits:** 10 s total, 64 KB body, at most 2 redirects. 🔧 Port 443 only.
- ✅ **Politeness:** per host, 1 at a time, ≥ 2 s apart, ≤ 30 an hour. 🔧 Global 600 an hour.
- ✅ **Recorded:** status, latency, where the terms came from, version, the chosen option, price, whether a facilitator is published. 🔧 Every probe also goes into `discovery_observations`.

## 10. Eligibility classification
✅ Deterministic, in order. The first failing rule decides the class, and every matched rule is listed in `classification_reasons`.

`blocked` → `gone` → `already_monitored` / `listed` / `submitted` → `unreachable` (after 3 failures in a row) → `not_x402` → `invalid_terms` → `unsupported_network` (Base mainnet only) → `unsupported_asset` (USDC) → `unsupported_scheme` (exact + EIP-3009) → `too_expensive` (> $0.05) → `pending` (passes on paper, waiting for a probe) → `needs_input` (POST without a usable example) → `eligible`.

🔧 New: `unsupported_method` (after the `already_*` classes). 🔧 New `blocked` reason: `port`.

"Eligible" means **eligible for human review and later verification**. Scout itself never verifies.

## 11. Database / schema changes
- ✅ Live: migration 023.
- 🔧 New: `027_cori_memory.sql`. Additive only, re-runnable, no existing rows changed:
  - the two append-only tables in §8
  - the 4 columns listed in C
  - FKs from `discovery_events` and `discovery_sources_seen` changed to `restrict`
  - `cori_agent` gets `select, insert` on the new tables (no update or delete on observations, so the agent itself can't rewrite history), `insert`/`update(last_seen_at)` on listings, and update on the new columns
- **Size estimate** (to confirm in Phase E):
  - listings ≈ 16k × ~3 KB ≈ 50 MB once, then only changes
  - observations ≈ 200 B × (services passing on paper) per day. For example 2,000/day ≈ 0.4 MB/day ≈ 150 MB/year.
  - **On Supabase's free plan (500 MB) this is the main cost risk.** If it gets close, either keep observations per change plus one a day (still history), or move to Supabase Pro ($25/month). I'll report real numbers after a week.

## 12. Integration with the existing admin review
✅ Built (#117), no change:
- Candidates are `endpoint_submissions` rows with `source = 'cori_scout'` and `candidate_metadata`: price, network, version, method, reasons, first seen, sources, `evidence_state: observed`.
- `/admin/cori` shows them as cards with Approve / Reject.
- Approve → `registry_seeds` (labelled "Observed" on `/registry`) + `approved` event.
- Reject → `rejected` event with the reason.
- `/admin` shows only people's submissions, plus "N found by Cori →".

## 13. Cori VPS process architecture
✅ One Node 22 process: `agent/cori/index.ts`, bundled by esbuild into one file `agent/cori/dist/cori.mjs`.
- config validated with zod
- a Postgres advisory lock (a second instance exits)
- the tick loop and a heartbeat row every 5 min
- SIGTERM → finishes the current step and exits
- `--once` and `CORI_DRY_RUN=1` modes

🔧 Pass a stop signal into the probe batch, so shutdown doesn't wait for up to 200 probes.

## 14. Communication with Supabase / CORTX
✅ Direct Postgres over TLS as `cori_agent`. Supabase direct connections are IPv6, and Hetzner servers have IPv6. Fallback: the Supavisor session pooler (`cori_agent.<project-ref>` user). This gets confirmed during Phase D.

Cori never calls Vercel. Vercel reads Cori's tables with the service role (admin pages, watchdog). Later, paid-check *requests* will go Cori → DB → Vercel, never a key on the VPS (brief §10).

## 15. Authentication / permissions
✅ `cori_agent` (migration 023):
- select/insert/update on Cori's own tables
- select on a few id/url columns of `services`, `registry_seeds` and `endpoint_submissions`
- insert into `endpoint_submissions` only for allowed columns, and only `source = 'cori_scout'`, `status = 'pending'` (RLS policy)
- nothing else

The password is set by you in Supabase, stored in your password manager and in `/etc/cori/cori.env` (mode 0600, owner `cori`). Never in chat or GitHub.

VPS access: SSH keys only, no root login, user `cori` without sudo. The repo is pulled with a read-only deploy key, or anonymously since it's public.

## 16. SSRF / network protections
See D. Two layers:
- **in code:** an allow-list of addresses checked at connect time, https only, port 443, re-validated redirects, caps
- **on the server:** `ufw` denies all incoming except SSH. Outbound is denied by default, except 53 (DNS), 123 (time), 67/udp (DHCP), 80 (Ubuntu mirrors), 443 (web) and 5432/6543 (Supabase Postgres, G11). Private, shared and link-local ranges are refused before any allow rule. Postgres isn't pinned to Supabase's IPs because they change (a Phase D deviation from v2, decided Oct 5); the code-level 443-only rule means probes can't reach those ports.

Cloud metadata (`169.254.169.254`) is blocked in code, and isn't reachable as a web target through the firewall either.

## 17. Rate limiting
Per host: 1 in flight, ≥ 2 s apart, ≤ 30 an hour (over the cap → rescheduled in an hour, not dropped). 🔧 Global: 600 probes an hour. Source: one pass per 6 h, a 30 min cool-down after a failure, and 3 retries with backoff inside a pass. Queue: ≤ 25 new candidates per UTC day.

## 18. Concurrency
4 probe workers (configurable 1–16). One source pass at a time. One process (advisory lock). A Postgres pool of 4 connections.

## 19. Retry / backoff
| Failure | Behaviour |
|---|---|
| Source page error / 429 / 5xx / timeout | retry 2 s, 4 s, 8 s → the pass fails, `cori_runs.ok=false`, retried in 30 min |
| Malformed item | skipped and counted (`invalid_items`) |
| Probe failure | backoff 1 h → 6 h → 24 h; `unreachable` after 3 in a row. 🔧 Every attempt recorded as an observation. |
| DB lost | the cycle fails and is logged; the next tick retries; all writes are idempotent |
| Crash | systemd restarts in 10 s; the lock is released when the connection drops |
| Queue cap reached | the rest wait for the next UTC day, oldest first |

## 20. Logging
✅ JSON lines to journald: `ts, level, app, component, event, source, canonical_url, error, duration`. No secrets, no response bodies. 🔧 `cori_version` on startup. journald capped at 500 MB (`SystemMaxUse`). Debug with `journalctl -u cori -f`.

## 21. Metrics / health
- ✅ The health check is **external and doesn't need an open port**:
  - a heartbeat row every 5 min
  - the Vercel cron watchdog sends Telegram after 30 min of silence (at most every 6 h) and a "back" message on recovery
  - `/admin/cori` health dot: green < 10 min, amber < 30, red after that
- ✅ Per-run stats in `cori_runs.stats`: pages, items, invalid, new, changed, class counts, probes by outcome, queue counts, cap hits.
- 🔧 `duration_ms` and `cori_version` on each run.

## 22. Failure handling
See 19. One more rule: **Cori failing never affects CORTX.** Monitoring, the paid path and the public pages don't depend on Cori. If Cori stops, the only effects are a Telegram alert and no new candidates.

## 23. Testing
See H. Today the suite runs 116 tests (115 pass, 1 skipped: the real-Postgres test runs only when a disposable database URL is set). B2 adds about 15–20.

## 24. Deployment (Phase D)
1. **You:** create the Hetzner project "CORTX" and a small server (shared vCPU, 2 vCPU / 4 GB, Ubuntu 24.04), in the region nearest the Supabase project. Add your SSH key.
2. **Me:** these files, all built Oct 5:
   - `ops/cori/setup.sh`: admin user `cortx` with your key, root/password SSH off, firewall, fail2ban, unattended-upgrades, Node 22 from nodejs.org with checksum verified, user `cori`, read-only clone, journald cap
   - `ops/cori/cori.service` and `ops/cori/cori-dryrun.service`
   - `ops/cori/deploy.sh [<git-sha>]`: fetch → `npm ci --ignore-scripts` → `npm run test:cori` → `npm run build:cori` → restart; a failed test deploys nothing
   - `ops/cori/README.md`: the founder's step-by-step guide
3. **systemd hardening:**
   - `Restart=always`, `RestartSec=10`, `TimeoutStopSec=60`
   - `MemoryMax=512M`, `CPUQuota=50%`, `TasksMax=64`
   - `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`
   - `CapabilityBoundingSet=` (empty), `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX`
   - `EnvironmentFile=/etc/cori/cori.env`
4. **You:** set the `cori_agent` password in the Supabase SQL editor (`alter role cori_agent with login password '…'`) and paste it into `/etc/cori/cori.env` on the server. It never goes in chat.
5. **Dry run:** `systemctl start cori-dryrun`, a oneshot unit that forces `CORI_DRY_RUN=1` on its command line, so nothing in the env file can turn it off. We look at the counts and the live Bazaar fields together. If a field name differs, I fix the parser first.
6. **Live:** `systemctl enable --now cori`. The watchdog and `/admin/cori` turn green.

## 25. Rollback
- **Stop instantly:** `systemctl stop cori`. Nothing public depends on it.
- **Cut access from Supabase without the server:** `alter role cori_agent nologin;` (and terminate its sessions).
- **Previous code:** `deploy.sh <previous-sha>`.
- **Disable one source:** `update cori_sources set enabled = false where id = 'cdp_bazaar'`.
- **Unwanted candidates:** reject them in `/admin/cori`.
- **Database:** 027 is additive. Rolling back means leaving the tables (no drops, per DATA COMPOUNDS) and running the previous code, which ignores them.

## 26. Implementation phases (one PR / session each, each approved by you)
| Phase | What | Needs from you | Status |
|---|---|---|---|
| A | Groundwork: migration 023, role, safe fetch, normalize, classify | run 023 ✅ | ✅ merged |
| B | Scout process, pipeline, stores, tests | — | ✅ merged |
| C | `/admin/cori`, review write-back, watchdog | — | ✅ merged |
| **B2** | G1–G11: migration 027 (memory, no cascades), route templates, methods, POST body, port 443, pagination, disappeared sweep, version stamp, env refusal, bundle test, probe budget, stop signal | merge; run 027 | ✅ built (PR open) |
| **D** | Server go-live: setup script, unit, deploy script; dry run → live | Hetzner project + server, role password, about an hour together | scripts ✅ built (rehearsed: clean install with `--ignore-scripts`, Cori tests, build); server waiting on you |
| **E** | Observe 1 week: review the queue, record real numbers in NOTES (listings, pass-on-paper, eligible, DB growth/day, pass duration) | review candidates | — |
| next | Separate spec: **Observer V1** (baselines and change detection on the observations B2 starts collecting) | — | ⏳ |

## 27. Estimated operating cost
- **USDC:** $0. Scout can't pay.
- **Hetzner:** a small shared-vCPU server with an IPv4 address is about €5–8/month (exact price at order time; Hetzner changed prices in 2025–26). The included traffic (≥ 20 TB) is far above our use. A Bazaar pass is about 16k items × ~2 KB ≈ 30 MB, so 4 a day ≈ 4 GB/month.
- **Supabase:** about 48k small queries per Bazaar pass (fine), plus the storage in §11. Free plan for now; the 500 MB ceiling is the cost to watch, at $25/month for Pro if needed. If a pass takes over 15 min (network round-trips), the fix is batching per page, not more money.
- **Vercel:** the watchdog query is already in the 15-min cron, so $0 extra.
- **Your time:** about 1 h for Phase D, then the review queue (≤ 25 candidates a day; reject liberally).

## 28. Conflicts with the current architecture
1. **DATA COMPOUNDS vs Scout's tables:** overwrites (G1/G2) and cascades (G3) → fixed in B2.
2. **v1 firewall plan blocked the database port** (G11) → fixed in Phase D.
3. **Wrong Bazaar assumption** about "listed only after a successful payment" (G10) → corrected. It affects how much we trust listings (not at all).
4. **Supabase free plan size** vs keeping every observation → measure in Phase E, decide then.
5. **Outside Scout, noted for later:** admins can hard-delete `registry_seeds` (`/api/admin/registry-seeds` DELETE), which conflicts with DATA COMPOUNDS. Approved Cori candidates add to `/registry`'s total-entries count (they're labelled "Observed", so it's honest, but it's a product choice). `cori_agent` can't read `reviewed_at`, so rejected candidates are never re-queued automatically (conservative, by design).
6. **Brief §26 "health check":** done as a heartbeat plus an external watchdog rather than an HTTP endpoint, so the server has no open ports. Same guarantee, smaller attack surface.

## 29. Reuse instead of build
See B. Also not built because CORTX already has it: no new admin UI, alerting channel, scheduler service, queue system, payment code, parser, URL-safety code or migration tooling.

## 30. Explicit non-goals (Scout V0)
- Any payment, paid check or verification request (the Verifier comes later, through a DB queue → Vercel)
- Readiness `/verify` from the VPS
- Observer baselines or anomaly detection beyond storing observations
- Reproduction, incidents, provider notifications
- Any public output: no Reliability Index, published counts, posts, badges or leaderboards. `/registry` changes only through human approval.
- Scores or rankings
- Any LLM
- Auto-approval
- Scraping competitors or directory sites, on-chain crawling
- MCP or preflight API
- Changes to monitoring, the paid path, the wallet or spend caps
- Everything in brief §31: marketplace, bounties, escrow, hiring, remediation, routing, refunds, insurance, tokens

---

## History
- **Sep 28 — v1 approved with defaults:** $0.05 eligible price cap, 25 candidates/day, CDP Bazaar only, `cori_agent` least-privilege role, GitHub repo as the User-Agent contact.
- **Sep 28 — Phase A built:** migration 023, `lib/net/ip.ts` allow-list, `lib/net/safe-fetch.ts`, `lib/cori/{normalize,classify,bazaar}.ts`, shared payment-option rules moved into `x402.ts`. 61 tests.
- **Sep 28 — Phase B built:** `agent/cori/` (Bazaar client, pipeline, probe, limiter, Postgres + memory stores, lock, dry run, `--once`, heartbeat). esbuild bundle. A failed source is retried after 30 min; idle ticks write no run rows; `unreachable` after 3 failures; rejected candidates aren't re-queued. 69 tests, including the fake-ecosystem pipeline and real Postgres as `cori_agent`.
- **Sep 28 — Phase C built:** `/admin/cori` page plus sidebar health dot, candidate cards, approve/reject write-back, Telegram watchdog. 77 tests.
- **Oct 5 — v2 (this document):** re-audited against the canonical brief (`CORI_BRIEF.md`) and DATA COMPOUNDS. Found G1–G11, proposed Phase B2, answered A–H, corrected the Bazaar listing assumption against the official x402 specs.

## Phase B2 status (built Oct 5)

- **`supabase/migrations/027_cori_memory.sql`** (additive, re-runnable; tested twice in a row on Postgres 16):
  - `discovery_observations` and `discovery_listings`
  - new columns `route_template`, `resource_url`, `pay_to`, `source_last_updated`, `disappeared_at` and `cori_runs.cori_version`
  - class `unsupported_method`
  - events and sources-seen changed from cascade to restrict
  - `cori_agent`: insert-only on observations, no update on events, listings update `last_seen_at` only
- **Parser** (`lib/cori/bazaar.ts`):
  - `routeTemplate` validated as the bazaar spec requires
  - identity = origin + template; probe URL filled from `pathParams`
  - methods kept as listed
  - listing snapshot (accepts / resource meta / extensions, 16 KB caps, item size kept)
  - raw `payTo`
  - `lastUpdated` as ISO
- **Classifier:** `unsupported_method` (after the `already_*` checks); `blocked:port`.
- **Probe:** GET, or POST `{}`, never a listing's body. Port allow-list on every redirect hop (`safeFetch` `allowedPorts`). Records method, atomic price and pay-to.
- **Pipeline:**
  - one observation per probe (failures included)
  - a listing version only on content change (`listing_changed` carries from/to hash)
  - identity and concrete URL both linked against CORTX records
  - candidates queued with the concrete URL
  - disappearance sweep after passes, only when every enabled source completed a full pass in the last 24 h; listing-only classes → `gone`; reappearance clears it
  - global probe budget
  - stop signal checked between probes
  - `duration_ms` on runs
- **Config:** `CORI_ALLOWED_PORTS` (443), `CORI_MAX_PROBES_PER_HOUR` (600), `CORI_BAZAAR_MAX_PAGES` 500, `CORI_VERSION`. Refuses to start if a `*PRIVATE_KEY*` / `*SERVICE_ROLE*` / `*WALLET*` / `MNEMONIC` / `SEED_PHRASE` variable is set.
- **Build:** `agent/cori/build.mjs` stamps the git SHA as `cori_version`. A test asserts the bundle contains no viem / x402 client / CORTX payment, runner or readiness code.
- **Tests:** suite 137 (136 pass, 1 skipped without a database). 21 new: parser, classifier, labels, port allow-list, POST body, observations, listing versions, port and method blocking, route templates, disappearance + reappearance, outage and multi-source guards, probe budget, shutdown, config, bundle. The real-Postgres test as `cori_agent` covers 027: observations = probes, versions only on change, every run stamped, history append-only for the role, and a delete with history is refused even for an admin.
- **Smoke test:** the built bundle against Postgres 16 as `cori_agent` covers startup, the source failure being recorded with `cori_version`, the key-refusal exit, and SIGTERM stopping in ~0.2 s.
- **Order for go-live:** run 027 **before** deploying this code (run rows now write `cori_version`).
