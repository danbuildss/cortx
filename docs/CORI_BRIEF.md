# Cori — Canonical Product & Build Brief

**Status:** canonical, from the founder (Oct 5, 2026). This is the source of truth for what Cori is.
Build specs (starting with [`CORI_SCOUT_V0_SPEC.md`](CORI_SCOUT_V0_SPEC.md)) must trace back to it.
Related permanent principle: [`DATA_COMPOUNDS.md`](DATA_COMPOUNDS.md).

---

## 1. What Cori is

Cori is the autonomous reliability agent for CORTX.

**CORTX** remains the company/product infrastructure: *reliability infrastructure for x402 and machine commerce.*

**Cori** is the autonomous system operating on top of that infrastructure: *Cori continuously discovers, observes, investigates and verifies machine services so CORTX can build independent reliability intelligence about machine commerce.*

Cori is not a separate startup or a product competing with CORTX.

```
CORTX
Reliability infrastructure / network
        │
        ├── Cori
        │   Autonomous reliability agent
        │
        ├── CORTX Registry / Reliability Index
        │   Public reliability intelligence
        │
        ├── CORTX API / MCP
        │   Machine-consumable reliability intelligence
        │
        └── CORTX Dashboard
            Builder monitoring / incidents / alerts
```

Cori should become the thing that is always watching machine commerce.

## 2. Core thesis

The important idea is **not** "build an AI bot that monitors APIs", and **not** "build the largest directory of x402 services".

The thesis: **CORTX should independently observe machine commerce and accumulate evidence about whether paid services actually deliver.** Cori makes this autonomous.

```
DISCOVER → OBSERVE → DETECT → INVESTIGATE → VERIFY → REMEMBER → WARN → RESOLVE
```

The question CORTX should eventually answer better than anyone else:

> **What actually happened when this machine paid this service, and can we prove it?**

## 3. The inspiration — but don't clone Aeon

Aeon showed that an autonomous system can continuously do useful work, investigate problems and create public proof of that work. Their security agent doesn't just say "we scan repositories"; it points to real problems it found.

CORTX shouldn't merely say "we monitor x402". It should eventually be able to say: *"Here are machine-payment failures Cori independently discovered, reproduced, investigated and watched recover."*

We take the autonomous proof-of-work idea, not Aeon's product.

## 4. Differentiation from ScoutScore and similar products

ScoutScore already discovers/indexes x402 services, runs paid probes and offers scoring/API/MCP.

**Do NOT turn Cori into another x402 directory + score.** Don't compete primarily on: number of domains discovered, directory size, a generic trust score, "X% of x402 is broken", basic uptime, basic paid probing.

**Compete on depth of evidence:**

- **Exact failure-stage attribution.** `availability → payment_terms → price_check → payment → delivery → json_parse → schema_validation`. Cori should know where a failure occurred.
- **Settlement evidence.** When possible, determine whether money actually moved — especially for *paid but not delivered*.
- **Reproduction.** One strange response must not automatically become a public incident. Cori tries to reproduce failures under controlled rules.
- **Recovery verification.** Not just "looks healthy again": where economically appropriate, run another real paid transaction and prove paid delivery recovered.
- **Longitudinal memory.** Historical prices, payment requirements, x402 versions, latency, response characteristics, paid delivery, schema behaviour, incidents, recoveries, settlement evidence, changes, verification history.

The checker can be open. **The network and the accumulated evidence are the moat.**

## 5. Cori is an investigator, not merely a monitor

```
Cori detects abnormal behavior
        ↓
Checks historical baseline
        ↓
Reproduces anomaly
        ↓
Traces transaction
        ↓
Identifies exact failing stage
        ↓
Determines whether payment settled
        ↓
Collects evidence
        ↓
Human confirmation initially
        ↓
Incident created
        ↓
Provider notified
        ↓
Cori watches recovery
        ↓
Paid recovery verification
        ↓
Incident closed
        ↓
Evidence becomes permanent reliability history
```

Example future incident:

