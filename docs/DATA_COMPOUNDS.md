# DATA COMPOUNDS — CORTX's data principle and the Oct 2026 audit

> **Permanent principle (founder, Oct 5, 2026).** CORTX doesn't only say whether an x402
> service is healthy right now. Its historical observations are one of the most valuable things
> it owns. Keep the underlying evidence and how it changes over time — never reduce it to a
> current healthy/unhealthy state.
>
> **The open checker and spec can be copied. The accumulated real-world reliability history
> cannot.**

## The lifecycle we preserve

```
service discovery → endpoint → check → payment terms → price → payment attempt → settlement
→ delivery → parsing / schema validation → evidence → incident → recovery
→ repeated behaviour → historical reliability
```

Over enough real checks and paid calls this becomes a proprietary dataset of how x402 services
actually behave in production: reliability, payment failures, pricing changes, schema failures,
recovery patterns.

## Rules (apply to every change from now on)

1. **Append, don't overwrite.** Observations, configuration and state changes are new rows or
   events. Current-state columns (e.g. `services.status`) are caches derived from history,
   never the only record.
2. **Never hard-delete evidence.** No cascading deletes from users or services into checks,
   incidents or events. Soft-delete and detach instead.
3. **Every check is reconstructable on its own:** what was checked (URL, method, input
   reference, price limits, schema version), by which code (runner version, spec version), what
   the service said (terms, headers, receipt) and what we concluded.
4. **Corrections are additive.** Fixing past data records the correction (what, why, when, by
   which migration) and keeps the original — no silent rewrites.
5. **Record "couldn't check" as an observation,** not as silence (e.g. a facilitator that
   started requiring auth is a fact with a date).
6. **Privacy by construction:** keep the evidence, not the secrets or the payload. Hash or strip
   anything a user typed that could be a secret, never store signatures or keys, strip sensitive
   headers, and keep response bodies to a short preview plus a shape/hash.
7. **The data is backed up off-platform.** It can't compound if one bad migration or account
   problem can erase it.

---

## Audit (Oct 5, 2026) — read-only, nothing changed

Scope: Supabase schema (migrations 001–025 plus the production drift found earlier), check
runners (`lib/check-runner/`), persistence (`persist.ts`), cron, `/report`, Cori (`agent/cori/`).

### What we already preserve ✅

| Data | Where | Notes |
|---|---|---|
| Every check, insert-only | `checks` | time, latency, status, `failure_stage`, `check_type`, `trigger_source`, `observed_price`, `error_message`, per-stage evidence (`stages` jsonb, with per-stage duration) |
| x402 V2 payment terms | availability stage `response_headers` | the whole 402 response's headers, so the base64 `PAYMENT-REQUIRED` terms survive |
| Price as advertised | price stage evidence | raw field, field name, parsed USDC, atomic or decimal, drift vs expected |
| Payment attempt | payment stage evidence | header type (V1/V2), x402 version, amount, payee **fingerprint** (sha256, 16 hex) |
| Settlement | delivery stage `settlement` | confirmed/failed/unconfirmed, tx hash from the receipt, network, receipt header — on success **and** failure |
| Delivery | delivery stage | HTTP status, body size, a 500-char body preview |
| Schema results | schema stage | validation errors |
| Incidents with history | `incidents.timeline` (appended), `triggering_check_id`, tiers, `resolution_type` incl. `false_positive` |
| CORTX-side vs service failure | `checks.status = 'error'` + `cortx_side` evidence flag |
| Free reports | `reliability_report_requests.check_result` (full result) + `paid_usdc` |
| Discovery history (Cori) | `discovery_events` (append-only: first seen, price/terms/listing changes, probe status, classification, queued/approved/rejected), `discovery_sources_seen` (first/last seen per source), `cori_runs` |
| Services are soft-deleted | `services.deleted_at` | no hard delete path found in the app |

### What we currently discard or overwrite ❌

