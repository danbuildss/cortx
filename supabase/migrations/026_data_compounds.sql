-- 026: DATA COMPOUNDS, first batch (S1, S3, S4) — see docs/DATA_COMPOUNDS.md
--
-- S1  Deleting an account no longer deletes evidence. Production cascades
--     profiles → services → checks / incidents (checked Oct 5). Now:
--       • checks / incidents / services keep their rows; user_id becomes null
--       • services can't be hard-deleted while evidence exists (restrict)
--       • on account deletion the account's services stop being monitored
--         (soft-deleted) and what the user typed as test input is removed
-- S3  service_config_history: every change to what a service is checked with
--     (URL, test input, schema, price limits, intervals, deletion) is kept as a
--     new version, written by a trigger — no app change needed.
-- S4  checks.config_version (filled by a trigger), checks.context,
--     checks.runner_version, checks.spec_version — every new check records
--     what it ran against and which code judged it.
--
-- Additive only: no existing check, incident or service row is changed, except
-- the one-time baseline rows written to service_config_history.
-- Safe to re-run. Preview first (read-only):
--   select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint
--   where contype = 'f' and conrelid in ('public.checks'::regclass,'public.incidents'::regclass,'public.services'::regclass);


-- ═══ S1. Foreign keys: detach, never cascade into evidence ══════════════════
alter table public.services  alter column user_id drop not null;
alter table public.checks    alter column user_id drop not null;
alter table public.incidents alter column user_id drop not null;

alter table public.services  drop constraint if exists services_user_id_fkey;
alter table public.services  add  constraint services_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.checks    drop constraint if exists checks_user_id_fkey;
alter table public.checks    add  constraint checks_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.incidents drop constraint if exists incidents_user_id_fkey;
alter table public.incidents add  constraint incidents_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- Services are soft-deleted in the app; a hard delete must not take evidence with it
alter table public.checks    drop constraint if exists checks_service_id_fkey;
alter table public.checks    add  constraint checks_service_id_fkey
  foreign key (service_id) references public.services(id) on delete restrict;

alter table public.incidents drop constraint if exists incidents_service_id_fkey;
alter table public.incidents add  constraint incidents_service_id_fkey
  foreign key (service_id) references public.services(id) on delete restrict;


-- ═══ S3. Service configuration history ══════════════════════════════════════
create table if not exists public.service_config_history (
  id           bigserial   primary key,
  service_id   uuid        not null references public.services(id) on delete restrict,
  version      integer     not null,
  change_kind  text        not null,
  changed_at   timestamptz not null default now(),
  changed_by   uuid,                      -- the signed-in user who made the change, if any
  config       jsonb       not null,
  config_hash  text        not null,
  unique (service_id, version)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_config_history_kind_check') then
    alter table public.service_config_history add constraint service_config_history_kind_check
      check (change_kind in ('baseline', 'created', 'updated', 'deleted', 'restored', 'account_deleted'));
  end if;
end $$;

create index if not exists service_config_history_service_idx
  on public.service_config_history (service_id, version desc);

-- Server-side only for now (no policies = no access for anon/authenticated)
alter table public.service_config_history enable row level security;

-- The settings that decide what a check does. Built from to_jsonb(row) so a
-- column that doesn't exist in this database is simply absent.
create or replace function public.service_check_config(s jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'name',                               s->'name',
    'endpoint_url',                       s->'endpoint_url',
    'environment',                        s->'environment',
    'test_input',                         s->'test_input',
    'expected_schema',                    s->'expected_schema',
    'expected_price',                     s->'expected_price',
    'max_price',                          s->'max_price',
    'latency_threshold_ms',               s->'latency_threshold_ms',
    'check_interval_minutes',             s->'check_interval_minutes',
    'lightweight_check_interval_minutes', s->'lightweight_check_interval_minutes',
    'paid_verification_mode',             s->'paid_verification_mode',
    'paid_verification_interval_minutes', s->'paid_verification_interval_minutes',
    'readiness_check_interval_minutes',   s->'readiness_check_interval_minutes',
    'canary_payload',                     s->'canary_payload',
    'canary_expected_schema',             s->'canary_expected_schema',
    'canary_max_price_usdc',              s->'canary_max_price_usdc',
    'deleted_at',                         s->'deleted_at'
  ));
$$;