```
CORTX INCIDENT #0042
Service:                     example-service
First observed:              10:42 UTC
Payment terms:               VALID
Authorization:               SUCCESS
Settlement:                  CONFIRMED
Amount:                      0.003 USDC
Network:                     Base
Delivery:                    HTTP 200
JSON:                        VALID
Schema:                      FAILED
Reproduction:                3 / 3 attempts
Provider notified:           11:03 UTC
Recovery observed:           13:12 UTC
Paid recovery verification:  PASSED
Incident closed:             13:18 UTC
Duration:                    2h 36m
```

This is much more valuable than `Reliability Score: 63/100`.

## 6. Evidence states

Conservative terminology: **OBSERVED → REPRODUCED → CONFIRMED → RESOLVED.**

- **Observed** — Cori saw something abnormal. Not enough to publicly claim a provider is broken.
- **Reproduced** — Cori reproduced it under controlled conditions. May still need review.
- **Confirmed** — evidence reviewed/validated enough for CORTX to treat it as a real incident. Initially, **human confirmation is required for third-party public incidents.**
- **Resolved** — CORTX has evidence the failure no longer occurs; for significant paid-path incidents, preferably via another real paid verification.

## 7. False positives are a major product risk

CORTX has already been wrong: incorrect stage interpretation, incidents caused by CORTX's own wallet, unusual endpoint behaviour that wasn't a service failure, request-dependent pricing/behaviour.

Cori must be **evidence-first and conservative**, especially for services discovered automatically. Nothing becomes a public accusation against a third-party provider because Cori saw an unusual response. Initially:

```
Detection → reproduction → evidence → human review → provider contact → publication where appropriate
```

Human involvement shrinks later, when confidence is earned.

## 8. Cori is an agent, but V0 does NOT need an LLM

Describe Cori publicly as an autonomous reliability agent, but don't add AI for the sake of AI. V0 runs on schedulers, parsers, state machines, queues, policies, historical comparisons and deterministic rules.

Later an LLM can assist with incident interpretation, unusual-response analysis, investigation planning, provider-facing explanations, weekly ecosystem reports, remediation suggestions. **The system must stay safe without an LLM.**

## 9. AI must never freely control money (permanent)

Cori will eventually trigger real USDC transactions. An LLM must never be able to decide "I'll spend $20 investigating this endpoint". All money movement goes through deterministic policy, e.g.:

```
MAX_PAYMENT_PER_CHECK        MAX_SERVICE_SPEND_PER_DAY
MAX_GLOBAL_SPEND_PER_DAY     MAX_GLOBAL_SPEND_PER_MONTH
SUPPORTED_NETWORKS           SUPPORTED_ASSETS
PAID_CHECK_COOLDOWN          MAX_INVESTIGATION_RETRIES
KNOWN_GOOD_INPUT_REQUIRED    SERVICE_ALLOWLIST / BLOCKLIST
ANOMALY_TRIGGER_RULES
```

Cori can *request* an action. The policy engine decides whether it is permitted.

## 10. Security architecture

Cori gets its own Hetzner VPS, isolated from Luca:

```
Hetzner Account
├── Luca project  → Luca VPS
└── CORTX project → Cori VPS
```

**The funded CORTX wallet/private key must NOT live on the Cori VPS.** The VPS handles discovery, free probes, baselines, change detection, scheduling, anomaly detection, investigation orchestration, memory, and *queueing* paid verification requests. The existing trusted CORTX payment path (Vercel) remains responsible for signing/spending.

```
                    CORTX WEB (Vercel / Dashboard)
                                │
                                ▼
                         Supabase / DB
                          ▲          ▲
          ┌───────────────┘          └───────────────┐
     CORI VPS                                 PAYMENT EXECUTOR
     Discovery · Observer · Baselines         (trusted runtime)
     Investigator · Scheduler                        │
          │  paid-check request                       │
          └──────────────► DB ◄───────────────────────┘
                                                      ▼
                                                 Base / USDC
                                                      ▼
                                                  Evidence
```

## 11. Cori components

Scout · Observer · Policy · Verifier · Investigator · Memory · Resolution. These do **not** need to be separate microservices; one Cori daemon can contain several workers/modules. Avoid premature distributed architecture.

## 12. Scout

