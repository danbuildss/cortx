# CORTX — Acceptance Criteria

Each criterion is written as a Given/When/Then scenario. A feature is not done until its criterion passes end-to-end in a deployed Vercel preview environment.

---

## AC-01: Sign Up

**Feature:** Authentication — sign up

**Given** a visitor navigates to `/signup`
**When** they enter a valid email and a password of at least 8 characters and submit the form
**Then:**
- A Supabase Auth account is created
- A `profiles` row is created with the correct email (via DB trigger)
- The user is redirected to `/overview`
- The overview page loads and shows the empty state ("No services yet")
- The user's session persists across a page reload

**Given** a visitor submits `/signup` with an email that is already registered
**Then** an inline error appears: "An account with this email already exists. Sign in instead."
**And** no duplicate account is created

---

## AC-02: Login and Logout

**Feature:** Authentication — login and session management

**Given** a registered user navigates to `/login`
**When** they enter correct credentials and submit
**Then** they are redirected to `/overview`

**Given** an authenticated user clicks "Sign out"
**Then** their session is terminated and they are redirected to `/`

**Given** an unauthenticated user navigates to `/overview`
**Then** they are redirected to `/login`

---

## AC-03: Add a Service

**Feature:** Service management — add service

**Given** an authenticated user navigates to `/services/new`
**When** they fill in all required fields with valid data and submit
**Then:**
- A new row is inserted in `services` with the correct field values
- The user is redirected to `/services/[new-id]`
- The service detail page shows status `unknown`, empty check history, and all 6 pipeline stages as "not yet run"

**Given** the user leaves any field blank
**Then** a field-level validation error appears and the form does not submit

**Given** the user enters an invalid URL (http, not https)
**Then** an inline error appears: "Must be a valid HTTPS URL."

**Given** the user enters invalid JSON in the test input field
**Then** an inline error appears: "Must be valid JSON."

**Given** the user sets max_price less than expected_price
**Then** an inline error appears: "Maximum price must be ≥ expected price."

---

## AC-04: Check Runner — Availability Stage

**Feature:** Check runner — Stage 3 (availability)

**Given** a service is registered with an endpoint that returns `402 Payment Required`
**When** the check runner executes Stage 3
**Then:**
- The stage result is `passed: true`
- Evidence includes `http_status: 402` and `response_time_ms` (a positive integer)

**Given** the endpoint returns `200 OK` (no payment required)
**When** Stage 3 executes
**Then** the stage result is `passed: false` with error `UNEXPECTED_STATUS`
**And** all subsequent stages are `passed: null`

**Given** the endpoint is unreachable (DNS failure or connection refused)
**When** Stage 3 executes
**Then** the stage result is `passed: false` with error `UNREACHABLE`
**And** one retry is attempted after a 2-second delay

---

## AC-05: Check Runner — Payment Terms Stage

**Feature:** Check runner — Stage 4 (payment terms)

**Given** the 402 response body contains valid x402 payment requirements with USDC on the expected network
**When** Stage 4 executes
**Then:**
- The stage result is `passed: true`
- Evidence includes `payment_required: true`, `accepted_tokens: ["USDC"]`, `network`, and `payee_address`

**Given** the 402 response body is not valid JSON
**When** Stage 4 executes
**Then** the stage result is `passed: false` with error `INVALID_PAYMENT_TERMS`

**Given** the payment terms do not include USDC on the service's configured network
**When** Stage 4 executes
**Then** the stage result is `passed: false` with error `UNSUPPORTED_NETWORK`

---

## AC-06: Check Runner — Price Check Stage

**Feature:** Check runner — Stage 6 (price comparison and max price gate)

**Given** the observed price equals the configured expected price and is below max price
**When** Stage 6 executes
**Then** the stage result is `passed: true`

**Given** the observed price is different from expected but still below max price
**When** Stage 6 executes
**Then** the stage result is `passed: false` with error `PRICE_MISMATCH`
**And** the pipeline continues to Stage 7 only if max price was not exceeded (to check the max gate)
**And** then all subsequent stages are `passed: null`

**Given** the observed price exceeds the configured max price
**When** Stage 6 executes
**Then** the stage result is `passed: false` with error `PRICE_EXCEEDS_MAXIMUM`
**And** no payment is attempted (Stage 7 is `passed: null`)
**And** the check result includes `observed_price` in the price evidence

---

## AC-07: Check Runner — Full Pipeline Pass

**Feature:** Check runner — full pipeline end-to-end

**Given** a service is registered pointing to a healthy test endpoint
**When** the check runner executes the full pipeline
**Then:**
- All 7 stage results (availability, payment_terms, price_check, payment, delivery, json_parse, schema_validation) are `passed: true`
- `check.status = 'passed'`
- `check.latency_ms` is a positive integer
- `check.failure_stage = null`
- `check.observed_price` matches the endpoint's price
- The `services` table is updated: `status = 'operational'`, `last_check_at` is current

---

## AC-08: Check Runner — Delivery Failure

**Feature:** Check runner — delivery stage failure

**Given** a service is registered pointing to an endpoint that accepts payment but returns an empty body
**When** the check runner executes
**Then:**
- Payment stage is `passed: true`
- Delivery stage is `passed: false` with error `EMPTY_BODY`
- JSON parse and schema validation stages are `passed: null`
- `check.status = 'failed'`
- `check.failure_stage = 'delivery'`
- `services.status = 'critical'`

---

## AC-09: Check Runner — Schema Validation

