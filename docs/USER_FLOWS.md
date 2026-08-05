# CORTX — User Flows

---

## Flow 1: Sign Up

**Entry point:** Landing page → "Get started" CTA, or direct `/signup`

**Steps:**
1. User lands on `/signup`
2. Enters email address
3. Enters password (min 8 chars)
4. Submits form
5. Supabase Auth creates account
6. User is redirected to `/overview` (empty state)

**Success state:** User is authenticated and sees the overview page with the empty state ("No services yet — add your first service.")

**Failure states:**
- Email already registered → inline error: "An account with this email already exists. Sign in instead."
- Weak password → inline error below password field
- Network error → toast: "Something went wrong. Try again."

**Required data:** Email, password

**UI feedback:**
- Submit button shows loading state during request
- Inline field-level errors on blur
- Redirect on success (no success toast needed — the destination is confirmation enough)

---

## Flow 2: Add a Service

**Entry point:** Overview page → "Add service" button, or `/services/new`

**Steps:**
1. User navigates to the add service form
2. Fills in required fields:
   - Service name
   - Endpoint URL
   - Environment (mainnet / testnet — select)
   - Safe test input (JSON textarea)
   - Expected response schema (JSON Schema textarea)
   - Expected price (number + unit)
   - Maximum permitted test price (number + unit)
   - Latency threshold (ms)
   - Testing frequency (select: 5m, 15m, 30m, 1h)
   - Alert destination (Telegram chat ID)
3. Submits form
4. Client validates with Zod before submit
5. Server validates and stores the service
6. User is redirected to the new service detail page

**Success state:** Service detail page for the newly created service, showing status "Unknown" and an empty check history. The first check runs on the next scheduled interval.

**Failure states:**
- Invalid URL → inline error: "Must be a valid HTTPS URL."
- Invalid JSON in test input or schema → inline error: "Must be valid JSON."
- Max price less than expected price → inline error: "Maximum price must be ≥ expected price."
- Network error → toast: "Failed to save service. Try again."

**Required data:** All fields listed in Step 2. None are optional in V1.

**UI feedback:**
- Field-level Zod validation on blur
- JSON fields validate syntax client-side
- Submit button disabled until all fields pass validation
- Loading state on submit
- Redirect on success

---

## Flow 3: Configure a Safe Test

**Entry point:** Add service form → "Safe test input" and "Expected response schema" fields

**Steps:**
1. Builder is on the add service form
2. In "Safe test input" — enters a JSON payload that:
   - Is valid JSON
   - Will succeed when sent to their endpoint
   - Does not trigger side effects (idempotent, or uses a sandbox mode)
   - Is small enough to keep test costs minimal
3. In "Expected response schema" — enters a JSON Schema object that:
   - Describes the shape of a valid response
   - Is valid JSON Schema (AJV Draft-07 compatible)
   - Is specific enough to catch real schema regressions
4. Sets "Expected price" to the amount their endpoint charges per call
5. Sets "Maximum permitted test price" to a ceiling they will accept (e.g., 2× expected price)
6. Saves the service

**Success state:** Service is saved. Future checks will use this test input and validate responses against this schema.

**Failure states:**
- Test input is not valid JSON → inline error
- Schema is not valid JSON → inline error
- Schema is valid JSON but fails AJV meta-validation → inline error: "Schema is not a valid JSON Schema."
- Expected price is zero or negative → inline error

**Required data:** Valid JSON test input, valid JSON Schema, numeric price values

**UI feedback:**
- Live JSON syntax highlighting (if feasible) or at minimum red border + inline error on invalid JSON
- Schema field includes a placeholder showing a minimal JSON Schema example

---

## Flow 4: Run the First Check

**Entry point:** Service detail page → check runs automatically on schedule, or via "Run check" button (nice-to-have)

**Steps:**
1. Service is registered and status is "Unknown"
2. Cron job triggers (or builder clicks "Run check")
3. Check runner executes the full 6-stage pipeline
4. Results are stored in the `checks` table with evidence at every stage
5. Service status is updated based on the result
6. If the check fails, an incident is created (after consecutive-failure threshold)
7. Service detail page reflects the new status and adds an entry to check history

**Success state:** Service status changes from "Unknown" to "Operational." Check history shows one green entry. The signature pipeline component shows all 6 stages as passing.

**Failure states:**
- Check runner cannot reach endpoint → stage 1 fails, status becomes "Critical," incident opened after threshold
- Any stage fails → the exact failure stage is recorded, status updated accordingly
- Check runner itself errors (unexpected exception) → check stored with error state, status remains previous value

**Required data:** Service configuration (URL, test input, expected schema, price, max price)

**UI feedback:**
- Status badge updates on page refresh (or real-time if SSE is implemented)
- Check history table adds a new row
- Stage pipeline component shows which stages passed and which failed

