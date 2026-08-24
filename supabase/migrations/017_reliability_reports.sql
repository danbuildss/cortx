-- ─────────────────────────────────────────────────────────────────────────────
-- CORTX — Free reliability report requests (no-auth, one-time check)
-- Run in Supabase → SQL editor
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.reliability_report_requests (
  id              uuid primary key default gen_random_uuid(),
  endpoint_url    text not null,
  email           text not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'running', 'completed', 'failed')),
  check_result    jsonb,
  error_message   text,
  ip_hash         text,
  requested_at    timestamptz not null default now(),
  completed_at    timestamptz
);

-- Index for rate-limiting queries
create index if not exists reliability_report_requests_email_idx
  on public.reliability_report_requests (email, requested_at);

create index if not exists reliability_report_requests_url_email_idx
  on public.reliability_report_requests (endpoint_url, email, requested_at);

-- Service role only — never expose via client
alter table public.reliability_report_requests enable row level security;
create policy "Service role only" on public.reliability_report_requests using (false);
