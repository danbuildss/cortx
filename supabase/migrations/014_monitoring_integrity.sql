-- 014_monitoring_integrity.sql
-- V1.1 P0: atomic spend reservation, monitoring paused state

-- Add monitoring_paused_reason to services
alter table public.services
  add column if not exists monitoring_paused_reason text
    check (monitoring_paused_reason in ('SPEND_CAP_DAILY', 'SPEND_CAP_MONTHLY', 'LOW_BALANCE', 'STALE'));

-- Spend reservations table — holds in-flight payment locks
create table if not exists public.spend_reservations (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.services(id) on delete cascade,
  amount_usdc numeric(18,8) not null,
  reserved_at timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '3 minutes')
);

create index if not exists spend_reservations_service_id_idx on public.spend_reservations(service_id);
create index if not exists spend_reservations_reserved_at_idx on public.spend_reservations(reserved_at);

-- Service role only — check runner uses service role key
alter table public.spend_reservations enable row level security;
create policy "Service role only" on public.spend_reservations
  using (false);

-- reserve_spend: atomically check and reserve spend budget
-- Returns:
--   'ok'                    — reservation created, proceed with payment
--   'DAILY_SPEND_CAP_EXCEEDED'
--   'MONTHLY_SPEND_CAP_EXCEEDED'
-- Acquires a transaction-level advisory lock (key 1234567890) so that only
-- one caller at a time reads + writes the cumulative spend totals.
create or replace function public.reserve_spend(
  p_service_id  uuid,
  p_amount      numeric,
  p_daily_cap   numeric,
  p_monthly_cap numeric
) returns text
language plpgsql
security definer
as $$
declare
  v_today_start  timestamptz;
  v_month_start  timestamptz;
  v_daily_spent  numeric;
  v_monthly_spent numeric;
begin
  -- Serialise all concurrent callers on this single advisory lock.
  perform pg_advisory_xact_lock(1234567890);

  -- Expire stale reservations before reading totals
  delete from public.spend_reservations where expires_at < now();

  v_today_start  := date_trunc('day',   now() at time zone 'utc') at time zone 'utc';
  v_month_start  := date_trunc('month', now() at time zone 'utc') at time zone 'utc';

  -- Sum committed spend (passed checks) + live reservations for today
  select coalesce(
    (select sum(observed_price)
     from public.checks
     where started_at >= v_today_start
       and status = 'passed'
       and observed_price is not null), 0)
  + coalesce(
    (select sum(amount_usdc)
     from public.spend_reservations
     where reserved_at >= v_today_start), 0)
  into v_daily_spent;

  if v_daily_spent + p_amount > p_daily_cap then
    return 'DAILY_SPEND_CAP_EXCEEDED';
  end if;

  -- Sum committed spend + live reservations for this month
  select coalesce(
    (select sum(observed_price)
     from public.checks
     where started_at >= v_month_start
       and status = 'passed'
       and observed_price is not null), 0)
  + coalesce(
    (select sum(amount_usdc)
     from public.spend_reservations
     where reserved_at >= v_month_start), 0)
  into v_monthly_spent;

  if v_monthly_spent + p_amount > p_monthly_cap then
    return 'MONTHLY_SPEND_CAP_EXCEEDED';
  end if;

  insert into public.spend_reservations(service_id, amount_usdc)
  values (p_service_id, p_amount);

  return 'ok';
end;
$$;
