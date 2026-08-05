# CORTX — Incident Rules

All incident logic is deterministic. There is no ML, no scoring, no fuzzy thresholds. A rule either fires or it does not.

---

## Definitions

**Consecutive failure count:** The number of the most recent check records for a service, in sequence from newest, where `status = 'failed'`, stopping at the first record where `status = 'passed'` or `status = 'error'`. Runner errors (`status = 'error'`) do not count as failures and do not break the streak.

**Open incident:** An incident for a service where `status IN ('open', 'acknowledged')`.

**Service status:** Derived from the most recent check result. Not derived from incident state.

---

## Rule 1: Open an Incident

**Trigger:** A check completes with `status = 'failed'` AND the consecutive failure count for this service reaches exactly 2 (i.e., the two most recent checks are both `status = 'failed'`).

**Condition:** No open incident currently exists for this service.

**Action:**
1. Determine severity from the failure stage:
   - `payment`, `delivery`, `json_parse`, `schema_validation` → `severity = 'critical'`
   - `availability`, `payment_terms`, `price_check` → `severity = 'degraded'`
2. Insert a new incident:
   ```sql
   INSERT INTO incidents (service_id, user_id, severity, status, failure_stage, triggering_check_id, timeline)
   VALUES (
     $service_id, $user_id, $severity, 'open', $failure_stage, $check_id,
     '[{"event": "opened", "at": $now, "actor": "system", "note": $note}]'
   );
   ```
   Where `$note = "Stage '$failure_stage' failed (2 consecutive failures)"`.
3. Send Telegram alert (see Alert Rules).

**Deduplication:** If an open incident already exists, do NOT create a new one. Instead, append a timeline event to the existing incident:
```json
{ "event": "failure", "at": "$now", "actor": "system", "note": "Check failed again — stage '$failure_stage'" }
```

**If failure count reaches 3, 4, etc.:** Only append timeline events. Never open a second incident.

---

## Rule 2: Auto-Resolve an Incident

**Trigger:** A check completes with `status = 'passed'` AND an open incident exists for this service.

**Action:**
1. Update the incident:
   ```sql
   UPDATE incidents
   SET status = 'resolved',
       resolved_at = $now,
       resolution_type = 'auto',
       updated_at = $now,
       timeline = timeline || '[{"event": "resolved", "at": $now, "actor": "system", "note": "Check passed"}]'
   WHERE service_id = $service_id AND status IN ('open', 'acknowledged');
   ```
2. Send Telegram recovery alert (see Alert Rules).

**If the incident was acknowledged before resolution:** Auto-resolve still fires. The `acknowledged_at` timestamp is preserved. Resolution type is still `'auto'`.

---

## Rule 3: Manual Acknowledge

**Trigger:** Authenticated user clicks "Acknowledge" on an open incident in the UI.

**Condition:** `incident.status = 'open'`

**Action:**
1. Update the incident:
   ```sql
   UPDATE incidents
   SET status = 'acknowledged',
       acknowledged_at = $now,
       updated_at = $now,
       timeline = timeline || '[{"event": "acknowledged", "at": $now, "actor": "user"}]'
   WHERE id = $incident_id AND status = 'open' AND user_id = auth.uid();
   ```

**No alert sent for acknowledgement.**

---

## Rule 4: Manual Resolve

**Trigger:** Authenticated user clicks "Resolve" on an open or acknowledged incident.

**Condition:** `incident.status IN ('open', 'acknowledged')`

**Action:**
1. Update the incident:
   ```sql
   UPDATE incidents
   SET status = 'resolved',
       resolved_at = $now,
       resolution_type = 'manual',
       updated_at = $now,
       timeline = timeline || '[{"event": "resolved", "at": $now, "actor": "user"}]'
   WHERE id = $incident_id AND status IN ('open', 'acknowledged') AND user_id = auth.uid();
   ```

**No Telegram alert for manual resolution.**

---

## Rule 5: Runner Error Does Not Open Incidents

**Trigger:** A check completes with `status = 'error'` (the runner itself crashed, not the endpoint).

**Action:** None. Do not open, update, or resolve any incident. Log the runner error. The service status is not updated from runner errors.

**Rationale:** Runner errors indicate a problem with CORTX, not with the monitored service. Opening an incident would be a false positive.

---

## Severity Classification

| Failure stage | Severity |
|---|---|
| `availability` | `degraded` |
| `payment_terms` | `degraded` |
| `price_check` | `degraded` |
| `payment` | `critical` |
| `delivery` | `critical` |
| `json_parse` | `critical` |
| `schema_validation` | `critical` |

The severity reflects the impact on the end user:
- **Degraded:** The endpoint may be reachable and functional, but something about the payment configuration is wrong. The service is broken but not urgently so.
- **Critical:** The endpoint accepted payment but failed to deliver or deliver correctly. Money left the test wallet with no valid result. This is the highest-impact failure.

---

## Alert Rules

### Alert on Incident Open

Sent when Rule 1 fires (new incident created).

**Destination:** `service.telegram_chat_id`

**Message format:**
```
🔴 CORTX Alert — [Service Name]

Status: Critical  (or: Degraded)
Failed stage: [stage name]
Endpoint: [endpoint_url]

View incident: https://cortx.app/incidents/[incident_id]
```

**Retry:** 3 attempts, exponential backoff (2s, 4s, 8s). Log failure after all retries exhausted. Do not block the check runner.

**Failure handling:** If delivery fails after all retries, record the delivery failure in the incident timeline:
```json
{ "event": "alert_failed", "at": "$now", "actor": "system", "note": "Telegram delivery failed after 3 attempts" }
```

---

### Alert on Incident Resolve (Auto Only)

Sent when Rule 2 fires.

**Destination:** `service.telegram_chat_id`

**Message format:**
```
✅ CORTX Resolved — [Service Name]

Service has recovered. All stages passing.

View details: https://cortx.app/services/[service_id]
```

**Retry:** Same as open alert (3 attempts, exponential backoff).

---

### No Alert On

- Acknowledgement (Rule 3)
- Manual resolve (Rule 4)
- Runner error (Rule 5)
- Consecutive failures after incident already open (only timeline append)

---

## Service Status Updates

Service status is updated by the check runner after every check, regardless of incident state.

| Check result | Service status |
|---|---|
| All stages passed, latency ≤ threshold | `operational` |
| All stages passed, latency > threshold | `degraded` |
| Any stage failed | `degraded` or `critical` (from severity table) |
| Runner error | Unchanged (keep previous status) |

`services.last_check_at` is updated after every check (including failures, not including runner errors).

---

## Incident Deduplication Invariant

At most one incident with `status IN ('open', 'acknowledged')` may exist per service at any time. This is enforced at the application level (check before insert) and optionally at the DB level via a partial unique index:

```sql
CREATE UNIQUE INDEX incidents_one_open_per_service
  ON public.incidents (service_id)
  WHERE status IN ('open', 'acknowledged');
```

---

## Consecutive Failure Count Query

```sql
WITH ordered AS (
  SELECT status, ROW_NUMBER() OVER (ORDER BY started_at DESC) AS rn
  FROM checks
  WHERE service_id = $service_id
)
SELECT COUNT(*) AS consecutive_failures
FROM ordered
WHERE rn <= (
  SELECT COALESCE(MIN(rn) - 1, (SELECT MAX(rn) FROM ordered))
  FROM ordered
  WHERE status = 'passed'
) AND status = 'failed';
```

Simpler application-level version: fetch the last N checks ordered by `started_at DESC`, walk from newest to oldest, count `'failed'` records until you hit the first `'passed'` or run out of records. Stop at `'error'` records (do not count, do not stop).