Discovers machine services: `discover → normalize → deduplicate → inspect → classify → queue`.

Sources: official x402 Bazaar/discovery mechanisms, public x402 registries, ecosystem repositories, developer submissions, other credible public sources.

Preserve provenance for every discovery: endpoint, discovery_source, source identifier/url, first_seen_at, last_seen_at, network, asset, price, x402_version, input_metadata, output_metadata, probe_status, eligibility. Discovery history matters: *where did CORTX first discover this service, when did it first appear, how long has CORTX observed it?*

## 13. Observer

Zero/low-cost continuous observation. Facilitator `/verify` readiness isn't reliable enough to depend on, so Observer focuses on what can be observed without settlement: availability, HTTP behaviour, 402 behaviour, payment requirements, quoted price, network, asset, recipient where exposed, x402 version, response time, input/output metadata, changes to terms, safely observable response characteristics. It answers *what does normal look like?* and then *what changed?*

## 14. Memory

Do not merely store current state. Preserve structured historical observations wherever economically / privacy / security appropriate — service discovered, payment terms observed, price observed, latency observed, paid verification performed, settlement result, delivery result, schema result, incident opened, reproduced, provider notified, recovery observed, recovery verified, incident closed. Avoid architectures that overwrite valuable history. The accumulated dataset is part of the moat.

## 15. Verifier

CORTX's independent ground truth: real paid checks when policy allows. **Reuse the existing CORTX paid-check implementation** — no second payment stack. Returns structured evidence the Investigator can consume.

## 16. Investigator

Wakes when Observer/Verifier detects something significant. Its job is to determine what happened: reachable? valid terms? price changed? authorization ok? settled? USDC moved? delivered? HTTP ok but content invalid? JSON valid? schema changed? reproducible? could CORTX itself be the cause? happened before? active incident already? recovered? It produces **structured evidence, not prose.**

## 17. Public proof of work

Eventually Cori generates CORTX's marketing naturally ("Cori performed 12,418 observations this week; 326 paid verifications; 7 payment-path incidents reproduced; 3 services accepted payment but failed valid delivery; 5 recovered"), plus individual case studies. **Don't manufacture dramatic statistics. Evidence first.**

## 18. Reliability Index

A public CORTX Reliability Index can expose what Cori accumulates, but must not become the entire product. Depth over how many endpoints are listed. Example service page: status, observed for N days, paid delivery 30d, last paid verification, price, price changes 30d, P95 paid delivery, incidents 90d, paid-but-not-delivered incidents, last recovery verification, evidence history.

## 19. Agent-facing preflight

Eventually an agent asks *"Should I pay this service right now?"* and CORTX answers with structured, explainable evidence (decision, confidence, observation age, last observation, last paid verification, paid delivery 30d, active incidents, price change, schema drift, recent settlement failure). Avoid black-box scores as the only answer; agents can inspect the evidence.

## 20. The flywheel

More services discovered → more observations → more longitudinal history → more incidents discovered → better investigation data → better reliability intelligence → more agents query CORTX → more providers want CORTX monitoring → more services. A competitor can clone an open checker; they can't instantly clone years of observations, failures, recoveries, incidents, price/latency history, schema changes, provider behaviour and payment/delivery evidence.

## 21–22. Future: Cori Resolution Layer — DO NOT BUILD NOW

Long term, Cori could help get things fixed: detect → investigate → confirm → create remediation task → human/agent fixes → CORTX re-runs the original failure → verify recovery → release reward. CORTX has a natural objective judge: the real economic transaction. *Machines discover work. Humans/agents fix it. CORTX independently verifies the outcome. Machines settle payment.* Saved as **"Cori Resolution Layer — Future"**. The Investigator must become trustworthy first.

## 23. Long-term progression (vision, not roadmap commitment)

| Version | Name | Meaning |
|---|---|---|
| V0 | Scout | See the ecosystem: discover and catalog services |
| V1 | Observer | Learn the ecosystem: continuous observation and baselines |
| V2 | Investigator | Understand failures: detect, reproduce, investigate payment incidents |
| V3 | Reliability Intelligence | Turn history into decisions: deeper history, incident intelligence, agent preflight |
| V4 | Resolution | Help get confirmed problems fixed and verify recovery |
| V5 | Work Network | Coordinate humans and agents around verifiable reliability work |
| V6 | Autonomous Reliability Economy | Service funds a reliability budget → Cori monitors → failure → repair → CORTX verifies → payment settles |

