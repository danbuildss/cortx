# CORTX — Check Runner Specification

The check runner is a TypeScript module that executes a full synthetic test against one x402 endpoint. It runs server-side only (Vercel serverless function or Edge Function). It never runs in the browser.

---

## TypeScript Result Types

```typescript
export type StageResult = {
  stage: StageName;
  passed: boolean | null;   // null = not reached
  duration_ms: number | null;
  evidence: Record<string, unknown> | null;
  error?: string;
};

export type StageName =
  | 'availability'
  | 'payment_terms'
  | 'price_check'
  | 'payment'
  | 'delivery'
  | 'json_parse'
  | 'schema_validation';

export type CheckStatus = 'passed' | 'failed' | 'error';

export type CheckResult = {
  service_id: string;
  started_at: Date;
  completed_at: Date | null;
  latency_ms: number | null;
  status: CheckStatus;
  failure_stage: StageName | null;
  stages: StageResult[];
  observed_price: string | null;
  error_message: string | null;
};

export type ServiceConfig = {
  id: string;
  user_id: string;
  endpoint_url: string;
  test_input: Record<string, unknown>;
  expected_schema: Record<string, unknown>;
  expected_price: string;   // decimal string
  max_price: string;        // decimal string
  latency_threshold_ms: number;
  environment: 'mainnet' | 'testnet';
};
```

---

## Pipeline Execution

The runner executes stages in strict order. If any stage fails, remaining stages are marked `passed: null` (not reached). The runner always stores a result, even if it crashes mid-pipeline.

```typescript
export async function runCheck(config: ServiceConfig): Promise<CheckResult> {
  const started_at = new Date();
  const stages: StageResult[] = [];
  let failure_stage: StageName | null = null;
  let observed_price: string | null = null;

  try {
    // Stages execute sequentially
    // Each stage appends to `stages` and returns early on failure
    ...
  } catch (err) {
    return {
      service_id: config.id,
      started_at,
      completed_at: new Date(),
      latency_ms: Date.now() - started_at.getTime(),
      status: 'error',
      failure_stage,
      stages,
      observed_price,
      error_message: String(err),
    };
  }
}
```

---

## Stage 1: Validate URL

**Input:** `config.endpoint_url`

**Output:** Validated URL object or immediate abort

**Process:**
1. Parse URL using `new URL(endpoint_url)`
2. Confirm scheme is `https`
3. Confirm hostname is not a private/loopback address (see Stage 1 security)
4. Confirm port is not blocked (blocked: 22, 25, 465, 587, 3306, 5432, 6379)

**Possible errors:**
- `INVALID_URL` — malformed URL
- `NON_HTTPS` — scheme is not https
- `SSRF_BLOCKED` — hostname resolves to a private or reserved address
- `BLOCKED_PORT` — port is on the blocklist

**Evidence stored:** `{ url: endpoint_url, validation: 'passed' | error reason }`

**Timeout:** None (synchronous, no network)

**Retry:** None

**Security:**
- DNS resolution is performed at validation time, not request time, to prevent DNS rebinding
- Private ranges blocked: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `::1`, `169.254.0.0/16`, `fc00::/7`
- Blocked even if the user controls the hostname — the IP must be public

---

## Stage 2: Start Timer

**Input:** None

**Output:** `wallClockStart = performance.now()`

**Process:** Record the high-resolution timestamp before any network request.

**Timeout:** N/A
**Retry:** N/A
**Evidence stored:** None (start time is embedded in `started_at` on the check record)

---

## Stage 3: Test Availability

**Input:** Validated URL

**Output:** HTTP response, or failure

**Process:**
1. Send `POST` to `endpoint_url` with `test_input` as JSON body and no payment headers
2. Expect a `402 Payment Required` response
3. Any 2xx response indicates the endpoint does not require payment — treat as a configuration error (stage fails)
4. 4xx (other than 402) or 5xx → stage fails

**Possible errors:**
- `UNREACHABLE` — network timeout, DNS failure, connection refused
- `UNEXPECTED_STATUS` — response is not 402 (e.g., 200, 500)
- `TIMEOUT` — response not received within timeout window

**Evidence stored:**
```json
{
  "http_status": 402,
  "response_time_ms": 142,
  "response_headers": { "content-type": "application/json" }
}
```
Response body is **not** stored at this stage (stored at delivery stage).

**Timeout:** 10 seconds

**Retry:** 1 retry on network error only (not on HTTP error responses). 2-second delay.

**Security:** TLS certificate is validated. Self-signed certs cause stage failure.

---

## Stage 4: Inspect Payment Requirements

**Input:** 402 response from Stage 3

