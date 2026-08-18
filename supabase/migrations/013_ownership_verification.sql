-- ─────────────────────────────────────────────────────────────────────────────
-- CORTX — endpoint ownership verification
-- Run in Supabase → SQL editor
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.services
  add column if not exists verification_token  text,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verified_at         timestamptz;

-- verification_status values: 'unverified' | 'pending' | 'verified'