| # | Lost | Why it matters |
|---|---|---|
| D1 | **Which endpoint/config a check ran against.** Editing a service overwrites `endpoint_url`, `test_input`, `expected_schema`, price limits in place; checks don't record them | After an edit, old checks silently look like they tested the new setup. Breaks reconstruction and per-endpoint history |
| D2 | **Which code produced a check** (runner/spec version) | The Aug 15 stage-name bug could only be repaired because the shift was deterministic. Next time we may not be that lucky |
| D3 | **x402 V1 payment terms** — only `accepts_count` and network kept (the body is kept only on failure, 200 chars) | Asset, payTo fingerprint, scheme, timeout, facilitator, description history lost for V1 services |
| D4 | **Request side:** HTTP method used (GET vs POST fallback), test input reference | Can't tell what was actually asked |
| D5 | **Paid response headers on success** (content-type, content-length) — kept only on failure | Delivery/format drift invisible on healthy checks |
| D6 | **Payment authorization metadata** (nonce, value, validBefore) | Can't reconcile a check with the on-chain transfer when there's no receipt |
| D7 | **Readiness "unavailable"** writes no check row; `services.readiness_status/reason` are overwritten | The date Bankr's facilitator started requiring auth exists only in NOTES |
| D8 | **Service state history** — `services.status`, readiness, pause reason overwritten | Mostly derivable from checks, but pauses and readiness transitions aren't |
| D9 | **Lightweight checks** keep only the HTTP status | Cheap, frequent signal (latency is kept at row level) with almost no evidence |
| D10 | **Cori: probe and listing history** — `last_probe` and `bazaar_metadata` overwritten; only transitions logged | Terms/listing snapshots between changes are lost |
| D11 | **Data repairs rewrote history in place** — migrations 020 (failed→error) and 022 (stage names) changed rows with no record beyond the migration file | Violates rule 4; originals not kept |

### Risks that could erase history 🔥

| # | Risk |
|---|---|
| R1 | `checks.user_id` and `incidents.user_id` reference `profiles(id) **on delete cascade**` — deleting a user account deletes all their checks and incidents. `alert_configs` / `spend_reservations` cascade from services (fine). The base `checks.service_id` foreign key predates the migrations (check production) |
| R2 | No off-platform backup. On Supabase's free plan there are no point-in-time restores; one bad migration or account issue loses everything |
| R3 | Growth: ~260 checks/day today with up to a few KB of evidence each (full 402 headers + body preview). Fine now, but tens of services × 96 lightweight checks/day will push the free-plan 500 MB limit within months; size must be measured before it becomes a reason to delete |

### Can a check be fully reconstructed later?

**Partly.** From a check row today you can recover: when it ran, how long each stage took, the
outcome per stage, the advertised price, V2 terms (from headers), whether money moved (receipt),
the delivery status and size, and schema errors.

You **cannot** recover: which URL and settings it ran with after an edit (D1), which code
version judged it (D2), V1 terms (D3), the request method and input (D4), healthy response
headers (D5), the authorization nonce (D6), and "couldn't check" observations (D7).

### Valuable history that must never be lost

- Every paid check and its settlement receipt (proof of what money bought).
- Every incident and its timeline, including corrections and false positives.
- Price and payment-terms changes per endpoint over time.
- Schema/format failures and when they started and stopped.
- Recovery times (incident open → close) and repeat patterns.
- Facilitator/readiness changes (e.g. "requires auth since Sep 28").
- Cori discovery: first seen, disappeared/reappeared, listing changes.
- Every correction we made to past data, and why.

### Privacy & security implications

- **Test inputs may contain secrets or personal data** users type in. Per-check history should
  store a hash + size (and the source: owner-provided / service example / none), not the raw
  input. The config history (owner-visible only) may keep the raw value; tell users not to put
  keys in test input.
- **Response bodies are third parties' paid content.** Keep the short preview owner-only; for
  the dataset keep a body hash and a "shape" (top-level keys and types), never full bodies.
- **Headers:** the availability stage currently stores *all* 402 response headers. Strip
  `set-cookie`, `authorization`, `proxy-authorization`, `x-api-key`-style and other credential
  headers before storing.
- **Redaction isn't wired up.** `lib/check-runner/redact.ts` exists, but nothing calls it;
  `CHECK_RUNNER_SPEC.md` (Stage 13) says redaction runs before every write — it doesn't. It
  can't simply be switched on either: its "private key" pattern (`0x` + 64 hex) also matches
  **transaction hashes** and would erase settlement proof. S5 replaces it with a header denylist
  plus field-specific handling.
- **Payments:** keep payee fingerprints (already), our own wallet is public anyway; never store
  signatures or keys. Authorization nonce/value/validBefore are safe to keep.
