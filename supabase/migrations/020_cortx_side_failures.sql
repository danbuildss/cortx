-- 020_cortx_side_failures.sql
--
-- Day 1 fix: stop blaming builders for CORTX's own wallet/budget problems.
--
-- When the CORTX verification wallet was empty (or the platform spend cap was
-- hit), paid checks were recorded as `failed` at the payment stage. That marked
-- builders' services critical, opened incidents, sent them alerts, and turned
-- their public status pages and badges red. The code now records these as
-- `error` (infrastructure). This migration:
--
--   Part 1. Adds get_spend_totals() and fixes spend accounting in reserve_spend()
--   Part 3. Closes the incidents those false failures opened
--   Part 4. Recomputes status for the affected services
--   Part 2. Reclassifies past CORTX-side payment failures as `error` (runs last)
--
-- ─── PREVIEW FIRST ─────────────────────────────────────────────────────────
-- Before running this file, paste the three SELECTs below into the Supabase
-- SQL editor on their own to see what will change. Nothing is modified by them.
--
--   -- 1) Checks that will be reclassified to `error`, per service
--   select s.name, count(*) as false_failures, min(c.started_at) as first_seen, max(c.started_at) as last_seen
--   from public.checks c join public.services s on s.id = c.service_id
--   where public.is_cortx_side_payment_failure(c.stages) and c.status = 'failed'
--   group by s.name order by false_failures desc;
--
--   -- 2) Incidents that will be closed as false positives
--   select i.id, s.name, i.status, i.severity, i.opened_at
--   from public.incidents i
--   join public.checks c on c.id = i.triggering_check_id
--   join public.services s on s.id = i.service_id
--   where public.is_cortx_side_payment_failure(c.stages) and c.status = 'failed';
--
--   -- 3) Current platform spend vs caps
--   select * from public.get_spend_totals();
--
-- (The helper functions used above are created in Part 1 — run Part 1 alone
--  first if you want to preview before changing any data.)
-- ────────────────────────────────────────────────────────────────────────────


-- ═══ Part 1: helpers + spend accounting ═════════════════════════════════════

-- True when a check's payment stage failed for a CORTX-side reason.
-- Matches the new explicit codes, plus the legacy WALLET_ERROR messages written
-- before this fix (empty wallet, missing key, spend reservation failure).
create or replace function public.is_cortx_side_payment_failure(p_stages jsonb)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_stages, '[]'::jsonb)) s
    where s->>'stage' = 'payment'
      and (s->>'passed')::boolean is false
      and (
        s->>'error' in (
          'WALLET_NOT_CONFIGURED',
          'INSUFFICIENT_BALANCE',
          'BALANCE_READ_FAILED',
          'SPEND_RESERVATION_FAILED',
          'DAILY_SPEND_CAP_EXCEEDED',
          'MONTHLY_SPEND_CAP_EXCEEDED',
          'PAYMENT_TIMEOUT'
        )
        or (
          s->>'error' = 'WALLET_ERROR'
          and (
            s->'evidence'->>'error' ilike '%INSUFFICIENT_BALANCE%'
            or s->'evidence'->>'error' ilike '%CORTX_TEST_WALLET_KEY%'
            or s->'evidence'->>'error' ilike 'Spend reservation failed%'
          )
        )
      )
  );
$$;

-- True when a check got past the payment stage (money was committed to the
-- service). Spend accounting counts these, whether or not delivery succeeded.
create or replace function public.check_payment_passed(p_stages jsonb)
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_stages, '[]'::jsonb)) s
    where s->>'stage' = 'payment'
      and (s->>'passed')::boolean is true
  );
$$;

-- Platform-wide verification spend so far today and this month (UTC),
-- including in-flight reservations. Used by the cron to decide when a
-- spend-cap pause can be lifted.
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
                where r.reserved_at >= v_today_start), 0),
    coalesce((select sum(c.observed_price) from public.checks c
              where c.started_at >= v_month_start
                and c.observed_price is not null
                and public.check_payment_passed(c.stages)), 0)
    + coalesce((select sum(r.amount_usdc) from public.spend_reservations r
                where r.reserved_at >= v_month_start), 0);
end;
$$;

-- reserve_spend: same contract as migration 014, but committed spend now counts
-- every check whose payment went through — previously only fully `passed`
-- checks were counted, so payments that failed at delivery were missed and the
-- caps under-counted real spend.
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
  v_daily_spent   numeric;
  v_monthly_spent numeric;
begin
  perform pg_advisory_xact_lock(1234567890);

  select t.daily_spent, t.monthly_spent
    into v_daily_spent, v_monthly_spent
    from public.get_spend_totals() t;

  if v_daily_spent + p_amount > p_daily_cap then
    return 'DAILY_SPEND_CAP_EXCEEDED';
  end if;

  if v_monthly_spent + p_amount > p_monthly_cap then
    return 'MONTHLY_SPEND_CAP_EXCEEDED';
  end if;

  insert into public.spend_reservations(service_id, amount_usdc)
  values (p_service_id, p_amount);

  return 'ok';
