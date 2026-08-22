# CORTX — Product Specification

## Executive Summary

CORTX is agent reliability infrastructure. It performs controlled synthetic tests against paid x402 endpoints and tells builders whether each stage of the full service journey — availability, payment terms, payment, delivery, JSON validity, schema conformance — is working or broken.

A service can be reachable and completely non-functional from a paying caller's perspective. CORTX closes that gap.

**Tagline:** Check before you call.
**Category:** Agent Reliability Infrastructure

---

## Problem

Paid agent endpoints on the x402 protocol are composite services. A single call involves:

1. Reaching the endpoint
2. Receiving valid payment terms
3. Paying the correct amount
4. Receiving a result
5. Receiving valid JSON
6. Receiving a result that matches the expected shape

Standard uptime monitors check step 1 only. Steps 2–6 can fail silently. A builder whose endpoint is listed in Bankr has no visibility into whether real callers are succeeding or failing — only that the server is responding.

There is no tool that tests the full x402 journey. CORTX is that tool.

---

## Product Definition

CORTX monitors x402 endpoints by executing controlled synthetic tests on a schedule. Each test traverses the full service journey and records the result at every stage. When a stage fails, CORTX opens an incident, records evidence, and notifies the builder.

CORTX is not a proxy, a marketplace, a routing layer, or an analytics platform. It is a reliability monitor.

---

## Target User

**V1 user:** A Bankr builder who owns one or more x402 endpoints.

Characteristics:
- Has deployed a working x402 service
- Has registered it in Bankr
- Has real callers or expects them soon
- Has no visibility into end-to-end reliability from a caller's perspective
- Wants to know before their users tell them something is broken

---

## Primary Use Case

A builder registers their x402 endpoint with CORTX. CORTX runs a synthetic check every N minutes, paying a small real amount from a dedicated testing wallet. The builder sees a live service status. When something fails — payment rejected, wrong price, no delivery, schema mismatch — CORTX opens an incident and sends a Telegram alert. The builder sees exactly which stage failed and what evidence was recorded.

---

## User Value

- **Know before your callers know.** Breakage is detected by CORTX, not reported by users.
- **Full journey coverage.** Not just ping. Payment, delivery, schema — all tested.
- **Evidence at every stage.** Not just "it failed." The exact failure and the raw data.
- **Deterministic alerting.** No AI confidence scores. A failure is a failure.

---

## V1 Features

### Service registration
- Service name
- Endpoint URL
- Environment (mainnet / testnet)
- Safe test input payload
- Expected response schema (JSON Schema)
- Expected price (in supported unit)
- Maximum permitted test price (hard ceiling, enforced server-side)
- Latency threshold (ms)
- Testing frequency (minutes)
- Alert destination (Telegram chat ID)

### Synthetic check pipeline
1. Validate URL
2. Start timer
3. Test availability (HTTP reachability)
4. Inspect payment requirements (402 response parsing)
5. Parse observed price
6. Compare price against expected and maximum values
7. Execute controlled payment
8. Confirm result delivery
9. Parse JSON
10. Validate schema using AJV
11. Record latency
12. Classify status
13. Store evidence
14. Create or resolve incident

### Service statuses
- **Operational** — all stages passing, latency within threshold
- **Degraded** — non-critical failures or latency exceeded
- **Critical** — payment, delivery, or schema failure
- **Unknown** — no check completed yet, or check data expired

### Screens
- Landing page
- Login / sign up
- Overview (all services)
- Add service
- Service detail (status + check history + incidents)
- Check evidence (single check detail)
- Incidents
- Alert settings

### Alerts
- Telegram (first and only V1 channel)
- Alert on incident open
- Alert on incident resolve

---

## Explicit Exclusions

These are not in V1 and will not be added until after a validated private beta:

| Item | Reason excluded |
|---|---|
| MCP monitoring | Different protocol, different product surface |
| Automatic provider routing | Routing layer, not monitoring |
| Marketplace functionality | Separate product concern |
| Agent reviews | Community feature, not reliability infrastructure |
| Reputation scores | Requires aggregate data and social layer |
| Teams / multi-user | Auth complexity, not needed for V1 solo builders |
| Token functionality (`$CRTX`) | Premature, adds regulatory surface |
| Complex analytics | Distraction from core reliability signal |
| AI-generated reliability scores | Non-deterministic; trust is built on deterministic rules |
| Multiple payment networks | x402 only in V1 |
| Mobile applications | Web first, always |
| Email alerts | Telegram only in V1 |
| Webhook alerts | After Telegram is validated |
| Public status pages | Phase 1.5, not V1 |
| API access for builders | After internal stabilization |

---

## Product Principles

**1. Deterministic over probabilistic.** Status is computed from discrete pass/fail results. No confidence intervals. No ML. A check passed or it did not.

**2. Evidence over assertion.** Every status claim is backed by raw evidence: the response body, the price observed, the failure stage, the latency. The builder can verify every result.

**3. Narrow beats broad.** V1 does one thing. It monitors x402 endpoints. No scope creep until core reliability is validated in production.

**4. Infrastructure aesthetics.** The UI must feel like Vercel, Better Stack, Linear. Serious software used by serious builders. No consumer UI patterns.

**5. Real money, real results.** Checks use real payments from a dedicated wallet. Synthetic tests that do not pay are not reliable tests of a paid service.

**6. Fail loudly, recover cleanly.** When a check fails, CORTX is explicit about the failure stage and evidence. When a service recovers, the incident closes automatically.

---

## Status Definitions

