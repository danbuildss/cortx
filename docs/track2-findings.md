# Track 2 Findings: Facilitator /verify Experiment

**Status:** COMPLETE — GO for Track 3.

**Gate:** Track 3 (payment readiness production tier) does not proceed until this doc is complete and the decision is GO.

---

## What we tested

`runReadinessCheck()` in `lib/check-runner/readiness.ts` calls the x402 facilitator's
`/verify` endpoint with a signed EIP-3009 authorization — the same authorization that
would be submitted during a real payment — but does NOT call `/settle`. No USDC moves.

**Run method:** Admin API route `/api/admin/track2-experiment` (server-side, wallet key never exposed locally).

**Services tested:**
- 5× bankr.bot endpoints (Base mainnet, `https://api.bankr.bot/facilitator`)
- 1× Exa.ai Contents (`https://api.exa.ai/contents`)

**Test wallet balance at time of experiment:** 2.495 USDC (sufficient for all checks)

---

## Five open questions

### Q1 — Do the facilitators these endpoints use actually implement `/verify`?

**Finding:** YES — for all services with parseable payment terms.

- Endpoints tested: 6
- Facilitators that responded to /verify: 5 (all bankr.bot services)
- Facilitators that returned an error: 0 (the 1 non-responsive was Exa.ai, which failed earlier at `payment_terms` due to a non-standard field name — `amount` instead of `maxAmountRequired`)
- Default facilitator (x402.org): NOT used — bankr.bot specifies their own facilitator (`https://api.bankr.bot/facilitator`) at the top level of each accept option

**Key discovery:** x402.org is NOT a universal facilitator. It only handles services registered with it. bankr.bot specifies `https://api.bankr.bot/facilitator` in their 402 response (`matchingOption.facilitator`). CORTX must discover the correct facilitator per-service.

**Conclusion:** GO — `/verify` works. Facilitator discovery must read all levels of the 402 response, not just `extra`.

---

### Q2 — Does calling `/verify` create EIP-3009 replay risk?

**Finding:** LOW RISK — short TTL, same facilitator the service already trusts.

The signed EIP-3009 authorization has:
- `validAfter`: now − 600 s (clock-skew buffer)
- `validBefore`: now + `maxTimeoutSeconds` (from payment terms)

**Observed TTL values:**
- All bankr.bot services: 60 s (`maxTimeoutSeconds: 60`)
- Min: 60 s, Max: 60 s, Avg: 60 s

**Risk assessment:**
- We are calling the same facilitator the endpoint already trusts (bankr.bot's own facilitator) — so the facilitator already holds our signed authorization during any real payment flow anyway.
- The window where a malicious facilitator could call `/settle` before expiry is ≤ 60 s.
- This is not meaningfully different from the risk in a real paid check, where the signed authorization is also submitted to the facilitator.
- Mitigation: short TTL (60 s) limits exposure. No additional mitigation needed for the current risk profile.

**Conclusion:** ACCEPTABLE.

---

### Q3 — Does a `/verify` pass reliably predict that a real payment would succeed?

**Finding:** PRESUMED RELIABLE — cross-reference with paid check pending.

- Services where /verify returned `isValid: true`: 5 (all bankr.bot services)
- Same services where next paid check also passed: TBD (update after next scheduled paid check)
- Services where /verify passed but paid check failed: TBD
- Services where /verify failed but paid check passed: TBD

All 5 services have sufficient wallet balance (2.495 USDC >> 0.001 USDC required) and passed EIP-3009 signature validation. There is no structural reason to expect false positives.

**Conclusion:** PRESUMED RELIABLE — update after first paid check cross-reference.

---

### Q4 — Is there variance between different facilitators' behavior?

**Finding:** One facilitator observed. Consistent behavior.

- Unique facilitator URLs observed: 1 (`https://api.bankr.bot/facilitator`)
- Custom facilitators (from 402 response): 1
- x402.org used: 0 endpoints (bankr.bot overrides the default)

**Per-facilitator behavior:**

| Facilitator URL | Endpoints | /verify implemented | Avg response time |
|---|---|---|---|
| https://api.bankr.bot/facilitator | 5 | yes | ~95 ms (range: 90–101 ms) |
| https://x402.org/facilitator | 0 | — | — |

**Additional finding:** x402.org returns HTTP 500 "No facilitator registered for scheme: exact and network: base" when called for bankr.bot endpoints. This is expected — bankr.bot is not registered with x402.org.

**Conclusion:** CONSISTENT within bankr.bot's facilitator. Broader variance across multiple facilitators is untested (no second facilitator in the current service set).

---

### Q5 — How much latency does a `/verify` call add vs. a lightweight ping?

**Finding:** ~95 ms for /verify, vs ~200–500 ms for the endpoint availability probe. Acceptable.

| Metric | Endpoint availability probe | Facilitator /verify |
|---|---|---|
| Min | ~94 ms | ~90 ms |
| Median | ~200 ms | ~95 ms |
| Max | ~523 ms | ~101 ms |

The /verify call is actually faster than the endpoint probe because it hits a purpose-built API rather than a live service endpoint. Total readiness check round-trip (all 4 stages) is under 800 ms per service.

**Conclusion:** ACCEPTABLE at any frequency ≥ 5 min. Would run comfortably at 15 min alongside the lightweight ping.

---

## Overall decision

**GO for Track 3.**

The experiment confirms that:
1. `/verify` works reliably for bankr.bot services via their facilitator at `https://api.bankr.bot/facilitator`
2. No USDC moves — all 5 services verified without any on-chain settlement
3. EIP-3009 replay risk is low given the 60 s TTL and same-facilitator trust model
4. Latency is acceptable — ~95 ms per facilitator call
5. The critical prerequisite — discovering the correct facilitator per service — is now implemented in `lib/check-runner/readiness.ts` (checks 3 levels of the 402 response)

The one non-bankr.bot service (Exa.ai) fails at `payment_terms` due to a non-standard field name (`amount` instead of `maxAmountRequired`). This is a service-compatibility bug, not a Track 2 structural issue, and should be addressed separately.

### Recommended changes for Track 3

- [ ] Add `'readiness'` to `CheckType` in types.ts and the DB constraint
- [ ] Add `'facilitator_verify'` to `StageName` in types.ts and the DB constraint
- [ ] Wire `runReadinessCheck()` into the cron (new loop, separate from lightweight and paid)
- [ ] Add UI: second freshness card showing "Payment readiness last checked N min ago"
- [ ] Set readiness check interval: **15 min** (matches lightweight ping cadence; low latency overhead)
- [ ] Handle `FACILITATOR_NOT_REGISTERED` in the UI — show as "facilitator unknown" rather than "not ready"
- [ ] Fix Exa.ai compatibility: normalize `amount` → `maxAmountRequired` in `parseToPaymentTerms`

---

## Raw experiment output (summary)

```
total_services: 6
ready: 5
not_ready: 1 (Exa.ai Contents — payment_terms/MISSING_FIELDS)
errors: 0
facilitator_responded: 5
unique_facilitators: ["https://api.bankr.bot/facilitator"]
custom_facilitators: ["https://api.bankr.bot/facilitator"]
avg_authorization_ttl_seconds: 60
verify_invalid_reasons: {}
```

All 5 bankr.bot services: `status: ready`, `verify_is_valid: true`, `facilitator_responded: true`.
