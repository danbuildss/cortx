# CORTX — YC & Unicorn Analysis
> Research dump. Internal reference only. Last updated: Aug 2026.

---

## Product Ideas Parking Lot

Ideas spotted while building — not for now, but worth keeping.

### Provider Grouping (Registry / V3)
Companies have multiple x402 endpoints at different prices for different services (e.g., Arkham: `/intelligence`, `/addresses`, `/transactions`). Right now they appear as separate unrelated rows in the registry.

**The idea:** A `provider` entity groups multiple endpoints under one company. Registry shows "Arkham — 3 endpoints, all healthy." Provider health page shows aggregate metrics across all their endpoints.

**Why it matters for V3:** When agents are selecting between data providers, they want "is this company's whole suite reliable?" — not just one endpoint in isolation.

**Build when:** V3 (Select). Not needed for V1 launch. Current flat list works fine for 30 endpoints. Gets visually broken when providers with 3–5 endpoints each start appearing regularly.

---

## What We've Built (V1 Complete)

CORTX is the reliability layer for the x402 protocol. It runs a 7-stage synthetic payment pipeline on Base mainnet with real USDC to catch every failure mode in a live x402 endpoint.

**The 7 stages:**
1. Availability — is the server responding?
2. Payment terms — is the 402 response valid, and is the X-Payment-Required header parseable?
3. Price check — is the price within expected/max bounds?
4. Payment — sign EIP-3009 via x402/client, build X-Payment header
5. Delivery — resend with payment, expect 200
6. JSON parse — is the response body parseable?
7. Schema validation — does the response match the expected JSON Schema?

Standard monitoring (Uptime Robot, Better Uptime, Pingdom) catches failure at stage 1. That's it. The other six are invisible to them — and six is where real payment failures live.

