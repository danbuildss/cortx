# Track 2 Findings: Facilitator /verify Experiment

**Status:** PENDING — run `scripts/track2-experiment.ts` against live services and fill this in.

**Gate:** Track 3 (payment readiness production tier) does not proceed until this doc is complete and the decision is GO.

---

## What we tested

`runReadinessCheck()` in `lib/check-runner/readiness.ts` calls the x402 facilitator's
`/verify` endpoint with a signed EIP-3009 authorization — the same authorization that
would be submitted during a real payment — but does NOT call `/settle`. No USDC moves.

**Run command:**
```bash
CORTX_TEST_WALLET_KEY=0x... \
NEXT_PUBLIC_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npx ts-node scripts/track2-experiment.ts
```

---

## Five open questions

### Q1 — Do the facilitators these endpoints use actually implement `/verify`?

**Finding:** _[FILL IN after running experiment]_

- Endpoints tested: N
- Facilitators that responded to /verify: N
- Facilitators that returned 404/500/no-response: N
- Default facilitator (x402.org) responded: yes/no

**Conclusion:** GO / NO-GO (if facilitators don't implement /verify, this track is blocked)

---

### Q2 — Does calling `/verify` create EIP-3009 replay risk?

**Finding:** _[FILL IN after running experiment]_

The signed EIP-3009 authorization has:
- `validAfter`: now - 600s (clock skew buffer)
- `validBefore`: now + `maxTimeoutSeconds` (from payment terms — typical: N seconds)

After `/verify`, the facilitator holds a signed authorization valid for `maxTimeoutSeconds`.
A malicious or compromised facilitator could call `/settle` with this authorization before it expires.

**Observed TTL values:**
- Min: Ns, Max: Ns, Avg: Ns

**Risk assessment:** _[FILL IN]_

- Are we calling the same facilitator the endpoint already trusts? yes/no
- Is this meaningfully different from the risk in a real paid check? yes/no
- Mitigation options considered: _[FILL IN if risk is non-trivial]_

**Conclusion:** ACCEPTABLE / UNACCEPTABLE

---

### Q3 — Does a `/verify` pass reliably predict that a real payment would succeed?

**Finding:** _[FILL IN after cross-referencing with next scheduled paid check]_

- Services where /verify returned `isValid: true`: N
- Same services where next paid check also passed: N
- Services where /verify passed but paid check failed: N (false positives)
- Services where /verify failed but paid check passed: N (false negatives)

**Note:** This question requires waiting for the next scheduled paid check after running
the experiment, then comparing results. Update this section after cross-referencing.

**Conclusion:** RELIABLE / UNRELIABLE

---

### Q4 — Is there variance between different facilitators' behavior?

**Finding:** _[FILL IN after running experiment]_

- Unique facilitator URLs observed: N
- Custom facilitators (from payment terms extra field): N
- Default facilitator (x402.org) used by N endpoints

**Per-facilitator behavior differences:** _[FILL IN]_

| Facilitator URL | Endpoints using it | /verify implemented | Avg response time |
|---|---|---|---|
| https://x402.org/facilitator | N | yes/no | Nms |

**Conclusion:** CONSISTENT / VARIES (and how)

---

### Q5 — How much latency does a `/verify` call add vs. a lightweight ping?

**Finding:** _[FILL IN after running experiment]_

| Metric | Lightweight ping | Readiness /verify |
|---|---|---|
| Min | Nms | Nms |
| Median | Nms | Nms |
| P95 | Nms | Nms |
| Max | Nms | Nms |

**Conclusion:** ACCEPTABLE / TOO SLOW for the intended frequency of Nmin

---

## Overall decision

**GO / NO-GO for Track 3**

_[FILL IN — one paragraph explaining the decision based on the five findings above]_

### If GO: recommended changes for Track 3

- [ ] Add `'readiness'` to `CheckType` in types.ts and the DB constraint
- [ ] Add `'facilitator_verify'` to `StageName` in types.ts and the DB constraint
- [ ] Wire `runReadinessCheck()` into the cron (new loop, separate from lightweight and paid)
- [ ] Add UI: second freshness card showing "Payment readiness last checked N min ago"
- [ ] Set readiness check interval (recommendation from findings: N min)

### If NO-GO: reason

_[FILL IN]_

---

## Raw experiment output

_[PASTE the output of `npx ts-node scripts/track2-experiment.ts` here]_

```
(paste here)
```