end;
$$;


-- Lock server-only functions to the service role. Supabase grants EXECUTE on
-- public functions to anon/authenticated by default, which let anyone call
-- reserve_spend through the REST API and burn the platform budget (or fill
-- other users' rate-limit windows). All callers use the service role key.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.reserve_spend(uuid, numeric, numeric, numeric)',
    'public.get_spend_totals()',
    'public.check_and_record_rate_limit(text, int, int)'
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


-- ═══ 0. Allow resolution_type = 'false_positive' ═════════════════════════════
-- Allow resolution_type = 'false_positive', keeping every value the existing
-- production constraint already allows (it isn't defined in a migration).
do $$
declare
  def text;
  vals text[];
begin
  select pg_get_constraintdef(oid) into def
  from pg_constraint
  where conrelid = 'public.incidents'::regclass
    and conname = 'incidents_resolution_type_check';

  if def is not null and def not like '%false_positive%' then
    select array_agg(distinct m[1]) into vals
    from regexp_matches(def, '''([^'']+)''', 'g') as m;
    vals := array_append(coalesce(vals, '{}'), 'false_positive');

    alter table public.incidents drop constraint incidents_resolution_type_check;
    execute format(
      'alter table public.incidents add constraint incidents_resolution_type_check check (resolution_type is null or resolution_type = any (%L::text[]))',
      vals
    );
  end if;
end $$;


-- ═══ Parts 2–4: data cleanup ══════════════════════════════════════════════════
-- No temp tables or explicit transaction: the Supabase SQL editor may run each
-- statement on its own. Order matters instead — incidents and service status
-- are fixed first (while the false failures are still `failed`), and the
-- checks themselves are reclassified last. Every step is safe to re-run.

-- Part 3a: close open incidents that were opened by a false failure.
update public.incidents i
set status = 'resolved',
    resolved_at = now(),
    resolution_type = 'false_positive',
    timeline = coalesce(i.timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'event', 'resolved',
      'at', now(),
      'actor', 'system',
      'note', 'False positive: caused by the CORTX verification wallet/budget, not by this service'
    ))
from public.checks c
where c.id = i.triggering_check_id
  and c.status = 'failed'
  and public.is_cortx_side_payment_failure(c.stages)
  and i.status in ('open', 'acknowledged');

-- Part 3b: past (already resolved) incidents opened by a false failure —
-- relabel so they no longer read as real outages in the incident history.
update public.incidents i
set resolution_type = 'false_positive',
    timeline = coalesce(i.timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'event', 'note',
      'at', now(),
      'actor', 'system',
      'note', 'Marked false positive: caused by the CORTX verification wallet/budget, not by this service'
    ))
from public.checks c
where c.id = i.triggering_check_id
  and c.status = 'failed'
  and public.is_cortx_side_payment_failure(c.stages)
  and i.status = 'resolved'
  and coalesce(i.resolution_type, '') <> 'false_positive';

-- Part 4: recompute status + consecutive failures for affected services from
-- their real paid checks (ignoring infrastructure errors and false failures).
with affected as (
  select distinct c.service_id
  from public.checks c
  where c.status = 'failed'
    and public.is_cortx_side_payment_failure(c.stages)
),
paid as (
  select c.service_id, c.status, c.failure_stage, c.started_at
  from public.checks c
  join affected a on a.service_id = c.service_id
  where c.status in ('passed', 'failed')
    and coalesce(c.check_type, 'full') <> 'lightweight'
    and not (c.status = 'failed' and public.is_cortx_side_payment_failure(c.stages))
),
last_pass as (
  select service_id, max(started_at) as at
  from paid where status = 'passed'
  group by service_id
),
latest as (
  select distinct on (service_id) service_id, status, failure_stage
  from paid
  order by service_id, started_at desc
),
streak as (
  select p.service_id, count(*) as fails
  from paid p
  left join last_pass lp on lp.service_id = p.service_id
  where p.status = 'failed'
    and (lp.at is null or p.started_at > lp.at)
  group by p.service_id
)
update public.services s
set status = case
      when l.status is null then 'unknown'
      when l.status = 'passed' then 'operational'
      when l.failure_stage in ('payment', 'delivery', 'json_parse', 'schema_validation') then 'critical'
      else 'degraded'
    end,
    consecutive_failures = coalesce(st.fails, 0)
from affected a
left join latest l on l.service_id = a.service_id
left join streak st on st.service_id = a.service_id
where s.id = a.service_id;

-- Part 2 (last): reclassify the false failures themselves as infrastructure errors.
update public.checks c
set status = 'error',
    error_message = coalesce(c.error_message,
      'Reclassified by migration 020: CORTX verification wallet/budget failure, not a service failure')
where c.status = 'failed'
  and public.is_cortx_side_payment_failure(c.stages);