**Output:** Parsed payment requirements, or failure

**Process:**
1. Parse the 402 response body as JSON
2. Extract x402 payment requirements (accepted tokens, network, price, payee address)
3. Validate that at least one payment option is present
4. Validate that USDC on the expected network is accepted

**Possible errors:**
- `INVALID_PAYMENT_TERMS` — response body is not valid JSON
- `NO_PAYMENT_OPTIONS` — parsed JSON has no payment options
- `UNSUPPORTED_NETWORK` — no accepted option matches the service's configured network
- `MISSING_FIELDS` — required fields (price, payee, network) absent from payment terms

**Evidence stored:**
```json
{
  "payment_required": true,
  "accepted_tokens": ["USDC"],
  "network": "base",
  "payee_address": "0x[REDACTED]",
  "raw_payment_terms": { ... }
}
```
Payee address is stored but flagged as sensitive.

**Timeout:** Uses response already received in Stage 3 (no additional network call)

**Retry:** None

---

## Stage 5: Parse Observed Price

**Input:** Payment requirements from Stage 4

**Output:** `observed_price` as a decimal string, or failure

**Process:**
1. Extract the price field from the payment requirements
2. Parse as a numeric value
3. Convert to a canonical decimal string representation

**Possible errors:**
- `MISSING_PRICE` — price field absent
- `INVALID_PRICE_FORMAT` — price is not a parseable number
- `ZERO_PRICE` — price is zero or negative

**Evidence stored:**
```json
{ "raw_price_field": "0.01", "parsed_price": "0.01", "unit": "USDC" }
```

**Timeout:** None (synchronous)

**Retry:** None

---

## Stage 6: Compare Price Against Expected and Maximum

**Input:** `observed_price`, `config.expected_price`, `config.max_price`

**Output:** Pass/fail, or immediate abort if max price exceeded

**Process:**
1. Compare `observed_price` to `config.expected_price`
   - If not equal: stage result is `passed: false`, `failure_stage = 'price_check'`
   - But still check against `max_price` before aborting
2. If `observed_price > config.max_price`: **hard abort** — do not proceed to payment under any circumstances
3. If price matches expected: stage passes

**Possible errors:**
- `PRICE_MISMATCH` — observed ≠ expected but ≤ max (fails stage, incident opens)
- `PRICE_EXCEEDS_MAXIMUM` — observed > max (hard abort, no payment attempted, error logged)

**Evidence stored:**
```json
{
  "expected_price": "0.01",
  "observed_price": "0.012",
  "max_price": "0.02",
  "result": "mismatch"
}
```

**Timeout:** None (synchronous)

**Retry:** None

**Security:** Max price check is the critical safety gate. It is enforced on the server, not trusted from any client input. The check must pass even if the service config record was tampered with.

---

## Stage 7: Execute Controlled Payment

**Input:** Payment requirements, `observed_price`, test wallet credentials (from env)

**Output:** Payment receipt / transaction hash, or failure

**Process:**
1. Retrieve test wallet private key from environment variable (never from DB)
2. Verify test wallet has sufficient balance (if not: skip payment, stage fails with `INSUFFICIENT_BALANCE`)
3. Sign and submit the payment transaction
4. Wait for confirmation
5. Receive and parse the payment receipt

**Possible errors:**
- `INSUFFICIENT_BALANCE` — wallet balance < observed_price
- `PAYMENT_REJECTED` — transaction rejected by the network
- `PAYMENT_TIMEOUT` — confirmation not received within timeout
- `WALLET_ERROR` — signing or submission failure

**Evidence stored:**
```json
{
  "tx_hash": "[REDACTED]",
  "amount_paid": "0.01",
  "network": "base",
  "wallet_address": "[REDACTED]",
  "confirmed": true
}
```
Transaction hash and wallet address are stored but redacted in the UI by default.

**Timeout:** 30 seconds for payment confirmation

**Retry:** No retry on payment. A failed transaction is evidence; retrying risks double payment.

**Security:**
- Private key loaded from `CORTX_TEST_WALLET_KEY` env var at execution time
- Key never logged, stored in DB, or included in error messages
- Daily and monthly spend caps enforced before this stage (see SECURITY.md)
- If spend cap would be exceeded by this payment: abort with `SPEND_CAP_EXCEEDED`

---

## Stage 8: Confirm Result Delivery

**Input:** Payment receipt from Stage 7

**Output:** HTTP response body, or failure

**Process:**
1. Send the payment receipt to the endpoint (per x402 protocol)
2. Expect a 2xx response with a non-empty body
3. Record the full response body

