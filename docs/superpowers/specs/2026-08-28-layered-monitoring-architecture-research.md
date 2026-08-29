# CORTX Layered Monitoring Architecture — Research Document

**Date:** Aug 28, 2026  
**Status:** Research only — do not implement yet  
**Author:** Dan (via Claude)

---

## The Problem

CORTX's synthetic check is fundamentally correct: real x402 reliability requires a real payment. But every check being a full paid check creates a cost structure that breaks at scale.

At $0.001/check (Bankr endpoint), 1 endpoint × every 60s = **$43.20/month** in endpoint payments alone. At 100 endpoints that's **$4,320/month** before infrastructure — before CORTX has a subscription model to offset it.

This is not a "USDC is expensive" problem. It's an architecture problem: CORTX currently conflates **evidence of payment readiness** with **evidence of paid delivery**, and uses the expensive one for everything.

---

## Key Finding: x402 Already Separates Verify from Settle

This is grounded in the x402 package (v1.2.0) that CORTX already installs.

The `x402/verify` module exports two distinct functions:

```typescript
// POST /verify — validates authorization without on-chain execution
verify(payload, paymentRequirements): Promise<{ isValid: boolean, ... }>

// POST /settle — executes the on-chain transfer
settle(payload, paymentRequirements): Promise<{ success: boolean, txHash: string, ... }>
```

**CORTX's current `executePayment` in `lib/check-runner/payment.ts` calls `createPaymentHeader` from `x402/client` — which creates a signed EIP-3009 authorization payload but does NOT call `/settle`.** The settlement happens inside the endpoint provider's server when it receives the `X-Payment` header.

So the current CORTX payment flow is:
```
CORTX: createPaymentHeader() → signed X-Payment header
CORTX: sends X-Payment header to endpoint
Endpoint's server: calls facilitator /settle → USDC moves
Endpoint's server: executes service → returns 200
```

This means **CORTX never calls `/settle` itself.** It creates the signed authorization and sends it. The endpoint controls settlement.

---

## What Payment Readiness Can Prove (Without Spending)

A Payment Readiness check would do exactly what the current runner does up through Stage 7 (payment), but instead of sending the X-Payment header to the endpoint, it calls the facilitator's `/verify` endpoint directly and stops.

**Stages that run in a Readiness check (zero USDC cost):**

| Stage | What it proves |
|---|---|
| `availability` | Endpoint is reachable, returns 402 |
| `payment_terms` | 402 body is valid, payment requirements parseable |
| `price_check` | Price within expected/max bounds, no drift |
| `payment` (authorization only) | EIP-3009 signature is constructable; wallet has sufficient balance |
| `facilitator_verify` *(new)* | Facilitator `/verify` returns `isValid: true` |

**What Readiness cannot prove:**

- The endpoint will actually deliver after receiving payment
- The endpoint's server correctly calls `/settle`
- The response body is valid JSON
- The schema matches expected

This is the honest, non-overstated boundary. Readiness ≠ Delivery.

---

## Proposed Architecture: Four Evidence Layers

### L1 — Payment Readiness (free, continuous)

Every 1–5 minutes. No USDC spent.

```
availability → payment_terms → price_check → authorization → facilitator /verify
```

Result shown to users:
```
Payment Readiness   ✓  verified 23s ago   $0 spent
```

New CheckType: `'readiness'` (or repurpose existing `'lightweight'`)  
New StageName: `'facilitator_verify'`

### L2 — Paid Delivery Canary (periodic, real USDC)

Every 30min–6hr–24hr depending on endpoint price and historical reliability.

```
availability → payment_terms → price_check → payment → delivery → json_parse → schema_validation
```

This is the existing full runner — unchanged.

Result shown:
```
Last Paid Delivery  ✓  verified 3h ago    $0.001 spent
```

### L3 — Triggered Paid Check (anomaly-driven)

If L1 detects: price changed, payment terms changed, endpoint recovered from downtime, facilitator returned unexpected result, latency spike — run L2 immediately.

```
probe → probe → probe → ANOMALY → PAY → probe → probe
```

This is how the expensive checks become event-driven rather than time-driven.

### L4 — Passive Telemetry (future, provider-integrated)

Provider integrates CORTX middleware/SDK. Real customer transactions contribute evidence. Synthetic L1/L2 become independent audits.

**Do not build L4 yet.** Requires SDK, provider adoption, and the trust model between provider-reported vs CORTX-observed evidence to be worked out first.

---

## Cost Model Comparison

| Endpoint price | Current (every 4h paid) | Proposed (readiness + daily paid) |
|---|---|---|
| $0.001 | $0.006/day | $0.001/day + free readiness |
| $0.10 | $0.60/day | $0.10/day + free readiness |
| $1.00 | $6.00/day | $1.00/day + free readiness |
| $5.00 | $30.00/day | $5.00/day + free readiness |

At 100 endpoints with $0.001 average price and daily paid checks:
- **Current (every 4h):** ~$180/day
- **Proposed (daily paid + continuous readiness):** ~$30/day

Savings from trigger-based paid checks (stable endpoints: weekly): ~96% reduction.

---

## Implementation Path

### Experiment (do this first)

**Do not redesign CORTX yet.** Prototype a standalone `runReadinessCheck()` function alongside the existing runner.

**What to prove:**
1. Can CORTX call the facilitator `/verify` endpoint for the endpoints it already monitors?
2. Does `/verify` reliably return `isValid: true` for healthy endpoints without USDC movement?
3. Does `/verify` catch real failures (changed terms, bad signature, wrong recipient)?

