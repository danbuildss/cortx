# CORTX — Security Model

---

## Threat Model

CORTX is a server-side monitoring tool that makes real payments from a test wallet on behalf of registered users. The primary threats are:

1. **SSRF** — a user registers a malicious endpoint URL that causes the check runner to probe internal infrastructure
2. **Overspend** — a malicious or misconfigured service charges more than expected, draining the test wallet
3. **Key exposure** — the test wallet private key escapes into logs, the database, or error messages
4. **Data isolation** — a user reads another user's services, checks, or incidents
5. **Cron abuse** — the scheduler endpoint is invoked by an external party to trigger unauthorized checks
6. **Injection** — user-supplied JSON (test_input, expected_schema) is used in a way that allows code execution

---

## 1. Test Wallet

### Design

CORTX uses a single dedicated test wallet for all check payments. This wallet is separate from any production funds and holds only the minimum balance needed for testing.

### Key Storage

- Private key stored in `CORTX_TEST_WALLET_KEY` environment variable
- Never written to the database
- Never included in log output (check runner catches and strips key patterns before logging)
- Never returned in API responses
- Never included in error messages — caught at the application boundary and replaced with `[REDACTED]`

### Key Access Pattern

```typescript
function getTestWalletKey(): string {
  const key = process.env.CORTX_TEST_WALLET_KEY;
  if (!key) throw new Error('CORTX_TEST_WALLET_KEY not set');
  return key;
}
```

The key is fetched at execution time, not at module load time. It is never assigned to a variable that persists beyond the function scope.

### Balance Verification

Before executing a payment, the runner verifies the wallet has sufficient balance. If balance < `observed_price`: abort with `INSUFFICIENT_BALANCE`. No payment is attempted.

---

## 2. Spend Caps

Spend caps are enforced server-side before the payment stage. They are checked in sequence:

### Per-Payment Cap

`observed_price` must be ≤ `service.max_price`. This is the hard gate. If exceeded: abort with `PRICE_EXCEEDS_MAXIMUM`, do not proceed to payment under any circumstances.

This check happens in the check runner, not in user input validation. Even if a service config record were tampered with, the runtime check uses the observed price from the endpoint response, not from a client-supplied value.

### Daily Spend Cap

Total spend across all checks in the last 24 hours (rolling window) must not exceed `CORTX_DAILY_SPEND_CAP_USDC` (env var, default: `1.00`).

```typescript
const todaySpend = await getTodaySpend(); // sum of observed_price for passed payment stages today
if (todaySpend + observedPrice > dailyCap) {
  throw new Error('SPEND_CAP_EXCEEDED');
}
```

### Monthly Spend Cap

Total spend in the current calendar month must not exceed `CORTX_MONTHLY_SPEND_CAP_USDC` (env var, default: `10.00`).

Both caps are checked before payment. If either would be exceeded: abort without payment, log the cap event, continue storing the check result with a `SPEND_CAP_EXCEEDED` error in the payment stage evidence.

---

## 3. SSRF Protection

### URL Validation (Stage 1 of Check Runner)

Before any network request, the endpoint URL is validated:

1. **Scheme check** — must be `https`. HTTP is rejected.
2. **DNS resolution** — resolve the hostname to an IP address at validation time, not at request time (prevents DNS rebinding attacks where the IP changes between check and request).
3. **Private range check** — the resolved IP must not fall in any reserved range:

| Range | Description |
|---|---|
| `10.0.0.0/8` | Private |
| `172.16.0.0/12` | Private |
| `192.168.0.0/16` | Private |
| `127.0.0.0/8` | Loopback |
| `::1/128` | IPv6 loopback |
| `169.254.0.0/16` | Link-local (APIPA) |
| `fc00::/7` | IPv6 unique local |
| `0.0.0.0/8` | Reserved |
| `100.64.0.0/10` | Shared address space (CGNAT) |
| `198.18.0.0/15` | Benchmarking |

4. **Port check** — blocked ports: `22, 25, 465, 587, 3306, 5432, 6379, 27017`. Default HTTPS port (443) is always allowed.
5. **TLS validation** — self-signed certificates are rejected. Certificate must be valid and chain to a trusted CA.

### Implementation