**Possible errors:**
- `NO_RESPONSE` — endpoint did not respond after payment
- `EMPTY_BODY` — response was 2xx but body was empty
- `DELIVERY_TIMEOUT` — response not received within timeout
- `UNEXPECTED_STATUS` — response was not 2xx

**Evidence stored:**
```json
{
  "http_status": 200,
  "body_received": true,
  "body_length_bytes": 342,
  "response_body_preview": "{ \"result\": \"..." // first 500 chars
}
```
Full response body stored in evidence (truncated at 50KB). Redact any fields matching known secret patterns.

**Timeout:** 15 seconds

**Retry:** None (a delivery that requires retry is a degraded service)

---

## Stage 9: Parse JSON

**Input:** Response body from Stage 8

**Output:** Parsed JSON object, or failure

**Process:**
1. Attempt `JSON.parse(responseBody)`
2. If it throws: stage fails

**Possible errors:**
- `INVALID_JSON` — response body is not parseable JSON

**Evidence stored:**
```json
{
  "parse_successful": false,
  "error": "Unexpected token < at position 0",
  "body_preview": "<html>..." // first 200 chars of raw body
}
```

**Timeout:** None (synchronous)

**Retry:** None

---

## Stage 10: Validate Schema

**Input:** Parsed JSON from Stage 9, `config.expected_schema`

**Output:** AJV validation result, or failure

**Process:**
1. Initialize AJV with Draft-07
2. Compile `config.expected_schema`
3. Validate the parsed response against the compiled schema
4. If validation fails: collect AJV error objects

**Possible errors:**
- `SCHEMA_COMPILE_ERROR` — the stored expected_schema is not a valid JSON Schema (should not happen if add-service validates it)
- `SCHEMA_VALIDATION_FAILED` — response does not match expected schema

**Evidence stored:**
```json
{
  "valid": false,
  "errors": [
    {
      "instancePath": "/result",
      "schemaPath": "#/properties/result/type",
      "keyword": "type",
      "params": { "type": "string" },
      "message": "must be string"
    }
  ]
}
```

**Timeout:** None (synchronous)

**Retry:** None

---

## Stage 11: Record Latency

**Input:** `wallClockStart` from Stage 2, current time

**Output:** `latency_ms` (integer)

**Process:** `latency_ms = Math.round(performance.now() - wallClockStart)`

This is total wall-clock time from first byte sent to last byte received at Stage 8.

**Evidence stored:** N/A (stored on the check record itself as `latency_ms`)

---

## Stage 12: Classify Status

**Input:** All stage results, `config.latency_threshold_ms`

**Output:** `CheckStatus`, `ServiceStatus`

**Rules:**

```typescript
function classifyStatus(stages: StageResult[], latency_ms: number, config: ServiceConfig): {
  check_status: CheckStatus;
  service_status: ServiceStatus;
  failure_stage: StageName | null;
} {
  const failed = stages.find(s => s.passed === false);
  if (failed) {
    const isCritical = ['payment', 'delivery', 'json_parse', 'schema_validation'].includes(failed.stage);
    return {
      check_status: 'failed',
      service_status: isCritical ? 'critical' : 'degraded',
      failure_stage: failed.stage,
    };
  }
  if (latency_ms > config.latency_threshold_ms) {
    return { check_status: 'passed', service_status: 'degraded', failure_stage: null };
  }
  return { check_status: 'passed', service_status: 'operational', failure_stage: null };
}
```

---

## Stage 13: Store Evidence

**Input:** Complete `CheckResult`

**Output:** Stored check record in DB

**Process:**
1. Redact secrets from all evidence objects (regex patterns for private keys, auth tokens)
2. Insert into `checks` table
3. Update `services.status` and `services.last_check_at`

**Security:** Redaction runs before any DB write. Redaction uses a denylist of field name patterns (`private_key`, `secret`, `authorization`, `bearer`, `api_key`) and value patterns (base58 strings of key-like length).

---

## Stage 14: Create or Resolve Incident

**Input:** Check result, current open incident for this service (if any)

**Output:** Incident created, resolved, or unchanged

**Process:**
1. Query for open/acknowledged incident on this service
2. If check passed:
   - If open incident exists → resolve it (auto), append timeline event, trigger resolution alert
3. If check failed:
   - Query consecutive failure count for this service
   - If consecutive failures ≥ 2:
     - If no open incident → create one
     - If open incident exists → append timeline event, do not create duplicate
4. If check errored (runner exception):
   - Do not open an incident (runner errors are not endpoint failures)
   - Log the error

Consecutive failure count: count of the most recent checks in sequence with `status = 'failed'`, stopping at the first `status = 'passed'`.
