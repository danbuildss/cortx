-- 030: Cori Problem Finder, step 1 (approved Oct 17): demand
--
-- CDP's Bazaar publishes, per listing, 30-day usage: distinct paying wallets,
-- paid calls and the last paid call. Real buyers are the best free signal that
-- a service matters, so Cori keeps that history and ranks companies by it.
--
--   discovery_demand      append-only history: at most one row per service per
--                         UTC day, and only when the numbers changed. Only for
--                         services that passed the quality gate (junk isn't kept).
--   discovered_services   + demand_* : the latest numbers (a cache)
--   discovered_companies  + demand_* : the company's numbers (a cache; payers =
--                         the busiest service, calls = all services together)
--
-- Nothing is updated or deleted. Safe to re-run. Run it as numbered blocks,
-- BEFORE deploying the matching Cori version.


-- ═══ Block 1: demand history (append-only) ═════════════════════════════════
create table if not exists public.discovery_demand (
  id                    bigserial   primary key,
  discovered_service_id uuid        not null references public.discovered_services(id) on delete restrict,
  source                text        not null,
  observed_on           date        not null,          -- UTC day
  at                    timestamptz not null default now(),
  unique_payers         integer     not null check (unique_payers >= 0),
  total_calls           integer     not null check (total_calls >= 0),
  last_called_at        timestamptz,
  cori_version          text,
  unique (discovered_service_id, source, observed_on)
);

create index if not exists discovery_demand_service_idx
  on public.discovery_demand (discovered_service_id, observed_on desc);


-- ═══ Block 2: latest numbers (caches) ══════════════════════════════════════
alter table public.discovered_services
  add column if not exists demand_payers         integer,
  add column if not exists demand_calls          integer,
  add column if not exists demand_last_called_at timestamptz,
  add column if not exists demand_at             timestamptz;

alter table public.discovered_companies
  add column if not exists demand_payers         integer,
  add column if not exists demand_calls          integer,
  add column if not exists demand_last_called_at timestamptz;

create index if not exists discovered_companies_demand_idx
  on public.discovered_companies (demand_payers desc nulls last);


-- ═══ Block 3: permissions (Cori may add history, never change it) ═════════
alter table public.discovery_demand enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'cori_agent') then
    grant select, insert on public.discovery_demand to cori_agent;
    grant usage, select on sequence public.discovery_demand_id_seq to cori_agent;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discovery_demand' and policyname = 'cori_agent_all') then
      create policy cori_agent_all on public.discovery_demand for all to cori_agent using (true) with check (true);
    end if;
  end if;
end $$;


-- ═══ Check (read-only) ═════════════════════════════════════════════════════
--   select
--     (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'discovery_demand') as demand_table,
--     (select count(*) from information_schema.columns where table_schema = 'public'
--        and table_name = 'discovered_services' and column_name like 'demand\_%') as service_columns,
--     (select count(*) from information_schema.columns where table_schema = 'public'
--        and table_name = 'discovered_companies' and column_name like 'demand\_%') as company_columns,
--     (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
--        where table_name = 'discovery_demand' and grantee = 'cori_agent') as cori_grants;
--   → 1 | 4 | 3 | INSERT,SELECT