**What's shipped (60+ PRs merged):**
- Full synthetic payment pipeline (all 7 stages, evidence at each)
- Incident system (2 consecutive failures to open, timeline, ACK, resolve)
- Telegram alerts (open / escalate / resolve)
- Public status pages (`/status/[userId]`, `/status/service/[serviceId]`)
- CORTX Monitored badge (SVG, embeddable, 5-min cache)
- Public reliability API (`GET /api/v1/reliability/[serviceId]`)
- 3-step onboarding wizard (detect → configure → run first check in <2 min)
- $CORTX token tiers (gated features, not paywalled core monitoring)
- Public registry (admin-seeded + builder endpoints, with verification tiers)
- Layered verification model (lightweight pings + paid full checks on separate schedules)
- BankrBot integration (CORTX as a Bankr skill — PR #642 open)
- Blog, docs, methodology page, cost guide, about page
- Admin platform stats (24h/7d/30d/90d/1y/all windows)

**Live at:** usecortx.dev  
**Active blog post:** "x402 has 7 failure modes. Standard monitoring catches one."

---

## The YC Six Forcing Questions

Applied to CORTX as of Aug 2026.

---

### Q1: Demand Reality — Is the pain real and is CORTX the live proof?

**What we have:**
- BankrBot/skills PR #642 open — a real AI agent platform is integrating CORTX as a Bankr skill. This is a real external team wanting CORTX in their product.
- Builders using CORTX on Base mainnet with real USDC — not testnet, not simulated. Real money flows.
- The blog post frames the problem in terms any x402 builder feels: "you have no idea if your endpoint is actually delivering after payment."

**What's missing:**
- A specific incident story. "CORTX caught a payment failure on [endpoint] before [n] users were affected." This is the YC killer anecdote.
- 10 builders actively using CORTX (Phase 1 target).

**Assessment:** Demand is directional. Not yet proven at scale. The BankrBot integration is the strongest signal — an external team chose to integrate, not just register.

**Pre-YC action:** Collect one real incident story from the first 10 builders. One is enough.

---

### Q2: Status Quo — What do people do today without CORTX?

**The honest answer: nothing.**

There is no existing x402 monitoring product. The status quo is:
- Builders deploy an x402 endpoint.
- They have no idea if it's working end-to-end.
- They find out when a user complains, a log spikes, or USDC stops arriving.
- Standard monitoring tools (Uptime Robot, Pingdom) only test availability — they never send a payment, so they can't tell you if stage 4 (payment signing), stage 5 (delivery), or stage 7 (schema validation) is broken.

**The risk:** If the status quo is "nothing," it could mean the pain isn't real yet. Early protocol, early adopters. The market might not exist at meaningful scale.

**The bet:** CORTX is infrastructure-before-demand. You build the reliability layer before the protocol is saturated, so when 10,000 x402 endpoints exist, CORTX is already the default. This is the Stripe model — Stripe shipped payment infrastructure before most people thought payment infrastructure needed to be a product.

**Assessment:** CORTX's strongest competitive card. No competitor. First mover in a category it's defining.

---

### Q3: Desperate Specificity — Who has this problem so badly they'll use a half-built product?

**The ICP:**
- x402 API developer on Base
- Charging USDC per call (not subscriptions, not free tier)
- Has gone to production — real traffic, real money
- Blind to silent payment failures (stage 4–7)
- Losing USDC when payments fail and delivery doesn't happen

**Why desperate:**
- Every payment failure is a direct revenue loss. Not a bug report, not a support ticket. Gone USDC.
- There is no alternative monitoring tool. The choice is CORTX or nothing.
- AI agents can't complain. If an agent's payment pipeline breaks, the agent silently fails — no angry user email, no visible churn signal. The builder finds out weeks later when the revenue line drops.

**The desperation multiplier:** AI agents as buyers. Human users complain. AI agents just fail silently. This makes silent payment failures catastrophically worse in an agentic world.

**Assessment:** ICP is narrow and real. The "AI agents can't complain" insight is the most important framing for x402 reliability. Lead with this.

---

### Q4: Narrowest Wedge — What's the smallest foothold to start?

**Already built.** The wedge is: monitor one x402 endpoint.

The onboarding wizard gets a builder from signup to first running check in under 2 minutes. That is the wedge. One endpoint. First check running.

**Open question: pricing.**

Phase 1 goal: 10 paying builders.

**Suggested model (not yet decided):**
- Free tier: 1 endpoint, lightweight pings only, 5-min interval
- Paid tier: unlimited endpoints, paid full checks (real USDC), incidents, alerts, badge
- Launch offer: give the first 10 builders full paid tier free for 60 days in exchange for a testimonial and permission to name them as a reference.

This is not discounting. It's buying the evidence YC and future customers need.

**Assessment:** Wedge is well-defined. Pricing model needs to be locked before public launch.

---

### Q5: Observation & Surprise — What did you see that others missed?

**The key observation:**

Standard monitoring tools test "is the server alive?" x402 endpoints need a different question: "did someone actually pay and get what they paid for?"

This observation came from building the 7-stage pipeline and realizing that stages 2–7 are completely invisible to existing tools. Not somewhat covered. Completely invisible.

**The surprise:**

Payment failures at stage 5 (delivery) and stage 7 (schema) are the most dangerous — not because they're common, but because they're silent. The payment went through. The USDC left the wallet. The endpoint returned 200. But the response body is malformed JSON or doesn't match the expected schema. The builder collects USDC for a delivery that was garbage.

This is the category-defining insight: CORTX is not uptime monitoring. It's payment integrity monitoring.

**What to watch next:**
- Watch 3 builders add their first endpoint without help. Every confusion point = conversion blocker.
- Track what questions come in before first check runs. That's the product's biggest gap.

**Assignment before launch:**
- Observe 3 unguided onboardings (DM builders, watch them add endpoint live on call or async via Loom).

---

### Q6: Future-Fit — Is this a feature or a company?

**The V1→V4 roadmap:**

```
V1 — Monitor    ✅  You are here.
V2 — Verify         Ownership verification, trust labels, delivery reputation
V3 — Select         Agents/platforms compare providers by health, latency, price, delivery %
V4 — Route          CORTX automatically chooses and fails over between providers
```

**The unicorn thesis:**

V4 is where CORTX becomes a company worth $1B+.

In V4, CORTX doesn't just tell you which x402 endpoints are reliable — it routes payments to the best available provider and takes a basis-point cut on every routed payment.

If agent-to-agent payments become the dominant commerce layer (which the x402 protocol exists to enable), CORTX is the routing and reliability layer for that economy. Not Datadog (observability tool, SaaS subscription). Stripe (payment infrastructure, basis points on every transaction).

**The math:**
- x402 endpoints are priced per-call in USDC. Typical: $0.001–$0.10 per call.
- If CORTX routes 1M calls/day at average $0.01/call: $10,000/day gross flow.
- At 1 basis point (0.01%): $1/day. Not interesting.
- At 50 bps (0.5%): $50/day, $18,250/year from 1M calls.
- At 100M calls/day (agent economy at scale): $50,000/day, $18M/year from routing alone.
- This is not unrealistic if AI agents make 100M x402 payments/day by 2027–2028.

**The alternative frame:** DNS for payment-capable APIs.

When you type a URL, DNS resolves it to the fastest/available server. When an agent wants to buy weather data, CORTX resolves it to the most reliable/cheapest x402 provider that currently has working payment infrastructure. CORTX is the DNS + CDN layer for x402.

**Assessment:** This is a company, not a feature. The wedge (monitoring) is defensible. The destination (routing) is transformative. The protocol-first bet (x402 as the agentic payment standard) needs to pay off, but Coinbase and the Base ecosystem are accelerating this, not slowing it.

---

## YC Verdict (Aug 2026)

**Backable? Yes, but not yet.**

What YC needs to see:
1. 10 paying builders (Phase 1 target)
2. One real incident story ("CORTX caught X before users were affected")
3. Defined paid tier with at least 3 paying customers
4. A clear argument for x402 market size (see X article below)

**Timeline:** 6 weeks from public launch to YC-ready evidence.

**Application window to target:** YC Winter 2027 (apply Oct 2026).

**Strongest cards:**
- No competitor (first mover)
- Real mainnet integration (not testnet theater)
- External team integrating (BankrBot PR #642)
- V4 routing thesis = Stripe model, not Datadog model

**Weakest cards:**
- No paying builders yet (launch week)
- No incident story yet
- x402 market size is a bet, not a fact (early protocol)
- Solo founder (founder risk for some YC partners)

---

## Pre-YC Actions (Priority Order)

1. **Ship Monday thread** → open signups → get 10 builders using CORTX
2. **One free "founding builder" offer** → 60-day full paid tier free for first 10 in exchange for testimonial + permission to reference them
3. **Wait for first real incident** → when it happens, document it immediately: what failed, what stage, how long, what CORTX caught, what the builder said
4. **Lock the paid tier pricing** → simple: free (1 endpoint, pings) / paid ($X/month, full pipeline, incidents, alerts)
5. **Apply for Base ecosystem grant** → the base team has grants for infrastructure builders; CORTX is infrastructure

---

## The One-Liner for YC

> "x402 has 7 payment failure modes. Standard monitoring catches one. CORTX catches all seven — on Base mainnet, with real USDC, before your users notice."

---

## The One-Liner for V4 Unicorn Path

> "When AI agents route their payments through CORTX, we take a basis-point cut. We're not building Datadog for x402. We're building Stripe."

---

*This document is internal research. Do not share externally.*
