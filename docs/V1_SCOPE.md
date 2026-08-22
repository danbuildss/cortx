# CORTX V1 — Scope Definition

> **FROZEN — August 2026.** V1 is complete. This document is the historical scope record for V1.
> Do not add to it. For the active roadmap see `docs/PRODUCT_SPEC.md` (canonical roadmap section) and `NOTES.md`.
> V1.1 gaps and targets are documented in `docs/SECURITY.md` section 10.

This document is the binding scope reference for V1. If a feature is not listed under Must-Have, it does not exist in V1. When in doubt, cut.

---

## Exact V1 Boundaries

V1 is a single-user web application that:

- Accepts x402 endpoint registrations from authenticated builders
- Runs scheduled synthetic checks against those endpoints
- Records pass/fail evidence at every stage of the check pipeline
- Opens and resolves incidents based on deterministic rules
- Sends Telegram alerts on incident open and resolve
- Displays service status, check history, and incident history in a web UI

V1 is not:
- Multi-user
- Public-facing (no public status pages in V1)
- API-accessible (no public API)
- Connected to any marketplace
- Capable of monitoring non-x402 endpoints

---

## Must-Have Features

### Authentication
- [ ] Sign up with email + password via Supabase Auth
- [ ] Login / logout
- [ ] Session persistence
- [ ] Row-level security on all tables (user sees only their own data)

### Service management
- [ ] Add a service (all required fields; see DATA_MODEL.md)
- [ ] List all services on overview page
- [ ] View individual service detail
- [ ] Edit a service (update any field)
- [ ] Delete a service (soft delete; preserves check history)
- [ ] Service status derived from most recent check

### Check runner
- [ ] Full 6-stage pipeline (availability → payment terms → payment → delivery → JSON → schema)
- [ ] Evidence stored at every stage
- [ ] TypeScript result types for every stage
- [ ] Max-payment enforcement (hard ceiling, checked before payment)
- [ ] Latency measurement (wall clock, start to last byte)
- [ ] Failure stage classification (exact stage where the check failed)
- [ ] AJV schema validation against builder-supplied JSON Schema

### Scheduling
- [ ] Per-service check frequency (builder-configurable, minimum 5 minutes)
- [ ] Scheduled via Vercel Cron or equivalent
- [ ] Cron endpoint protected against unauthorized invocation

### Incidents
- [ ] Open incident on N consecutive failures (threshold: 2)
- [ ] Severity: Degraded (latency) or Critical (payment/delivery/schema)
- [ ] Deduplicate: one open incident per service at a time
- [ ] Auto-resolve when check passes after open incident
- [ ] Manual acknowledge and resolve
- [ ] Incident timeline (open → acknowledged → resolved)

### Alerts
- [ ] Telegram alert on incident open
- [ ] Telegram alert on incident resolve
- [ ] Alert destination configured per service

### UI screens
- [ ] Landing page
- [ ] Login / sign up
- [ ] Overview (service list with status badges)
- [ ] Add service form
- [ ] Service detail (status + check history + open incidents)
- [ ] Check detail (evidence per stage)
- [ ] Incidents list
- [ ] Alert settings

### Security
- [ ] Dedicated test wallet (separate from any production funds)
- [ ] Server-side wallet key storage (env var, never in DB)
- [ ] SSRF protection (URL validation + private-network blocklist)
- [ ] Max-payment enforcement before every payment
- [ ] Daily and monthly spend caps
- [ ] Secret redaction in stored evidence

---

## Nice-to-Have Features

These improve the product but are not required for V1 launch. Build only if must-haves are complete and time permits.

- [ ] Check frequency options as a dropdown (5m, 15m, 30m, 1h) rather than free-text
- [ ] Service pause / unpause (stop checks without deleting)
- [ ] Test a service manually (run one check on demand)
- [ ] Copy service endpoint URL to clipboard from detail page
- [ ] Relative timestamps ("3 minutes ago") with absolute on hover
- [ ] Filter incidents by status (open / resolved)
- [ ] Keyboard shortcuts for common actions

---

## Deferred Features

These have been explicitly deferred to post-V1. Do not begin implementation.

- Public status pages
- Multiple alert channels (email, Slack, webhooks)
- Teams / multi-user
- API access for builders
- Check history CSV export
- SLA tier enforcement
- Multiple check regions
- Notification escalation policies
- Scheduled maintenance windows

---

## Out-of-Scope Items

These are not being built at any point in the near term:

- MCP endpoint monitoring
- Automatic provider routing
- Marketplace or discovery features
- Agent reviews or reputation scores
- `$CRTX` token or any token functionality
- AI-generated reliability scores or confidence ratings
- Complex analytics dashboards
- Multiple payment networks (x402 only)
- Mobile applications

---

## Definition of Done

A V1 feature is done when:

1. It works end-to-end in a deployed Vercel preview environment
2. It is covered by at least one acceptance criterion from `ACCEPTANCE_CRITERIA.md`
3. The acceptance criterion passes
4. Row-level security is in place for any new database table
5. No new out-of-scope feature has been introduced as a side effect

---

## Stop Conditions

Stop and reassess if any of the following occur during V1 build:

1. A must-have feature requires a third-party integration not listed in the tech stack
2. The check runner requires >$1 in real payments per service per day at minimum frequency
3. The Supabase RLS model cannot isolate user data without application-level workarounds
4. The x402 protocol changes in a way that invalidates the check pipeline design
5. A must-have feature requires multi-user or team functionality to be meaningful

---

## Prioritized Implementation Order

### Phase 0 — Prove the core (no UI, no DB)
1. Controlled test x402 service (healthy + broken variants)
2. Check runner as a standalone TypeScript script
3. Console output of stage results
4. AJV schema validation

### Phase 1 — Make it real
5. Supabase schema + migrations
6. Supabase Auth (email/password)
7. Add service form + service storage
8. Manual check trigger (button in UI)
9. Service detail page with stage pipeline display
10. Check evidence storage
11. Incident creation logic

### Phase 1.5 — Make it automated
12. Vercel Cron scheduler
13. Telegram alert delivery
14. Check history view
15. Incident list + timeline

### Phase 2 — Open to real users
16. Landing page
17. Alert settings UI
18. Private beta with 5 real Bankr services
19. Feedback collection