- **Account deletion:** decide the policy (founder). Proposed: delete personal data (email,
  profile, alert channels, raw test inputs) but keep endpoint evidence detached from the user
  (`user_id` → null). Endpoint behaviour of a public paid API is not personal data. **CORTX has
  no privacy policy page yet** — it needs one that states this.
- **Third parties:** the Observed → Reproduced → Confirmed → Resolved rule stands; the dataset
  is published only as aggregates or with confirmation, never raw failures about others.
- **Access:** new history tables are service-role only; owners read their own via RLS; the
  public API exposes only spec-shaped summaries (already the case). No public bulk export —
  the history is the moat.

### Smallest changes required (proposed — not built)

In priority order; each is small and additive. Nothing here rewrites existing data.

| # | Change | Fixes | Size |
|---|---|---|---|
| S1 | **Stop cascades:** `checks.user_id`, `incidents.user_id` (and `checks.service_id` if it cascades in production) → `on delete set null`. One migration | R1 | XS |
| S2 | **Off-platform backup:** scheduled `pg_dump` of the database (or Supabase backups on a paid plan) to private storage, weekly at least | R2 | S, founder setup |
| S3 | **Config history:** `service_config_history` table filled by a database trigger on insert/update of `endpoint_url`, `test_input`, `expected_schema`, prices, environment, intervals. No app change | D1 | S |
| S4 | **Per-check context:** add `checks.context jsonb` — `endpoint_url`, method used, `input_hash`, `input_source`, `schema_hash`, price limits, `config_version` — and `checks.runner_version` (Vercel git SHA) + `spec_version` | D1, D2, D4 | S |
| S5 | **Fuller evidence, safely:** normalized terms snapshot for V1 and V2 (+ `terms_hash`), paid response content-type/length, authorization nonce/value/validBefore, body hash + shape; strip sensitive headers | D3, D5, D6 + privacy | S |
| S6 | **`service_events` (append-only):** status changes, readiness transitions incl. "unavailable — facilitator requires auth", pauses, config changes, price/terms changes — same pattern as Cori's `discovery_events` | D7, D8 | S |
| S7 | **Corrections ledger:** `data_corrections` (migration, reason, affected rows, before/after summary); future repairs keep originals | D11 | XS |
| S8 | **Cori snapshots:** store the probe/listing snapshot in the event `details` whenever its hash changes | D10 | XS |
| S9 | **Measure size** (one SQL query) and decide retention for *lightweight* checks only (e.g. roll up to hourly after 90 days); paid checks, incidents and events are kept forever | R3, D9 | XS |

Recommended first batch: **S1 + S2 + S3 + S4** — they close the irreversible-loss risks and
make every new check reconstructable. S5–S9 follow.

### Status — first batch approved Oct 5, 2026 ("approve S1–S4, keep endpoint evidence")

Production check (Oct 5): `services.user_id`, `checks.user_id`, `incidents.user_id` cascaded
from `profiles`, and `checks.service_id`, `incidents.service_id` cascaded from `services` — an
account deletion erased everything by two paths. Database 17 MB, `checks` 4.9 MB / 4,819 rows.

- **S1 — built (migration 026).** Those five foreign keys now `set null` (user) or `restrict`
  (service). Deleting a profile runs `detach_account_evidence()`: the account's services are
  soft-deleted (monitoring stops) and its typed test input / canary payload are removed from the
  service and from every config version (the documented privacy exception to append-only);
  checks, incidents and config history stay, with `user_id` null.
- **S2 — template built, founder setup.** `ops/backup/` — weekly `pg_dump` of the public schema,
  encrypted with the founder's age key, stored as releases in a private repo.
- **S3 — built (migration 026).** `service_config_history` (versioned, `change_kind`
  baseline/created/updated/deleted/restored/account_deleted, `changed_by`, `config`,
  `config_hash`) written by a trigger on `services`; a baseline version for every existing
  service.
- **S4 — built.** `checks.config_version` (stamped by a trigger), `checks.context` (endpoint,
  method, environment, input source + sha256 + size, schema hash, price limits — never the raw
  input), `checks.runner_version` (Vercel git SHA) and `checks.spec_version`. The availability
  stage also records `probe_method`. If 026 hasn't run, checks are saved without these fields
  rather than lost.