---

## Flow 5: View Service Status

**Entry point:** Overview page or direct `/services/[id]`

**Steps:**
1. Builder navigates to overview or directly to a service
2. Overview shows a table or card list of all services with:
   - Service name
   - Status badge (Operational / Degraded / Critical / Unknown)
   - Last check time
   - Environment
3. Builder clicks a service to go to service detail
4. Service detail shows:
   - Current status (large badge)
   - The 6-stage pipeline component with most recent check result
   - Check history table (last N checks, newest first)
   - Open incidents (if any)

**Success state:** Builder sees accurate current status and understands which stages are passing or failing.

**Failure states:**
- No checks have run → status "Unknown," check history empty, pipeline shows dashes
- Last check is stale (>2× interval) → status reverts to "Unknown" with a note
- Data fetch fails → error state with retry option

**Required data:** Service ID, check history, incident state

**UI feedback:**
- Status badge color: green (Operational), yellow (Degraded), red (Critical), grey (Unknown)
- Pipeline stages: green check / red X / grey dash (not yet run)
- Check history: table with timestamp, status, latency, failure stage

---

## Flow 6: Inspect Failed Evidence

**Entry point:** Service detail → check history row → check detail page `/checks/[id]`

**Steps:**
1. Builder sees a failed check in the check history
2. Clicks the check row to open the check detail page (or evidence drawer)
3. Check detail shows:
   - Overall result and failure stage
   - Total latency
   - Timestamp
   - Per-stage breakdown:
     - Stage name
     - Pass / Fail
     - Evidence (response body excerpt, price observed, error message, parsed schema result)
   - Raw request and response (redacted of any secrets)

**Success state:** Builder can see exactly which stage failed, what was observed, and what was expected.

**Failure states:**
- Evidence was partially stored (check runner crashed mid-pipeline) → show whatever was stored, note that evidence is incomplete
- Evidence contains redacted fields → show redaction markers clearly

**Required data:** Check ID, all stage results, evidence records

**UI feedback:**
- Evidence displayed in a monospace terminal-style component
- Failure stage highlighted
- Raw response shown in a scrollable code block
- No chart or graph needed — text evidence only

---

## Flow 7: Receive an Incident Alert

**Entry point:** Telegram (external, no UI)

**Steps:**
1. Check runner detects N consecutive failures (threshold: 2)
2. Incident record is created in the database
3. Alert worker sends a Telegram message to the configured chat ID
4. Message includes:
   - Service name
   - Failure stage
   - Status (Critical / Degraded)
   - Timestamp
   - Link to the incident in CORTX

**Success state:** Builder receives a Telegram message within 60 seconds of incident creation.

**Failure states:**
- Telegram delivery fails → retry up to 3 times with exponential backoff; log failure; do not block check runner
- Chat ID is invalid → error logged, builder notified in-app on next visit

**Required data:** Telegram chat ID, service name, failure stage, incident ID

**UI feedback:** None (alert is external). In-app, the incident appears in the incidents list.

---

## Flow 8: Acknowledge an Incident

**Entry point:** Incidents page or service detail → open incident → "Acknowledge" button

**Steps:**
1. Builder sees an open incident
2. Clicks "Acknowledge"
3. Incident status changes from "Open" to "Acknowledged"
4. Timestamp and actor recorded in incident timeline
5. No alert is sent for acknowledgement (acknowledgement is an internal state)

**Success state:** Incident shows "Acknowledged" status. Timeline shows the acknowledgement event.

**Failure states:**
- Incident was already resolved → "Acknowledge" button not shown
- Network error → toast: "Failed to acknowledge. Try again."

**Required data:** Incident ID, authenticated user

**UI feedback:**
- Button replaced with "Acknowledged" label + timestamp
- Timeline entry added

---

## Flow 9: Resolve an Incident

**Entry point:** Automatic (check passes after open incident) or manual ("Resolve" button)

### Automatic resolution
1. Check runner runs and all stages pass
2. System checks if there is an open or acknowledged incident for this service
3. Incident status changes to "Resolved"
4. Resolution timestamp recorded
5. Telegram alert sent: "[Service name] has recovered."

### Manual resolution
1. Builder navigates to incident
2. Clicks "Resolve"
3. Incident status changes to "Resolved"
4. Resolution timestamp and actor recorded
5. No Telegram alert for manual resolution

**Success state:** Incident shows "Resolved" status with timestamp. Service status updates on next check.

**Failure states:**
- Incident already resolved → "Resolve" button not shown
- Automatic resolution Telegram alert fails → retry 3 times; log; do not block

**Required data:** Incident ID, resolution type (auto / manual)

**UI feedback:**
- Incident card shows "Resolved" badge
- Timeline shows resolution event and type
- Telegram message sent (automatic resolution only)
