-- 029: Cori Q2 (approved Oct 10) — known projects first, only live endpoints,
-- Approve means "Watching"
--
--   discovered_companies  + watching / approved_at / rejected_at (set by the
--                           admin review) and alive / last_alive_at /
--                           quiet_since (set by Cori's daily free checks)
--   registry_seeds        + hidden_at / hidden_reason: Cori finds stay off the
--                           public /registry until CORTX has evidence
-- One-time correction: companies already approved from Cori (and therefore
-- listed on /registry) become "Watching" and their /registry entries are
-- hidden, with a reason. Nothing is deleted.
--
-- Safe to re-run. Run it as numbered blocks.


-- ═══ Block 1: company review state and liveness ════════════════════════════
alter table public.discovered_companies
  add column if not exists watching      boolean     not null default false,
  add column if not exists approved_at   timestamptz,
  add column if not exists rejected_at   timestamptz,
  add column if not exists alive         boolean,
  add column if not exists last_alive_at timestamptz,
  add column if not exists quiet_since   timestamptz;

create index if not exists discovered_companies_watching_idx
  on public.discovered_companies (watching) where watching;


-- ═══ Block 2: hide entries from the public registry (instead of deleting) ══
alter table public.registry_seeds
  add column if not exists hidden_at     timestamptz,
  add column if not exists hidden_reason text;

-- Cori reads seeds to avoid proposing what's already listed; hidden ones don't count
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'cori_agent') then
    grant select (hidden_at) on public.registry_seeds to cori_agent;
  end if;
end $$;


-- ═══ Block 3: Cori finds approved so far → Watching, hidden from /registry ═
update public.discovered_companies c
   set watching = true,
       approved_at = coalesce(c.approved_at, now()),
       updated_at = now()
 where c.domain in (
   select s.company_domain from public.discovered_services s
   where s.linked_seed_id is not null and s.company_domain is not null);

update public.registry_seeds r
   set hidden_at = now(),
       hidden_reason = 'Cori find: hidden until CORTX has evidence (Oct 10)'
 where r.hidden_at is null
   and exists (select 1 from public.discovered_services s where s.linked_seed_id = r.id);


-- ═══ Check (read-only) ═════════════════════════════════════════════════════
--   select
--     (select count(*) from information_schema.columns where table_schema = 'public'
--        and table_name = 'discovered_companies' and column_name in
--        ('watching','approved_at','rejected_at','alive','last_alive_at','quiet_since')) as company_columns,
--     (select count(*) from information_schema.columns where table_schema = 'public'
--        and table_name = 'registry_seeds' and column_name in ('hidden_at','hidden_reason')) as seed_columns,
--     (select count(*) from public.discovered_companies where watching) as watching,
--     (select count(*) from public.registry_seeds where hidden_at is not null) as hidden;
--   → 6 | 2 | (your approvals) | (same or more)
