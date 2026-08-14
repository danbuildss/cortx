-- ─────────────────────────────────────────────────────────────────────────────
-- CORTX — Layered Verification Sprint (safe to run against existing tables)
-- Three-tier monitoring: lightweight (free, frequent) + canary + full (paid)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── services — layered check columns ────────────────────────────────────────

-- Lightweight ping interval (replaces check_interval_minutes for free checks)
alter table public.services
  add column if not exists lightweight_check_interval_minutes integer not null default 5;

-- Paid verification mode: 'full' | 'canary' | 'disabled'
alter table public.services
  add column if not exists paid_verification_mode text not null default 'full'
  check (paid_verification_mode in ('full', 'canary', 'disabled'));

-- How often to run a paid verification (minutes)
alter table public.services
  add column if not exists paid_verification_interval_minutes integer not null default 60;

-- Canary check config (used when paid_verification_mode = 'canary')
alter table public.services
  add column if not exists canary_payload jsonb;

alter table public.services
  add column if not exists canary_expected_schema jsonb;

alter table public.services
  add column if not exists canary_max_price_usdc numeric(18,8);

-- Freshness tracking per tier
alter table public.services
  add column if not exists last_lightweight_check_at timestamptz;

alter table public.services
  add column if not exists last_paid_verification_at timestamptz;

alter table public.services
  add column if not exists last_full_verification_at timestamptz;

-- Scheduler: next paid verification time (analogous to next_check_at for lightweight)
alter table public.services
  add column if not exists next_paid_verification_at timestamptz not null default now();

-- Index for paid verification scheduler
create index if not exists services_next_paid_verification_at_idx
  on public.services (next_paid_verification_at)
  where deleted_at is null and paid_verification_mode != 'disabled';

-- ─── Backward compatibility: migrate existing services ───────────────────────
-- Existing rows: treat current check_interval_minutes as paid interval,
-- lightweight defaults to 5 min, mode stays 'full', next paid = now().
-- next_check_at continues to drive lightweight scheduling unchanged.

update public.services
  set paid_verification_interval_minutes = check_interval_minutes
  where paid_verification_interval_minutes = 60
    and check_interval_minutes != 60;

-- ─── checks — check type column ───────────────────────────────────────────────

alter table public.checks
  add column if not exists check_type text not null default 'full'
  check (check_type in ('lightweight', 'canary', 'full'));

-- Index to filter by type efficiently
create index if not exists checks_service_id_check_type_idx
  on public.checks (service_id, check_type, started_at desc);

-- ─── incidents — trigger check type column ────────────────────────────────────

alter table public.incidents
  add column if not exists trigger_check_type text not null default 'full'
  check (trigger_check_type in ('lightweight', 'canary', 'full'));