```typescript
import dns from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

async function validateUrl(endpointUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(endpointUrl);
  } catch {
    throw new StageError('INVALID_URL');
  }
  if (parsed.protocol !== 'https:') throw new StageError('NON_HTTPS');

  const blockedPorts = [22, 25, 465, 587, 3306, 5432, 6379, 27017];
  const port = parsed.port ? parseInt(parsed.port) : 443;
  if (blockedPorts.includes(port)) throw new StageError('BLOCKED_PORT');

  const records = await dns.lookup(parsed.hostname, { all: true });
  for (const record of records) {
    const ip = ipaddr.parse(record.address);
    if (ip.range() !== 'unicast') throw new StageError('SSRF_BLOCKED');
  }
  return parsed;
}
```

---

## 4. Secret Redaction

Secrets are redacted from all evidence before it is written to the database.

### Redaction Triggers

Redaction runs as a post-processing step after the full pipeline completes, before any database write.

### Field Name Denylist

Any evidence field whose key matches these patterns (case-insensitive) has its value replaced with `"[REDACTED]"`:

- `private_key`, `privatekey`, `private_key_hex`
- `secret`, `api_key`, `apikey`, `api_secret`
- `authorization`, `bearer`, `auth_token`, `access_token`
- `password`, `passwd`, `credential`
- `mnemonic`, `seed_phrase`, `seedphrase`

### Value Pattern Denylist

String values matching these patterns are redacted regardless of key name:

- Base58 strings 44–88 chars long (Solana private keys)
- `0x` followed by 64 hex characters (Ethereum private keys)
- Strings matching `Bearer [A-Za-z0-9._-]{20,}` (bearer tokens)
- AWS secret pattern: 40-char alphanumeric strings following `aws_secret_access_key`

### Redaction Implementation

```typescript
function redactSecrets(obj: unknown): unknown {
  if (typeof obj === 'string') return redactString(obj);
  if (Array.isArray(obj)) return obj.map(redactSecrets);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        isSecretKey(k) ? '[REDACTED]' : redactSecrets(v),
      ])
    );
  }
  return obj;
}
```

Redaction is applied to the entire `stages` array before insert.

---

## 5. Row-Level Security

All database tables have RLS enabled. Users can only access their own rows.

| Table | Policy |
|---|---|
| `profiles` | SELECT, UPDATE: `id = auth.uid()` |
| `services` | ALL: `user_id = auth.uid()` |
| `checks` | SELECT: `user_id = auth.uid()`. INSERT: service role only |
| `incidents` | ALL: `user_id = auth.uid()` |
| `alert_destinations` | ALL: `user_id = auth.uid()` |

The check runner uses the Supabase **service role key** (stored in `SUPABASE_SERVICE_ROLE_KEY` env var) to insert check results. The service role bypasses RLS. This key is never exposed to the client.

The client-facing Next.js app uses the **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), which is subject to RLS.

---

## 6. Cron Endpoint Protection

The cron endpoint that triggers check runs must not be invokable by external parties.

### Scheduler

CORTX uses **cron-job.org** (not Vercel Cron) as the scheduler. The `Authorization: Bearer {CRON_SECRET}` header must be manually configured in the cron-job.org job settings — it is not injected automatically.

### Protection Method

The endpoint validates the Bearer token before executing any checks:

```typescript
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const secret = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!secret || secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  // proceed with checks
}
```

`CRON_SECRET` is a random 32-byte hex string generated at project setup and stored as a Vercel environment variable. It must also be entered into the cron-job.org job's "Request headers" configuration.

---

## 7. JSON Injection Prevention

User-supplied JSON fields (`test_input`, `expected_schema`) are stored as JSONB in Postgres. They are never executed, eval'd, or interpolated into shell commands. They are deserialized and passed to controlled functions only.

`expected_schema` is compiled by AJV at check time. AJV schema compilation does not execute arbitrary code. The schema is validated against the JSON Schema meta-schema before storage (at add-service time).

`test_input` is serialized to a JSON string and sent as an HTTP request body. It is not interpolated into any SQL query or command.

---

## 8. Environment Variables Reference

| Variable | Required | Notes |
|---|---|---|
| `CORTX_TEST_WALLET_KEY` | ✓ | Test wallet private key. Never logged. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Service role key for check runner DB writes. Never exposed to client. |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Public anon key (subject to RLS) |
| `CRON_SECRET` | ✓ | Random secret for cron endpoint auth |
| `TELEGRAM_BOT_TOKEN` | ✓ | Bot token for sending alerts |
| `CORTX_DAILY_SPEND_CAP_USDC` | — | Default: `1.00` |
| `CORTX_MONTHLY_SPEND_CAP_USDC` | — | Default: `10.00` |

