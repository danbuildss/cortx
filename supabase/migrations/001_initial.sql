-- ─────────────────────────────────────────────────────────────────────────────
-- CORTX — schema patch  (safe to run against existing tables)
-- Run this in Supabase → SQL editor
-- ─────────────────────────────────────────────────────────────────────────────

-- updated_at trigger function (shared)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── profiles — add missing columns ──────────────────────────────────────────

alter table public.profiles enable row level security;

do $$ begin
  create policy "Users can view own profile"   on public.profiles for select using (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
exception when duplicate_object then null; end $$;

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── services — add missing columns ──────────────────────────────────────────

alter table public.services add column if not exists environment            text          not null default 'mainnet';
alter table public.services add column if not exists test_input             jsonb         not null default '{}';
alter table public.services add column if not exists expected_schema        jsonb         not null default '{"type":"object"}';
alter table public.services add column if not exists expected_price         numeric(18,8);
alter table public.services add column if not exists max_price              numeric(18,8);
alter table public.services add column if not exists latency_threshold_ms   integer       not null default 5000;
alter table public.services add column if not exists check_interval_minutes integer       not null default 5;
alter table public.services add column if not exists status                 text          not null default 'unknown';
alter table public.services add column if not exists consecutive_failures   integer       not null default 0;
alter table public.services add column if not exists last_checked_at        timestamptz;
alter table public.services add column if not exists next_check_at          timestamptz   not null default now();
alter table public.services add column if not exists deleted_at             timestamptz;
alter table public.services add column if not exists updated_at             timestamptz   not null default now();

create index if not exists services_next_check_at_idx on public.services (next_check_at) where deleted_at is null;

alter table public.services enable row level security;

do $$ begin
  create policy "Users manage own services"
    on public.services for all
    using  (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- ─── checks — add missing columns ────────────────────────────────────────────

alter table public.checks add column if not exists started_at     timestamptz;
alter table public.checks add column if not exists completed_at   timestamptz;
alter table public.checks add column if not exists latency_ms     integer;
alter table public.checks add column if not exists status         text;
alter table public.checks add column if not exists failure_stage  text;
alter table public.checks add column if not exists stages         jsonb not null default '[]';
alter table public.checks add column if not exists observed_price numeric(18,8);
alter table public.checks add column if not exists error_message  text;
alter table public.checks add column if not exists user_id        uuid references public.profiles(id) on delete cascade;

create index if not exists checks_service_id_started_at_idx on public.checks (service_id, started_at desc);

alter table public.checks enable row level security;

do $$ begin
  create policy "Users view own checks"
    on public.checks for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Service role inserts checks"
    on public.checks for insert
    with check (true);
exception when duplicate_object then null; end $$;

-- ─── incidents — add missing columns ─────────────────────────────────────────

alter table public.incidents add column if not exists severity             text;
alter table public.incidents add column if not exists status               text not null default 'open';
alter table public.incidents add column if not exists failure_stage        text;
alter table public.incidents add column if not exists triggering_check_id  uuid references public.checks(id);
alter table public.incidents add column if not exists opened_at            timestamptz not null default now();
alter table public.incidents add column if not exists acknowledged_at      timestamptz;
alter table public.incidents add column if not exists resolved_at          timestamptz;
alter table public.incidents add column if not exists resolution_type      text;
alter table public.incidents add column if not exists timeline             jsonb not null default '[]';
alter table public.incidents add column if not exists updated_at           timestamptz not null default now();
alter table public.incidents add column if not exists user_id              uuid references public.profiles(id) on delete cascade;

create index if not exists incidents_service_id_status_idx on public.incidents (service_id, status);

alter table public.incidents enable row level security;

do $$ begin
  create policy "Users manage own incidents"
    on public.incidents for all
    using  (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

drop trigger if exists trg_incidents_updated_at on public.incidents;
create trigger trg_incidents_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

-- ─── alert_configs — create fresh (replaces alert_destinations) ──────────────

create table if not exists public.alert_configs (
  id                    uuid        primary key default gen_random_uuid(),
  service_id            uuid        not null references public.services(id) on delete cascade,
  user_id               uuid        not null references public.profiles(id) on delete cascade,
  channel               text        not null default 'telegram' check (channel in ('telegram')),
  destination           text        not null,
  enabled               boolean     not null default true,
  on_open               boolean     not null default true,
  on_severity_increase  boolean     not null default true,
  on_resolve            boolean     not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists alert_configs_service_id_idx on public.alert_configs (service_id);
create index if not exists alert_configs_user_id_idx    on public.alert_configs (user_id);

alter table public.alert_configs enable row level security;

do $$ begin
  create policy "Users manage own alert configs"
    on public.alert_configs for all
    using  (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

drop trigger if exists trg_alert_configs_updated_at on public.alert_configs;
create trigger trg_alert_configs_updated_at
  before update on public.alert_configs
  for each row execute function public.set_updated_at();