| Status | Definition |
|---|---|
| **Operational** | Last check passed all 6 stages within latency threshold |
| **Degraded** | Last check passed core stages but latency exceeded threshold, or a non-payment stage had a soft failure |
| **Critical** | Last check failed at payment terms, payment, delivery, JSON parse, or schema validation |
| **Unknown** | No check has completed, last check is stale (>2× the check interval), or service was just registered |

Status is always derived from the most recent check result. It is never inferred or interpolated.

---

## Canonical Roadmap

V1 is complete. The full roadmap beyond V1 is:

### V1.1 — Monitoring Integrity (ship now)

Not a new product version — a hardening milestone. CORTX must never imply paid verification is healthy when it has silently stopped.

- Fix SSRF gap in the verification confirmation endpoint
- Atomic spend reservation (prevent concurrent checks from racing the shared budget)
- Budget exhaustion alerts: low-balance, daily cap hit, monthly cap hit
- Explicit "monitoring paused" state visible to the builder when spend is exhausted
- Stale paid-verification state detection (paid check has not run in N intervals)
- Rate limiting on exposed sensitive routes
- Remove or restrict the `_debug` field from production API responses
- Admin PATCH allowlist

### V1.5 — Reliability Data Foundation (before V2 public expansion)

Goal: Ensure every check performed from V1 forward contributes useful evidence to the V3 Intelligence layer. Audit what is currently retained in `checks.stages` and add any non-reconstructable observations.

Candidates for addition (only data that cannot be reconstructed later):
- x402 protocol version detected
- Payment scheme (`x402`, other)
- Facilitator identity when detectable
- Network and asset observed
- Quoted amount vs. configured max amount
- Recipient fingerprint (hashed where privacy warrants)
- Per-stage duration
- Payment outcome code
- Delivery outcome code
- HTTP response fingerprint (status + content-type)
- Price drift (observed vs. expected delta)
- Verification cost (actual USDC spent)
- Failure code (fine-grained, beyond stage name)
- Check type (CORTX-funded observation vs. managed/paid)

**Principle:** Keep raw verification observations as source of truth. Derived scores and rollups can be computed later. Never prematurely store `CORTX Score = 94` — store the observations that produce it.

### V2 — Verify + Reliability Network

2.1 **Service identity model**
- **Observed** — CORTX independently tracks the endpoint
- **Claimed** — owner has proven control via token challenge
- **Verified** — Claimed + recent successful paid verification (with freshness threshold)

2.2 **Add Your Endpoint (public CTA)**
Flow: Submitted → Safety preflight → Cost analysis → Manual review → Approved → Observed. CORTX never automatically spends money on a submitted URL.

2.3 **CORTX-funded observation tier**
Curated, not unlimited. Internal ecosystem observation budget. Cost-aware cadence (a $0.01 endpoint checks daily; a $0.10 endpoint checks every few days; a $5 endpoint is not CORTX-funded on a recurring basis).

2.4 **Managed monitoring for owners**
Owners who want higher frequency, expensive endpoints, custom payloads, or stronger history purchase CORTX verification credits. The CORTX execution wallet performs the checks. Builders do not operate wallets.

### V3 — Intelligence

- **Reliability Explorer**: transform the registry into "Explore x402 Reliability" — show delivery rate, payment success, schema validity, price stability, latency, incidents, last real verification, sample count, verification freshness, trust tier
- **Historical reliability**: answer "has this service been dependable over time?" not just "is it up right now?"
- **CORTX Score**: only after sufficient data density per endpoint; always shown with a confidence band (e.g., "97/100 — Low confidence: 11 observations" vs. "96/100 — High confidence: 4,829 observations")
- **Ecosystem intelligence** (when dataset is meaningful): payment failure trends, schema drift, price drift, reliability by capability, facilitator health

**V3 launch gate:** Do not expose CORTX Score until each endpoint has sufficient paid observations over sufficient time. Exact threshold defined when V3 engineering begins.

### V4 — Preflight + Select

- **Preflight API**: `Should I pay this endpoint?` → returns Safe / Caution / Avoid with evidence
- **MCP tools**: `cortx_preflight`, `cortx_reliability`, `cortx_incidents`, `cortx_rank`
- **Bankr integration**: `@bankrbot check this endpoint with CORTX before I pay`
- **Cori layer**: natural-language reliability guardian built on the preflight infrastructure

Launch requires V3 to have sufficient data density.

### V5 — Trust / Attestations (optional)

ERC-8004 machine-readable trust policies. Research identities, attestations, verifiable observations. Build only if ecosystem adoption warrants it. Do not force CORTX into this simply because it fits the agent narrative.

### V6 — Route (optional / earned)

Only build if CORTX's reliability intelligence creates a demonstrable selection advantage. The ideal outcome may be that every router uses CORTX data — a better business than competing with every router.

---

## Main Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| x402 protocol changes break the check runner | Medium | High | Abstract protocol layer; track Bankr changelog |
| Real payment tests incur unexpected costs | Low | Medium | Max-payment enforcement, daily/monthly caps, test wallet isolation |
| SSRF via malicious endpoint URLs | Medium | High | URL validation, private-network blocking before any request |
| False positives erode builder trust | Medium | High | Require N consecutive failures before opening incident |
| Builders do not complete onboarding | Medium | Medium | Minimize required fields; provide sensible defaults |
| Supabase RLS misconfiguration exposes data | Low | High | RLS on every table, tested via separate anon-role test suite |

---

## Validation Criteria

V1 is validated when:

1. Five real Bankr builders have registered services
2. CORTX has run checks continuously for 14 days without false positives
3. At least one real incident has been detected, alerted, and resolved end-to-end
4. No builder has reported a missed failure that CORTX did not catch
5. The check runner has processed real payments without exceeding max-payment limits