## 24. What we build NOW: Cori Scout V0

1. Discover public x402 services from credible sources.
2. Start with official discovery mechanisms where practical.
3. Normalize endpoint information.
4. Deduplicate services.
5. Preserve discovery provenance.
6. Identify network.
7. Identify asset.
8. Identify price where observable.
9. Identify x402 version.
10. Preserve available input/output metadata.
11. Perform only safe/free probes.
12. Determine whether the endpoint appears eligible for future verification.
13. Feed candidates into the existing CORTX admin/review workflow.
14. Preserve `first_seen` and subsequent observations.
15. Spend zero USDC.
16. Make zero automatic public failure claims.
17. Require no LLM.
18. Run as part of Cori on the dedicated CORTX VPS.

## 25. Scout should reuse CORTX

Don't create parallel systems where CORTX already has x402 parsing, endpoint submissions, admin review, service records, checks, incidents, reliability history, paid verification, triggered checks, spending controls. Cori extends CORTX; it must not become a second codebase that later has to be reconciled.

## 26. VPS deployment

```
CORTX VPS
cori-agent
├── scout
├── observer       [later]
├── investigator   [later]
├── scheduler
└── policy
```

One process is fine initially. Requirements: automatic restart, structured logs, health check, graceful shutdown, environment isolation, no wallet key, least privilege, outbound-request security, resource limits where useful.

## 27. SSRF/security matters immediately

Treat every discovered endpoint as hostile. Address: localhost, private IP ranges, link-local, cloud metadata endpoints, IPv6 private/local ranges, redirects to private destinations, DNS rebinding, unusual ports, malformed URLs, protocol restrictions, request timeouts, response-size limits, redirect limits, concurrency limits, resource exhaustion. **Don't ship a prober that turns our VPS into an SSRF primitive.**

## 28. Cost discipline

```
DISCOVERY              cheap / free / broad
OBSERVATION            cheap / free / frequent
PAID VERIFICATION      selective / controlled
INVESTIGATION          triggered / evidence-driven
RECOVERY VERIFICATION  controlled / valuable
```

Never automatically spend against every discovered endpoint. Later paid-check eligibility depends on known-good input, supported network/asset, price, budget, provider importance, confidence, cooldown, history, anomaly severity.

## 29. Product principle: depth over breadth

If another product tracks 5,000 services and CORTX deeply understands 300, that's acceptable if CORTX can tell an agent: *"This service accepted 0.01 USDC yesterday but failed delivery; Cori reproduced it twice, settlement is visible here, the provider fixed it four hours later, and CORTX verified recovery."*

## 30. Cori's eventual identity

*The agent watching the agents' economy.* "Meet Cori — CORTX's autonomous reliability agent. Cori continuously watches machine services, investigates failures and builds independent evidence about what agents can trust before they spend." **Don't let branding outrun capability.**

## 31. NOT in Scout V0

Marketplace · bounty system · escrow · human hiring · agent hiring · automatic remediation · autonomous code changes · automatic provider accusations · routing · refunds · protection/insurance · universal reputation system · complex CORTX Score changes · LLM investigation · agent-controlled wallet · autonomous spending · new payment implementation · full MCP redesign · giant public leaderboard · token mechanics.

## 32. Process

Before writing production code: audit the repository and write the Scout V0 technical spec, based on what exists today. Return the spec for approval first; review it against the current architecture before implementation.

## Final principle

CORTX doesn't win because it has a clever checker. CORTX wins if Cori continuously accumulates independent evidence about machine commerce that agents, builders and infrastructure eventually depend on.

- Scout is how Cori begins **seeing**.
- Observer is how Cori begins **remembering**.
- Investigator is how Cori begins **understanding**.
- Preflight is how other agents begin **trusting** that intelligence.
- Resolution is how Cori may eventually help **close the loop**.

**For now: build the eyes first.**