No secret is ever written to `.env.local` that is committed to git. `.env.local` is in `.gitignore`.

---

## 9. Audit Logging

The following events are logged to the server console (structured JSON) and retained in Vercel's log drain:

| Event | Fields logged |
|---|---|
| Check started | `service_id`, `started_at` |
| Check completed | `service_id`, `status`, `failure_stage`, `latency_ms` |
| Payment attempted | `service_id`, `amount` (not key, not tx_hash) |
| Spend cap enforced | `service_id`, `daily_spend`, `cap` |
| SSRF blocked | `service_id`, `url`, `reason` |
| Incident opened | `service_id`, `incident_id`, `severity` |
| Incident resolved | `service_id`, `incident_id`, `resolution_type` |
| Alert sent | `service_id`, `incident_id`, `channel` |
| Alert failed | `service_id`, `incident_id`, `attempt`, `error` |
| Runner error | `service_id`, `error_message` (secrets stripped) |

Private keys, transaction hashes, and wallet addresses are never logged.

---

## 10. Known Open Gaps (V1.1 Targets)

These are confirmed gaps identified during the Aug 2026 codebase audit. They are documented here so they are tracked and not mistaken for intended behavior. All are targeted for V1.1.

### 10.1 SSRF in Verification Confirmation Endpoint

**Gap:** The endpoint that confirms endpoint ownership during the Claimed verification flow (verify confirm) does not apply the same SSRF protection used in the check runner. A user could claim ownership of an internal URL.

**Target fix:** Apply `validateAndResolveUrl` (or equivalent) to all URLs accepted by the verify confirm endpoint before any outbound request.

**Severity:** High — a bypassed SSRF check in an ownership verification flow allows probing internal infrastructure under the appearance of a legitimate claim.

### 10.2 Budget Exhaustion Is Silent

**Gap:** When the daily or monthly spend cap is reached, paid checks silently stop. The builder sees no status change and no alert. The monitoring product continues to appear healthy while paid verification has halted.

**Target fix:**
- Persist a `monitoring_paused_reason` field on services (or a separate monitoring-state table) when spend cap is hit
- Expose the paused state in the service detail UI (distinct from Operational / Degraded / Critical / Unknown)
- Send a Telegram alert when the service enters the paused state due to budget exhaustion
- Send a low-balance alert when the monitoring wallet balance falls below a configurable threshold (default: 3 days of estimated spend)

**Severity:** High — CORTX implies reliability information is current when it is not. This is the highest immediate trust risk.

### 10.3 Concurrent Check Budget Race

**Gap:** Simultaneous paid checks can race against the same cumulative daily/monthly spend total. Two checks reading the same `todaySpend` value before either writes a payment can both pass the cap check and together overshoot the cap.

**Target fix:** Implement a concurrency-safe spend reservation before the payment stage — either a database-level advisory lock, a Postgres `FOR UPDATE` on the spend tally row, or an atomic increment with a rollback path if the reservation fails.

**Severity:** Medium — the cap can be exceeded but only by one concurrent check's worth of spend. Risk is bounded by the per-payment cap.

### 10.4 `_debug` Field in Production API Responses

**Gap:** The detect endpoint (`/api/services/detect`) returns a `_debug` object in all responses, including production. This field includes the raw response body, decoded payment headers, and parsed payment options from the target URL. While it contains no CORTX secrets, it leaks information about external endpoints and the parsing internals.

**Target fix:** Remove `_debug` from production responses. Gate it behind an admin-only flag or strip it entirely.

**Severity:** Low — no secrets exposed, but unnecessary information disclosure.

### 10.5 Admin Route Auth Is Hardcoded

**Gap:** Admin pages check a hardcoded user ID (`e9374851-ac6f-4f1e-a131-6747fc37184a`). This works but is fragile — the admin user cannot be changed without a code deploy.

**Target fix:** Move admin user identification to an environment variable or a `profiles.is_admin` column with a corresponding RLS policy.

**Severity:** Low — no immediate exploitability, but increases operational risk if admin access needs to change quickly.