create or replace function public.record_service_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new     jsonb := public.service_check_config(to_jsonb(new));
  v_kind    text;
  v_version integer;
  v_user    uuid;
begin
  if tg_op = 'UPDATE' then
    if v_new = public.service_check_config(to_jsonb(old)) then
      return new;  -- status/timestamp updates from checks are not config changes
    end if;
    v_kind := case
      when old.deleted_at is null and new.deleted_at is not null then 'deleted'
      when old.deleted_at is not null and new.deleted_at is null then 'restored'
      else 'updated'
    end;
  else
    v_kind := 'created';
  end if;

  -- Set by detach_account_evidence() so these versions say why they happened
  if coalesce(current_setting('cortx.change_reason', true), '') = 'account_deleted' then
    v_kind := 'account_deleted';
  end if;

  begin
    v_user := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
  exception when others then
    v_user := null;
  end;

  select coalesce(max(version), 0) + 1 into v_version
  from public.service_config_history where service_id = new.id;

  insert into public.service_config_history (service_id, version, change_kind, changed_by, config, config_hash)
  values (new.id, v_version, v_kind, v_user, v_new, md5(v_new::text));

  return new;
end;
$$;

drop trigger if exists trg_services_config_history on public.services;
create trigger trg_services_config_history
  after insert or update on public.services
  for each row execute function public.record_service_config();

-- Baseline: today's config of every existing service becomes version 1
insert into public.service_config_history (service_id, version, change_kind, config, config_hash)
select s.id, 1, 'baseline', c.cfg, md5(c.cfg::text)
from public.services s
cross join lateral (select public.service_check_config(to_jsonb(s)) as cfg) c
where not exists (select 1 from public.service_config_history h where h.service_id = s.id);


-- ═══ S1 (cont.). Account deletion: stop monitoring, remove typed input ══════
-- Runs before the foreign keys null out user_id. Endpoint evidence (checks,
-- incidents, config history) stays, detached from the person. Test input and
-- canary payload are what the user typed, so they are removed everywhere —
-- the one documented exception to append-only (privacy).
create or replace function public.detach_account_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('cortx.change_reason', 'account_deleted', true);

  -- One update, so the account deletion is one config version
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'services' and column_name = 'canary_payload') then
    begin
      execute 'update public.services set deleted_at = coalesce(deleted_at, now()), test_input = ''{}''::jsonb,
               canary_payload = null where user_id = $1' using old.id;
    exception when not_null_violation then
      execute 'update public.services set deleted_at = coalesce(deleted_at, now()), test_input = ''{}''::jsonb,
               canary_payload = ''{}''::jsonb where user_id = $1' using old.id;
    end;
  else
    update public.services
       set deleted_at = coalesce(deleted_at, now()),
           test_input = '{}'::jsonb
     where user_id = old.id;
  end if;

  update public.service_config_history h
     set config = h.config - 'test_input' - 'canary_payload'
   where h.service_id in (select id from public.services where user_id = old.id);

  perform set_config('cortx.change_reason', '', true);
  return old;
end;
$$;

drop trigger if exists trg_profiles_detach_evidence on public.profiles;
create trigger trg_profiles_detach_evidence
  before delete on public.profiles
  for each row execute function public.detach_account_evidence();


-- ═══ S4. Every check records what it ran against and which code judged it ═══
alter table public.checks add column if not exists config_version integer;
alter table public.checks add column if not exists context        jsonb;
alter table public.checks add column if not exists runner_version text;
alter table public.checks add column if not exists spec_version   text;

create or replace function public.stamp_check_config_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.config_version is null then
    select max(version) into new.config_version
    from public.service_config_history where service_id = new.service_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_checks_config_version on public.checks;
create trigger trg_checks_config_version
  before insert on public.checks
  for each row execute function public.stamp_check_config_version();


-- ═══ Functions are server-side only (as in 020/025) ═════════════════════════
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.record_service_config()',
    'public.detach_account_evidence()',
    'public.stamp_check_config_version()'
  ] loop
    continue when to_regprocedure(fn) is null;
    execute format('revoke execute on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke execute on function %s from authenticated', fn);
    end if;
  end loop;
end $$;


-- ═══ Check (read-only) ══════════════════════════════════════════════════════
--   select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint
--   where contype = 'f' and conrelid in ('public.checks'::regclass,'public.incidents'::regclass,'public.services'::regclass);
--   select change_kind, count(*) from public.service_config_history group by 1;
