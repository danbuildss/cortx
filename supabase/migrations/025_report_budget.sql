-- 025: a separate, small budget for the free /report — and report spend counts
-- toward the platform caps.
--
-- Before: /report paid up to $0.10 to any URL. Its spend reservation used the
-- report's id as a service id, so either the reservation failed (the paid part
-- never ran) or, without that foreign key, the spend never counted toward the
-- daily/monthly caps. Only per-email/per-IP limits stood between a stranger and
-- the wallet.
--
-- After:
--   • reliability_report_requests.paid_usdc records what each report paid
--   • reserve_report_spend() reserves under the same lock as monitoring checks,
--     against the report's own daily budget AND the platform caps
--   • get_spend_totals() includes report spend, so reserve_spend() (monitoring),
--     the cron's pause/unpause and the admin spend cards all count it
--
-- Safe to re-run. Preview first (read-only):
--   select count(*) as reports from public.reliability_report_requests;
--   select * from public.get_spend_totals();


-- ═══ 1. Record what each report paid ════════════════════════════════════════
alter table public.reliability_report_requests
  add column if not exists paid_usdc numeric(18,8);

create index if not exists reliability_report_requests_requested_at_idx
  on public.reliability_report_requests(requested_at);


-- ═══ 2. Platform totals include report spend ════════════════════════════════
create or replace function public.get_spend_totals()
returns table (daily_spent numeric, monthly_spent numeric)
language plpgsql
security definer
as $$
declare
  v_today_start timestamptz := date_trunc('day',   now() at time zone 'utc') at time zone 'utc';
  v_month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
begin
  delete from public.spend_reservations where expires_at < now();

  return query
  select
    coalesce((select sum(c.observed_price) from public.checks c
              where c.started_at >= v_today_start
                and c.observed_price is not null
                and public.check_payment_passed(c.stages)), 0)
    + coalesce((select sum(r.amount_usdc) from public.spend_reservations r
                where r.reserved_at >= v_today_start), 0)
    + coalesce((select sum(q.paid_usdc) from public.reliability_report_requests q
                where q.requested_at >= v_today_start and q.paid_usdc is not null), 0),
    coalesce((select sum(c.observed_price) from public.checks c
              where c.started_at >= v_month_start
                and c.observed_price is not null
                and public.check_payment_passed(c.stages)), 0)
    + coalesce((select sum(r.amount_usdc) from public.spend_reservations r
                where r.reserved_at >= v_month_start), 0)
    + coalesce((select sum(q.paid_usdc) from public.reliability_report_requests q
                where q.requested_at >= v_month_start and q.paid_usdc is not null), 0);
end;
$$;


-- ═══ 3. Reserve a report payment ════════════════════════════════════════════
-- Returns 'ok', 'REPORT_BUDGET_EXHAUSTED', 'DAILY_SPEND_CAP_EXCEEDED',
-- 'MONTHLY_SPEND_CAP_EXCEEDED' or 'REPORT_NOT_FOUND'. Same advisory lock as
-- reserve_spend(), so reports and monitoring checks can't overspend together.
-- The caller clears paid_usdc again if the payment was never sent.
create or replace function public.reserve_report_spend(
  p_report_id        uuid,
  p_amount           numeric,
  p_report_daily_cap numeric,
  p_daily_cap        numeric,
  p_monthly_cap      numeric
) returns text
language plpgsql
security definer
as $$
declare
  v_today_start   timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_report_spent  numeric;
  v_daily_spent   numeric;
  v_monthly_spent numeric;
begin
  perform pg_advisory_xact_lock(1234567890);

  select coalesce(sum(paid_usdc), 0) into v_report_spent
  from public.reliability_report_requests
  where requested_at >= v_today_start and paid_usdc is not null;

  if v_report_spent + p_amount > p_report_daily_cap then
    return 'REPORT_BUDGET_EXHAUSTED';
  end if;

  select t.daily_spent, t.monthly_spent
    into v_daily_spent, v_monthly_spent
    from public.get_spend_totals() t;

  if v_daily_spent + p_amount > p_daily_cap then
    return 'DAILY_SPEND_CAP_EXCEEDED';
  end if;

  if v_monthly_spent + p_amount > p_monthly_cap then
    return 'MONTHLY_SPEND_CAP_EXCEEDED';
  end if;

  update public.reliability_report_requests
     set paid_usdc = p_amount
   where id = p_report_id and paid_usdc is null;

  if not found then
    return 'REPORT_NOT_FOUND';
  end if;

  return 'ok';
end;
$$;


-- ═══ 4. Server-only, like the other budget functions (see 020) ══════════════
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.get_spend_totals()',
    'public.reserve_report_spend(uuid, numeric, numeric, numeric, numeric)'
  ] loop
    continue when to_regprocedure(fn) is null;
    execute format('revoke execute on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke execute on function %s from authenticated', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;


-- ═══ Check (read-only) ══════════════════════════════════════════════════════
--   select * from public.get_spend_totals();
--   select column_name from information_schema.columns
--   where table_name = 'reliability_report_requests' and column_name = 'paid_usdc';