**Technical changes needed for the prototype:**

1. Add `'readiness'` to `CheckType` in `lib/check-runner/types.ts`
2. Add `'facilitator_verify'` to `StageName`
3. New `runReadinessCheck()` in `lib/check-runner/runner.ts`:
   - Reuses stages 1–5 (availability through price_check) unchanged
   - Stage 6: constructs payment authorization (same as now, `createPaymentHeader`)
   - Stage 7 (new): calls `useFacilitator(facilitator).verify(payload, requirements)` from `x402/verify`
   - Returns result without calling delivery
4. Add `readiness_checked_at` / `last_readiness_check_at` column to `services`
5. New cron loop for readiness checks (separate from existing paid check loop)
6. New UI state: "Payment Readiness" card alongside "Last Paid Delivery" card

**What to measure from the experiment:**
- `/verify` success rate vs full paid check success rate (do they agree?)
- Latency of a readiness check vs full paid check
- False positives: `/verify` passes but full paid check fails (or vice versa)
- Facilitator behavior variation across the endpoints CORTX monitors

### UI change (after experiment proves out)

Replace the single "Last checked" timestamp with two rows:

```
Endpoint              operational
Payment Readiness     ✓  34s ago
Last Paid Delivery    ✓  3h ago
Price                 $0.001 USDC · Base
Facilitator           Verified
30D Paid Delivery     99.91%
```

This is more honest than a single uptime number — an agent reading CORTX can see the freshness of each type of evidence independently.

---

## The Canary Endpoint Standard (research idea, do not build)

The research surfaces an interesting possible future: providers expose a cheap endpoint exercising the same payment infrastructure:

```
/.well-known/x402-canary
Price: $0.0001
Same facilitator, same payment scheme, same settlement path
Returns a deterministic tiny payload instead of invoking expensive service
```

CORTX could push this as an open micro-specification.

**Important caveat:** Canary healthy ≠ production service healthy. It proves payment infrastructure health, not service delivery health. Any canary implementation must make this distinction explicit.

**Do not standardize this yet.** Research whether:
- The x402 ecosystem already has a standard for this
- Coinbase/facilitators have test/simulation mechanisms
- The protocol already supports this without CORTX inventing a new convention

---

## Evidence Classification (future trust model)

Long-term, CORTX will have three classes of evidence with different trust levels:

| Class | Source | Trust level |
|---|---|---|
| **Probed** | CORTX independently tested payment readiness | CORTX-observed |
| **Verified** | CORTX spent USDC and validated full delivery | CORTX-observed + on-chain |
| **Observed** | Provider-reported production telemetry | Provider-reported (lower trust, label separately) |

**Never mix these into a single metric without labeling.** This distinction becomes critical if CORTX eventually builds machine-commerce protection — the "CORTX Protect" direction requires knowing whether evidence came from CORTX's independent verification or from the provider themselves.

---

## Connection to Machine Commerce Protection

This architecture directly enables the long-term Protect direction:

- L1 Readiness → proves payment path is operational
- L2 Paid Canary → proves complete delivery works
- The gap between them → identifies `PAID + FAILED DELIVERY` events

The stage-level evidence CORTX already captures (`failure_stage`, per-stage JSONB) is exactly the data a protection mechanism would need to determine whether a seller should keep the money after a failed delivery.

These aren't two separate ideas — they're one coherent evidence architecture.

---

## Open Questions Before Implementation

1. **Facilitator behavior:** Does Coinbase's default facilitator (`api.cdp.coinbase.com`) accept `/verify` calls from arbitrary clients, or only from registered endpoints? Is there rate limiting or auth required for verify-only calls?

2. **Authorization replay risk:** A signed EIP-3009 authorization has a validity window (nonce + deadline). If CORTX calls `/verify` with a signed authorization, can that same authorization later be replayed in a `/settle` call? If yes, readiness checks are a security concern — they're creating live signed authorizations that go unused.

3. **Facilitator variance:** Not all x402 endpoints use the same facilitator. CORTX needs to call the *endpoint's* facilitator for `/verify`, not a hardcoded default. The payment requirements returned in the 402 response specify which facilitator to use.

4. **False confidence risk:** If readiness passes but paid delivery fails (e.g. facilitator accepts authorization but endpoint's server has a bug in its `/settle` call), CORTX must never surface this as "healthy." The readiness result must be clearly distinct from the delivery result.

5. **Provider canary standard:** Research x402 GitHub issues, Coinbase x402 Discord, and the coinbase/x402 repo for any existing proposals around test/canary endpoints or simulation modes.

---

## Recommendation

**Run the experiment first.** The technical foundation is real — x402 already separates `/verify` from `/settle`, and CORTX's `payment.ts` doesn't call `/settle` anyway. The unknown is facilitator behavior in practice.

Before changing production:
1. Build `runReadinessCheck()` in a feature branch
2. Test against the endpoints CORTX already monitors
3. Answer the five open questions above
4. Report: does `/verify` reliably detect failures that full paid checks catch?

If the answer is yes — this is one of the most important architectural changes CORTX can make, turning it from a synthetic x402 monitor into a scalable machine-payment observability system.

If the answer is no (facilitator doesn't support it, or authorization replay is a real risk) — the research was still worth doing, and the paid canary frequency reduction alone (daily instead of every 4h) still cuts costs significantly.
