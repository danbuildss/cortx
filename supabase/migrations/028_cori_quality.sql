-- 028: Cori quality gate (Q1, approved Oct 8) — quality over noise
--
-- Cori still reads the whole Coinbase Bazaar, but only keeps, checks and
-- shows real products from real companies. Review moves from endpoints to
-- companies.
--   discovered_companies    one row per company (registrable domain)
--   discovery_site_checks   append-only: "does the company's website answer?"
--   cori_watchlist          companies the founder always wants watched
--   discovered_services     + company_domain, + class 'low_quality'
-- One-time correction: the 75 endpoint-level Cori cards waiting for review
-- (Oct 6–8) are set aside as "superseded by company-level review". The rows
-- are kept (status + reason recorded, nothing deleted); Cori re-proposes
-- the companies that pass the gate, one card each.
--
-- Safe to re-run. Run it as numbered blocks if the editor complains.


-- ═══ Block 1: companies, website checks, watch list ════════════════════════
create table if not exists public.discovered_companies (
  domain               text        primary key,
  name                 text,
  first_seen_at        timestamptz not null default now(),
  last_seen_at         timestamptz not null default now(),
  site_checked_at      timestamptz,
  site_ok              boolean,
  site_status          integer,
  site_failures        integer     not null default 0,
  linked_submission_id uuid        references public.endpoint_submissions(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.discovery_site_checks (
  id           bigserial   primary key,
  domain       text        not null references public.discovered_companies(domain) on delete restrict,
  at           timestamptz not null default now(),
  url          text        not null,
  http_status  integer,
  latency_ms   integer,
  error_code   text,
  ok           boolean     not null,
  cori_version text
);
create index if not exists discovery_site_checks_domain_idx on public.discovery_site_checks (domain, at desc);

create table if not exists public.cori_watchlist (
  domain   text        primary key,
  note     text,
  added_at timestamptz not null default now()
);


-- ═══ Block 2: services belong to a company; new class 'low_quality' ═══════
alter table public.discovered_services add column if not exists company_domain text;
create index if not exists discovered_services_company_idx on public.discovered_services (company_domain);

alter table public.discovered_services drop constraint if exists discovered_services_classification_check;
alter table public.discovered_services add constraint discovered_services_classification_check
  check (classification in ('pending','blocked','already_monitored','already_listed','already_submitted',
    'unreachable','not_x402','invalid_terms','unsupported_network','unsupported_asset',
    'unsupported_scheme','unsupported_method','too_expensive','needs_input','eligible','gone','low_quality'));


-- ═══ Block 3: permissions ═════════════════════════════════════════════════
alter table public.discovered_companies  enable row level security;
alter table public.discovery_site_checks enable row level security;
alter table public.cori_watchlist        enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'cori_agent') then
    grant select, insert, update on public.discovered_companies to cori_agent;
    grant select, insert on public.discovery_site_checks to cori_agent;   -- append-only
    grant select on public.cori_watchlist to cori_agent;                  -- only the founder edits it
    grant usage, select on sequence public.discovery_site_checks_id_seq to cori_agent;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discovered_companies' and policyname = 'cori_agent_all') then
      create policy cori_agent_all on public.discovered_companies for all to cori_agent using (true) with check (true);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discovery_site_checks' and policyname = 'cori_agent_all') then
      create policy cori_agent_all on public.discovery_site_checks for all to cori_agent using (true) with check (true);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cori_watchlist' and policyname = 'cori_agent_read') then
      create policy cori_agent_read on public.cori_watchlist for select to cori_agent using (true);
    end if;
  end if;
end $$;


-- ═══ Block 4: set aside the endpoint-level cards (one-time correction) ════
-- Kept, not deleted: status + reason say why. Their services are freed so
-- Cori can propose the company (once) under the new rules.
update public.discovered_services s
   set linked_submission_id = null
  from public.endpoint_submissions e
 where e.id = s.linked_submission_id
   and e.source = 'cori_scout' and e.status = 'pending';

update public.endpoint_submissions
   set status = 'rejected',
       reviewed_at = now(),
       rejection_reason = 'Superseded by company-level review (Cori quality gate, Oct 8)'
 where source = 'cori_scout' and status = 'pending';


-- ═══ Check (read-only) ═════════════════════════════════════════════════════
--   select
--     (select count(*) from information_schema.tables where table_schema = 'public'
--        and table_name in ('discovered_companies','discovery_site_checks','cori_watchlist')) as new_tables,
--     (select count(*) from information_schema.columns where table_schema = 'public'
--        and table_name = 'discovered_services' and column_name = 'company_domain') as company_column,
--     (select count(*) from public.endpoint_submissions where source = 'cori_scout' and status = 'pending') as cori_pending;
--   → 3 | 1 | 0
