-- 024_fix_endpoint_submissions_columns.sql
--
-- Production's endpoint_submissions table was created from an older draft of
-- migration 016: it has no description / x_handle / website_url / category /
-- seed_id columns (and has an extra service_id). The app code expects them, so:
--   - public "Submit endpoint" inserts failed ("Failed to submit")
--   - the admin page's pending-submissions query failed silently
--     (showed "No pending submissions")
--   - approving a submission failed when writing seed_id
-- Adding the missing columns makes production match the code and migration 016.
-- Existing rows and the extra service_id column are untouched. Safe to re-run.

alter table public.endpoint_submissions
  add column if not exists description text,
  add column if not exists x_handle    text,
  add column if not exists website_url text,
  add column if not exists category    text,
  add column if not exists seed_id     uuid references public.registry_seeds(id) on delete set null;

-- Cori may fill these on its own candidates (migration 023 granted only the
-- columns that existed at the time).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'cori_agent') then
    grant insert (description, website_url, category) on public.endpoint_submissions to cori_agent;
  end if;
end $$;
