-- 022_repair_shifted_stage_names.sql
--
-- Repairs paid-check history written between Aug 15 and Sep 28, 2026.
--
-- The bug: the paid check runner stepped through 8 steps for 7 stage names
-- (parsing the price and comparing it each took a step), so from the price
-- step on, every stage was saved under the previous stage's name:
--
--   price compared  → saved as "payment"
--   payment signed  → saved as "delivery"
--   data delivered  → saved as "json_parse"
--   JSON parsed     → saved as "schema_validation"
--   schema checked  → saved with no name
--
-- That skewed the public metrics (paid delivery % counted "price OK + signed"
-- as delivered; schema validity measured JSON parsing), recorded the wrong
-- failure stage on checks and incidents, and hid wallet failures from the
-- migration 020 cleanup. This migration:
--
--   1. Rebuilds each affected check's stages with the correct names
--      (price parse + compare merged into one `price_check` stage)
--   2. Recomputes checks.failure_stage and the matching incidents.failure_stage
--   3. Re-runs the migration 020 cleanup (false wallet/budget failures)
--
-- Run AFTER merging the fix, so rows written by the old code in between are
-- repaired too. Safe to re-run: only rows with the broken shape are touched.
-- No temp tables or explicit transaction (Supabase SQL editor).
-- Requires migration 020 (is_cortx_side_payment_failure).

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


-- ═══ 1. Repair function ════════════════════════════════════════════════════

-- True when a stages array has the shifted shape: position 2 holds only the
-- parsed price and position 3 ("payment") holds the price comparison.
create or replace function public.stages_have_shifted_names(p_stages jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p_stages) = 'array'
    and jsonb_array_length(p_stages) >= 4
    and p_stages->2->>'stage' = 'price_check'
    and coalesce(p_stages->2->'evidence', '{}'::jsonb) ? 'parsed_price'
    and not (coalesce(p_stages->2->'evidence', '{}'::jsonb) ? 'result')
    and p_stages->3->>'stage' = 'payment'
    and p_stages->3->'passed' is not null
    and jsonb_typeof(p_stages->3->'passed') = 'boolean'
    and (
      coalesce(p_stages->3->'evidence', '{}'::jsonb) ? 'result'
      or p_stages->3->>'error' in ('PRICE_EXCEEDS_MAXIMUM', 'BETA_PRICE_CAP_EXCEEDED', 'PRICE_MISMATCH')
    );
$$;

-- Rebuilds a shifted stages array with the canonical 7 stage names.
create or replace function public.repair_shifted_stages(p_stages jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  canonical text[] := array['availability', 'payment_terms', 'price_check', 'payment', 'delivery', 'json_parse', 'schema_validation'];
  -- Names for the real (executed) steps after the merged price stage
  after_price text[] := array['payment', 'delivery', 'json_parse', 'schema_validation'];
  real_count int := 0;
  n int;
  i int;
  e2 jsonb;
  e3 jsonb;
  merged jsonb;
  result jsonb := '[]'::jsonb;
begin
  if not public.stages_have_shifted_names(p_stages) then
    return p_stages;
  end if;

  n := jsonb_array_length(p_stages);

  -- Real steps are the leading entries that ran (passed true/false);
  -- trailing "not reached" padding has passed = null and is rebuilt below.
  while real_count < n and jsonb_typeof(p_stages->real_count->'passed') = 'boolean' loop
    real_count := real_count + 1;
  end loop;

  -- availability, payment_terms
  result := result || jsonb_build_array(p_stages->0, p_stages->1);

  -- price parse (2) + price compare (3) → one price_check stage
  e2 := p_stages->2;
  e3 := p_stages->3;
  merged := jsonb_build_object(
    'stage', 'price_check',
    'passed', e3->'passed',
    'duration_ms', to_jsonb(coalesce((e2->>'duration_ms')::numeric, 0) + coalesce((e3->>'duration_ms')::numeric, 0)),
    'evidence', coalesce(e2->'evidence', '{}'::jsonb) || coalesce(e3->'evidence', '{}'::jsonb)
  );
  if e3 ? 'error' then
    merged := merged || jsonb_build_object('error', e3->'error');
  end if;
  result := result || jsonb_build_array(merged);

  -- Remaining real steps get the next canonical names
  for i in 4 .. real_count - 1 loop
    result := result || jsonb_build_array(
      jsonb_set(p_stages->i, '{stage}', to_jsonb(after_price[i - 3]), true)
    );
  end loop;

  -- Pad the stages that were never reached
  for i in jsonb_array_length(result) + 1 .. 7 loop
    result := result || jsonb_build_array(jsonb_build_object(
      'stage', canonical[i], 'passed', null, 'duration_ms', null, 'evidence', null
    ));
  end loop;

  return result;
end;
$$;

-- ═══ 2. Incidents first (needs the old failure_stage to find its check) ═════

update public.incidents i
set failure_stage = (
      select s->>'stage'
      from jsonb_array_elements(public.repair_shifted_stages(c.stages)) s
      where s->>'passed' = 'false'
      limit 1
    )
from public.checks c
where c.id = i.triggering_check_id
  and c.check_type in ('full', 'canary')
  and public.stages_have_shifted_names(c.stages);

-- ═══ 3. Checks: rebuild stages + failure_stage ══════════════════════════════

update public.checks c
set stages = public.repair_shifted_stages(c.stages),
    failure_stage = (
      select s->>'stage'
      from jsonb_array_elements(public.repair_shifted_stages(c.stages)) s
      where s->>'passed' = 'false'
      limit 1
    )
where c.check_type in ('full', 'canary')
  and public.stages_have_shifted_names(c.stages);

-- ═══ 4. Re-run the migration 020 cleanup on the repaired data ════════════════
-- Wallet/budget failures are now under the "payment" name where
-- is_cortx_side_payment_failure() looks for them.

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
    and c.check_type in ('full', 'canary')
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

update public.checks c
set status = 'error',
    error_message = coalesce(c.error_message,
      'Reclassified by migration 022: CORTX verification wallet/budget failure, not a service failure')
where c.status = 'failed'
  and public.is_cortx_side_payment_failure(c.stages);
