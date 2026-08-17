# CORTX — Ideas & Partnership Dump

> Raw ideas, partnership notes, and strategic thinking. Not a backlog — a holding pen.
> Anything that survives more than a week here should move to NOTES.md or a spec.

---

## BlockRun Partnership (August 2026)

**Source:** Research session Aug 17, 2026  
**Contact in progress:** Dev advocate (name TBD) — said will relay to team. Vicky Fu (CEO) DMs closed.

### Who they are

BlockRun (blockrun.ai / @BlockRunAI) — the leading x402 payment infrastructure company by volume. 1M+ x402 tx/day on Base as of Aug 2026. Stack: ClawRouter (smart LLM router, 6.6k GitHub stars), Franklin Agent (autonomous USDC-spending agent), BlockRun Gateway (50-70+ models + 183 APIs behind x402), BlockRun MCP (for Claude Code, Cursor, Codex). Backed by Base Ecosystem Fund (Coinbase Ventures), CoinFund, Liberty City Ventures. Founded Jan 2026, Delaware C-Corp, CEO Vicky Fu (ex-Circle Head of Data Science, ex-Capital One Director Data Science / fraud & anomaly detection, ex-Microsoft Azure ML).

### Why they matter to CORTX

- **They ARE the market.** BlockRun's gateway endpoints are exactly what CORTX monitors. At 1M tx/day, a schema regression or payment routing failure is agent money lost — not a bug report.
- **Vicky understands monitoring natively.** She built metering for USDC flows at Circle and anomaly detection at Capital One. This is not a cold pitch to someone who doesn't get it.
- **Three-tier opportunity:**
  1. **Customer** — monitor their gateway endpoints (50-70+ model providers behind x402)
  2. **Integration** — CORTX status as a signal inside ClawRouter before routing; Franklin checks CORTX before spending
  3. **Distribution** — 39 open-source repos, active dev community, every BlockRun developer is a CORTX ICP account

### Outreach sequence (staged, not sent)

Dev advocate path bypassed — Rami (Head of Product & Growth at BlockRun) messaged first on X. Replied, booked a 30-min call via cal.com. Call pending.

### Strategic notes

- Close them as customer first. Proof of value on one endpoint → take result to Vicky → then integration conversation.
- "CORTX-verified" badge on their service registry = distribution flywheel.
- Their listed risk: "dependency on partner service uptime" — CORTX is the fix.
- Speed matters: Vicky has the background to build internal monitoring herself if we're too slow.

---

## Ecosystem Map — Grok Research (August 2026)

**Source:** Grok external research on CORTX market position

### Potential customers (prioritized)

| Tier | Who | Why |
|---|---|---|
| 1 | x402 service providers | Need badges + delivery proof as trust signals; failed schema destroys agent revenue |
| 1 | BlockRun, Bankr, Exa, Surf, Predexon, Covalent/GoldRush, Neynar, 0x, RPC providers, media gen | High-volume, already running x402 in production |
| 2 | Agent platform operators (OpenClaw, Franklin, Claude Code integrators, Coinbase AgentKit) | Need reliable endpoint scoring before routing/spending |
| 3 | Directories & marketplaces (Agentic.market, x402-list, x402scan, x402dash, Signal402) | Want quality signals beyond self-reported uptime |
| 4 | Enterprise agent fleets with compliance/SLA needs | Spend caps + evidence trails |

### Adjacent tools (compete or partner)

- **Analytix402** — revenue + security monitoring for x402. Complement (they don't do real paid checks).
- **x402dash** — reliability scoring. Complement or acquisition target.
- **Signal402, PivotX402** — adjacent. Differentiate on real USDC verification vs simulated.

### Partner targets (by priority)

1. Coinbase/Base/x402 Foundation — ecosystem grants, acceleration (BlockRun path)
2. Circle — USDC; CORTX validates settlement, natural alignment
3. BlockRun — routing + monitoring bundle; Rami call in progress
4. Agentic.market — native CORTX badge integration as quality signal
5. OpenClaw / MCP ecosystem — embed CORTX checks into agent runtimes
6. Bankr — already in beta, expand relationship

### What Grok got right

- 7-stage real paid verification is the moat (not simulated 402s, not pings)
- Timing is right: x402 growing fast, quality is fragmented, honeypots/bad endpoints already reported
- Badge + status page as low-friction adoption path is correct
- Token → endpoint slots creates customer→holder loop

### What to act on from this

- Exa, Surf, Covalent, Neynar, Predexon are named and reachable — should be in the pipeline after BlockRun
- Agentic.market integration (CORTX badge as quality filter) is a distribution play worth pursuing
- Base Ecosystem Fund grant — BlockRun got it, CORTX should apply

---

## Future Ideas (unvalidated)

- **On-demand check API** — needed for Bankr skill v2 (currently requires known serviceId)
- **Email alerts** alongside Telegram
- **Custom domains** for status pages
- **Bulk endpoint import** — CSV or API for onboarding many services at once
- **Per-account wallet config** — let users bring their own test wallet key instead of shared CORTX wallet
- **Team/multi-user access** — multiple people on one account (needed for any company-sized customer)
