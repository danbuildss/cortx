-- ─────────────────────────────────────────────────────────────────────────────
-- CORTX — V2 public endpoint submissions
-- Run in Supabase → SQL editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Extra metadata fields on registry_seeds (for richer registry cards)
alter table public.registry_seeds
  add column if not exists x_handle    text,
  add column if not exists website_url text,
  add column if not exists category    text;

-- Public submission queue — pending admin review before anything goes live
create table if not exists public.endpoint_submissions (
  id               uuid primary key default gen_random_uuid(),
  endpoint_url     text not null,
  name             text not null,
  description      text,
  x_handle         text,
  website_url      text,
  category         text,
  submitter_email  text,
  submitted_at     timestamptz not null default now(),
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected')),
  reviewed_at      timestamptz,
  reviewed_by      uuid references auth.users(id),
  rejection_reason text,
  seed_id          uuid references public.registry_seeds(id)
);

-- Service role only — public can insert via API (uses service role), never via client
alter table public.endpoint_submissions enable row level security;
create policy "Service role only" on public.endpoint_submissions using (false);
