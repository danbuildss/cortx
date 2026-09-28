-- 021_payment_readiness.sql
--
-- Day 3: zero-cost payment readiness checks.
--
-- A readiness check asks the service's own facilitator to /verify a signed
-- payment without settling it (no USDC moves). Runs every 15 minutes for
-- services that publish their facilitator. Those services' paid checks move to
-- once a day after a passing paid check (handled in code, not here, because
-- we only learn which services support readiness after the first check).
--
-- Run this BEFORE merging the Day 3 PR — the new code reads these columns.
-- Safe to re-run. No explicit transaction or temp tables (Supabase SQL editor).

-- 1. Allow 'readiness' as a check type and as an incident trigger.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.checks'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%check_type%'
  loop
    execute format('alter table public.checks drop constraint %I', c.conname);
  end loop;

  for c in
    select conname from pg_constraint
    where conrelid = 'public.incidents'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%trigger_check_type%'
  loop
    execute format('alter table public.incidents drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.checks
  add constraint checks_check_type_check
  check (check_type in ('lightweight', 'readiness', 'canary', 'full'));

alter table public.incidents
  add constraint incidents_trigger_check_type_check
  check (trigger_check_type in ('lightweight', 'readiness', 'canary', 'full'));

-- 2. Readiness schedule + latest result on each service.
alter table public.services
  add column if not exists readiness_check_interval_minutes integer not null default 15,
  add column if not exists next_readiness_check_at timestamptz not null default now(),
  add column if not exists last_readiness_check_at timestamptz,
  add column if not exists readiness_status text not null default 'unknown',
  add column if not exists readiness_reason text,
  add column if not exists readiness_consecutive_failures integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.services'::regclass and conname = 'services_readiness_status_check'
  ) then
    alter table public.services
      add constraint services_readiness_status_check
      check (readiness_status in ('unknown', 'ready', 'not_ready', 'unavailable', 'error'));
  end if;
end $$;

create index if not exists services_next_readiness_check_at_idx
  on public.services (next_readiness_check_at)
  where deleted_at is null;
