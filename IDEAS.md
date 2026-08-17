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

See conversation history for full draft. Dev advocate path is in progress.

### Strategic notes

- Close them as customer first. Proof of value on one endpoint → take result to Vicky → then integration conversation.
- "CORTX-verified" badge on their service registry = distribution flywheel.
- Their listed risk: "dependency on partner service uptime" — CORTX is the fix.
- Speed matters: Vicky has the background to build internal monitoring herself if we're too slow.

---

## Future Ideas (unvalidated)

- **On-demand check API** — needed for Bankr skill v2 (currently requires known serviceId)
- **Email alerts** alongside Telegram
- **Custom domains** for status pages
- **Bulk endpoint import** — CSV or API for onboarding many services at once
- **Per-account wallet config** — let users bring their own test wallet key instead of shared CORTX wallet
- **Team/multi-user access** — multiple people on one account (needed for any company-sized customer)
