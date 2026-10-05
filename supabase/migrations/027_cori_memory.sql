-- 027: Cori memory — Scout V0 spec v2, Phase B2 (docs/CORI_SCOUT_V0_SPEC.md)
--
-- G1  discovery_observations: one row per free probe, failures included.
--     Append-only for Cori (insert, never update or delete).
-- G2  discovery_listings: one row per distinct listing version per source
--     (content-addressed by listing hash), so we know what changed, not just
--     that something changed.
-- G3  Cori's history no longer cascades: deleting a discovered service is
--     refused while it has events, listings or observations (DATA COMPOUNDS).
-- G4  discovered_services.route_template / resource_url (Bazaar dynamic
--     routes), class 'unsupported_method'.
-- G8  discovered_services.disappeared_at (cache; the history is the
--     'disappeared' / 'reappeared' events).
-- G9  cori_runs.cori_version (which Cori code produced a run).
-- Decision 2 (Oct 5): discovered_services.pay_to — the raw recipient address,
--     public in every 402 response; needed later to trace settlement.
--
-- Additive only: no existing row is changed. Safe to re-run.
-- No temp tables or explicit transaction (Supabase SQL editor).


-- ═══ 1. New columns ═════════════════════════════════════════════════════════
alter table public.discovered_services
  add column if not exists route_template      text,
  add column if not exists resource_url        text,
  add column if not exists pay_to              text,
  add column if not exists source_last_updated timestamptz,
  add column if not exists disappeared_at      timestamptz;

alter table public.cori_runs add column if not exists cori_version text;

-- Classes: add 'unsupported_method' (HEAD/DELETE/PUT/PATCH are never probed)
alter table public.discovered_services drop constraint if exists discovered_services_classification_check;
alter table public.discovered_services add constraint discovered_services_classification_check
  check (classification in ('pending','blocked','already_monitored','already_listed','already_submitted',
    'unreachable','not_x402','invalid_terms','unsupported_network','unsupported_asset',
    'unsupported_scheme','unsupported_method','too_expensive','needs_input','eligible','gone'));


-- ═══ 2. Listing versions (G2) ═══════════════════════════════════════════════
create table if not exists public.discovery_listings (
  id                    bigserial   primary key,
  discovered_service_id uuid        not null references public.discovered_services(id) on delete restrict,
  source                text        not null,
  listing_hash          text        not null,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  source_last_updated   timestamptz,          -- the source's own lastUpdated
  resource              text        not null, -- the URL exactly as listed
  x402_version          smallint,
  accepts               jsonb,                -- payment options as listed (null if > 16 KB)
  resource_meta         jsonb,                -- serviceName / description / tags / mimeType (capped)
  extensions            jsonb,                -- e.g. bazaar input/output info (null if > 16 KB)
  item_bytes            integer,              -- size of the raw item, so a dropped field is visible
  unique (discovered_service_id, source, listing_hash)
);

create index if not exists discovery_listings_service_idx
  on public.discovery_listings (discovered_service_id, first_seen_at desc);


-- ═══ 3. Observations (G1) ═══════════════════════════════════════════════════
create table if not exists public.discovery_observations (
  id                    bigserial   primary key,
  discovered_service_id uuid        not null references public.discovered_services(id) on delete restrict,
  at                    timestamptz not null default now(),
  probe_url             text        not null,
  method                text,
  outcome               text        not null,
  error_code            text,
  http_status           integer,
  latency_ms            integer,
  terms_source          text,                 -- where the 402 terms were found (body / header)
  x402_version          smallint,
  network               text,
  asset                 text,
  scheme                text,
  transfer_method       text,
  price_atomic          numeric,
  price_usdc            numeric,
  pay_to                text,
  facilitator_published boolean,
  cori_version          text
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'discovery_observations_outcome_check') then
    alter table public.discovery_observations add constraint discovery_observations_outcome_check
      check (outcome in ('ok','unreachable','not_x402','invalid_terms','blocked'));
  end if;
end $$;

create index if not exists discovery_observations_service_at_idx
  on public.discovery_observations (discovered_service_id, at desc);


-- ═══ 4. No cascades into Cori's history (G3) ════════════════════════════════
alter table public.discovery_events drop constraint if exists discovery_events_discovered_service_id_fkey;
alter table public.discovery_events add constraint discovery_events_discovered_service_id_fkey
  foreign key (discovered_service_id) references public.discovered_services(id) on delete restrict;

alter table public.discovery_sources_seen drop constraint if exists discovery_sources_seen_discovered_service_id_fkey;
alter table public.discovery_sources_seen add constraint discovery_sources_seen_discovered_service_id_fkey
  foreign key (discovered_service_id) references public.discovered_services(id) on delete restrict;


-- ═══ 5. Permissions ═════════════════════════════════════════════════════════
alter table public.discovery_listings     enable row level security;
alter table public.discovery_observations enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'cori_agent') then
    -- History is append-only for Cori: no update on events or observations
    revoke update on public.discovery_events from cori_agent;
    grant select, insert on public.discovery_observations to cori_agent;
    grant select, insert on public.discovery_listings to cori_agent;
    grant update (last_seen_at) on public.discovery_listings to cori_agent;
    grant usage, select on sequence public.discovery_observations_id_seq, public.discovery_listings_id_seq to cori_agent;

    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discovery_listings' and policyname = 'cori_agent_all') then
      create policy cori_agent_all on public.discovery_listings for all to cori_agent using (true) with check (true);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'discovery_observations' and policyname = 'cori_agent_all') then
      create policy cori_agent_all on public.discovery_observations for all to cori_agent using (true) with check (true);
    end if;
  end if;
end $$;


-- ═══ Check (read-only) ══════════════════════════════════════════════════════
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('discovery_listings', 'discovery_observations');
--   select conrelid::regclass, pg_get_constraintdef(oid) from pg_constraint
--   where conname in ('discovery_events_discovered_service_id_fkey', 'discovery_sources_seen_discovered_service_id_fkey');
