-- 023_cori_scout.sql
--
-- Cori Scout v0 (docs/CORI_SCOUT_V0_SPEC.md §4): discovery tables, the link
-- into the existing admin review queue, and a least-privilege database role
-- for the Cori VPS. No payments, no public changes.
--
-- Safe to re-run. No temp tables or explicit transaction (Supabase SQL editor).
-- The role is created WITHOUT a password — set one separately:
--   alter role cori_agent with login password '<strong password>';

-- ═══ 1. Discovery tables ════════════════════════════════════════════════════

create table if not exists public.discovered_services (
  id                     uuid primary key default gen_random_uuid(),
  canonical_url          text not null unique,
  host                   text not null,
  first_seen_at          timestamptz not null default now(),
  first_source           text not null,
  last_seen_at           timestamptz not null default now(),
  service_name           text,
  description            text,
  tags                   text[] not null default '{}',
  bazaar_metadata        jsonb,
  http_method            text not null default 'GET',
  input_example          jsonb,
  x402_version           smallint,
  network                text,
  asset                  text,
  scheme                 text,
  transfer_method        text,
  price_atomic           numeric,
  price_usdc             numeric,
  pay_to_fingerprint     text,
  facilitator_url        text,
  listing_hash           text,
  last_probe_at          timestamptz,
  next_probe_at          timestamptz,
  probe_failures         integer not null default 0,
  last_probe             jsonb,
  classification         text not null default 'pending',
  classification_reasons text[] not null default '{}',
  evidence_state         text not null default 'observed',
  linked_service_id      uuid references public.services(id) on delete set null,
  linked_seed_id         uuid references public.registry_seeds(id) on delete set null,
  linked_submission_id   uuid references public.endpoint_submissions(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'discovered_services_classification_check') then
    alter table public.discovered_services add constraint discovered_services_classification_check
      check (classification in ('pending','blocked','already_monitored','already_listed','already_submitted',
        'unreachable','not_x402','invalid_terms','unsupported_network','unsupported_asset',
        'unsupported_scheme','too_expensive','needs_input','eligible','gone'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'discovered_services_evidence_state_check') then
    alter table public.discovered_services add constraint discovered_services_evidence_state_check
      check (evidence_state in ('observed','reproduced','confirmed','resolved'));
  end if;
end $$;

create index if not exists discovered_services_next_probe_idx
  on public.discovered_services (next_probe_at) where next_probe_at is not null;
create index if not exists discovered_services_classification_idx
  on public.discovered_services (classification);
create index if not exists discovered_services_pay_to_idx
  on public.discovered_services (pay_to_fingerprint);
create index if not exists discovered_services_host_idx
  on public.discovered_services (host);

create table if not exists public.discovery_sources_seen (
  discovered_service_id uuid not null references public.discovered_services(id) on delete cascade,
  source                text not null,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  last_listing_hash     text,
  primary key (discovered_service_id, source)
);

create table if not exists public.discovery_events (
  id                    bigserial primary key,
  discovered_service_id uuid not null references public.discovered_services(id) on delete cascade,
  at                    timestamptz not null default now(),
  event                 text not null,
  details               jsonb
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'discovery_events_event_check') then
    alter table public.discovery_events add constraint discovery_events_event_check
      check (event in ('first_seen','listing_changed','reappeared','disappeared','terms_changed',
        'price_changed','probe_status_changed','classification_changed','queued','approved','rejected'));
  end if;
end $$;

create index if not exists discovery_events_service_at_idx
  on public.discovery_events (discovered_service_id, at desc);

create table if not exists public.cori_runs (
  id          bigserial primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  kind        text not null,
  ok          boolean,
  stats       jsonb,
  error       text
);

create index if not exists cori_runs_started_at_idx on public.cori_runs (started_at desc);

create table if not exists public.cori_sources (
  id               text primary key,
  url              text not null,
  enabled          boolean not null default true,
  interval_minutes integer not null default 360,
  last_run_at      timestamptz
);

insert into public.cori_sources (id, url, enabled, interval_minutes)
values ('cdp_bazaar', 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources', true, 360)
on conflict (id) do nothing;

create table if not exists public.cori_denylist (
  host     text primary key,
  reason   text,
  added_at timestamptz not null default now()
);

-- ═══ 2. Link into the existing admin review queue ══════════════════════════

alter table public.endpoint_submissions
  add column if not exists source text not null default 'public',
  add column if not exists discovered_service_id uuid references public.discovered_services(id) on delete set null,
  add column if not exists candidate_metadata jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'endpoint_submissions_source_check') then
    alter table public.endpoint_submissions add constraint endpoint_submissions_source_check
      check (source in ('public', 'cori_scout'));
  end if;
end $$;

-- Never two pending submissions for the same discovered service
create unique index if not exists endpoint_submissions_one_pending_per_discovery
  on public.endpoint_submissions (discovered_service_id)
  where status = 'pending' and discovered_service_id is not null;

-- ═══ 3. Row-level security (server-side only; cori_agent via policies) ═════

alter table public.discovered_services     enable row level security;
alter table public.discovery_sources_seen  enable row level security;
alter table public.discovery_events        enable row level security;
alter table public.cori_runs               enable row level security;
alter table public.cori_sources            enable row level security;
alter table public.cori_denylist           enable row level security;

-- ═══ 4. Least-privilege role for the Cori VPS ══════════════════════════════
-- Can: manage its own discovery tables, read what it needs to deduplicate,
-- insert candidates into the review queue. Cannot: read checks, incidents,
-- users, spend or settings; approve anything; change the registry.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'cori_agent') then
    create role cori_agent nologin;
  end if;
end $$;

grant usage on schema public to cori_agent;

grant select, insert, update on public.discovered_services, public.discovery_sources_seen,
  public.discovery_events, public.cori_runs to cori_agent;
grant select, update (last_run_at) on public.cori_sources to cori_agent;
grant select on public.cori_denylist to cori_agent;
grant usage, select on sequence public.discovery_events_id_seq, public.cori_runs_id_seq to cori_agent;

grant select (id, endpoint_url, deleted_at) on public.services to cori_agent;
grant select (id, endpoint_url) on public.registry_seeds to cori_agent;
grant select (id, endpoint_url, status, source, discovered_service_id) on public.endpoint_submissions to cori_agent;
grant insert (endpoint_url, name, description, website_url, category, source, discovered_service_id, candidate_metadata)
  on public.endpoint_submissions to cori_agent;

-- Single-instance lock (pg_try_advisory_lock) needs no extra grant.

do $$
declare
  t text;
begin
  foreach t in array array['discovered_services', 'discovery_sources_seen', 'discovery_events', 'cori_runs', 'cori_sources', 'cori_denylist'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'cori_agent_all') then
      execute format('create policy cori_agent_all on public.%I for all to cori_agent using (true) with check (true)', t);
    end if;
  end loop;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'services' and policyname = 'cori_agent_read') then
    create policy cori_agent_read on public.services for select to cori_agent using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'registry_seeds' and policyname = 'cori_agent_read') then
    create policy cori_agent_read on public.registry_seeds for select to cori_agent using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'endpoint_submissions' and policyname = 'cori_agent_read') then
    create policy cori_agent_read on public.endpoint_submissions for select to cori_agent using (true);
  end if;
  -- Cori may only add its own candidates, only as pending
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'endpoint_submissions' and policyname = 'cori_agent_queue') then
    create policy cori_agent_queue on public.endpoint_submissions for insert to cori_agent
      with check (source = 'cori_scout' and status = 'pending' and discovered_service_id is not null);
  end if;
end $$;