**Feature:** Check runner — AJV schema validation

**Given** an endpoint returns a JSON response that does not match the configured expected schema
**When** Stage 10 executes
**Then:**
- The stage result is `passed: false` with error `SCHEMA_VALIDATION_FAILED`
- Evidence includes the AJV error array with `instancePath`, `schemaPath`, `keyword`, `params`, `message` for each error

**Given** an endpoint returns a JSON response that matches the expected schema
**Then** Stage 10 is `passed: true` with `valid: true` in evidence

---

## AC-10: SSRF Protection

**Feature:** Security — SSRF protection

**Given** a user registers a service with an endpoint URL that resolves to a private IP (`10.x.x.x`, `192.168.x.x`, `172.16.x.x–172.31.x.x`, `127.x.x.x`)
**When** the check runner attempts to validate the URL (Stage 1)
**Then:**
- Stage 1 result is `passed: false` with error `SSRF_BLOCKED`
- No network request is made to the URL
- The check is stored with the appropriate failure

**Given** a URL with an HTTP scheme (not HTTPS)
**When** Stage 1 executes
**Then** the result is `passed: false` with error `NON_HTTPS`

**Given** a URL targeting a blocked port (22, 25, 3306, 5432, 6379)
**When** Stage 1 executes
**Then** the result is `passed: false` with error `BLOCKED_PORT`

---

## AC-11: Incident Management

**Feature:** Incidents — open, acknowledge, auto-resolve

**Given** a service has failed 2 consecutive checks with `failure_stage = 'delivery'`
**Then:**
- One incident is created with `severity = 'critical'` and `status = 'open'`
- A Telegram alert is sent to the configured chat ID
- The incident appears in the `/incidents` page

**Given** the same service fails a 3rd consecutive check
**Then** no second incident is created
**And** a timeline event is appended to the existing incident
**And** no additional Telegram alert is sent

**Given** an open incident exists for a service
**When** the next check passes
**Then:**
- The incident status changes to `resolved` with `resolution_type = 'auto'`
- A Telegram recovery alert is sent
- The incident shows "Resolved" on the incidents page

**Given** an open incident exists
**When** the user clicks "Acknowledge"
**Then** the incident status changes to `acknowledged`
**And** the timeline shows the acknowledgement event
**And** no alert is sent

**Given** an acknowledged incident exists
**When** the user clicks "Resolve"
**Then** the incident status changes to `resolved` with `resolution_type = 'manual'`
**And** no Telegram alert is sent

---

## AC-12: Spend Cap Enforcement

**Feature:** Security — spend caps

**Given** the daily spend cap has been reached for the current 24-hour window
**When** the check runner reaches Stage 7 (payment)
**Then:**
- Payment is not attempted
- Stage 7 result is `passed: false` with error `SPEND_CAP_EXCEEDED`
- The check result is stored

**Given** the observed price from Stage 5 exceeds the configured max price
**When** Stage 6 executes
**Then** the check aborts before Stage 7
**And** no payment is sent

---

## AC-13: Secret Redaction

**Feature:** Security — secret redaction before DB write

**Given** an endpoint response body contains a field named `api_key` with a value
**When** the check runner stores the evidence
**Then:**
- The stored evidence in the `checks` table shows `"api_key": "[REDACTED]"` in the delivery stage evidence
- The actual key value is not present anywhere in the stored record

**Given** the test wallet private key is set in the environment
**When** a check runs and the runner encounters any error
**Then** the error message stored in `checks.error_message` does not contain the private key

---

## AC-14: Row-Level Security

**Feature:** Security — data isolation between users

**Given** user A and user B each have one registered service
**When** user A makes a Supabase query for all services using their session token
**Then** only user A's service is returned
**And** user B's service is not accessible

**Given** user A attempts to read a `checks` record belonging to user B by ID (using the anon client)
**Then** the query returns zero rows (RLS blocks it)

**Given** the check runner inserts a check result using the service role key
**Then** the insert succeeds regardless of RLS
**And** the `user_id` field is correctly set from the service record

---

## AC-15: Scheduler

**Feature:** Scheduling — automatic check execution

**Given** a service has `check_interval_minutes = 5` and `last_check_at` is more than 5 minutes ago
**When** the Vercel Cron fires at `GET /api/cron/run-checks`
**Then:**
- A new check is queued and executed for that service
- `services.last_check_at` is updated after the check completes

**Given** a request to `GET /api/cron/run-checks` without the correct `Authorization` header
**Then** the response is `401 Unauthorized` and no checks are executed

**Given** a service has `last_check_at` that is less than `check_interval_minutes` ago
**When** the cron fires
**Then** that service is skipped (not checked again before its interval)

---

## AC-16: UI — Signature Pipeline Component

**Feature:** UI — Service detail page pipeline visualization

**Given** the most recent check passed all stages
**When** the user views the service detail page
**Then:**
- All 6 stage boxes show a green check (✓)
- Each box shows its duration or key evidence inline (e.g., "142ms", "$0.01 USDC")

**Given** the most recent check failed at the delivery stage
**When** the user views the service detail page
**Then:**
- Availability, Payment Terms, Price Check, and Payment stage boxes show ✓
- Delivery stage box shows ✗ with a one-line error summary
- JSON and Schema stage boxes show — (not reached)

**Given** the user clicks a stage box
**Then** an evidence drawer slides in from the right
**And** the drawer shows the full stage evidence in a monospace terminal block
**And** clicking outside the drawer or the Close button dismisses it
