-- 015_rate_limiting.sql
-- V1.1: rate limiting for sensitive routes via Postgres-backed sliding window

create table if not exists public.rate_limit_events (
  id         bigint generated always as identity primary key,
  key        text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_key_created_idx
  on public.rate_limit_events(key, created_at);

-- Service role only
alter table public.rate_limit_events enable row level security;
create policy "Service role only" on public.rate_limit_events
  using (false);

-- check_and_record_rate_limit
-- Returns true  → request is allowed (event recorded)
-- Returns false → rate limit exceeded (no event recorded)
-- Cleans up events older than 24h for the key on each call.
create or replace function public.check_and_record_rate_limit(
  p_key            text,
  p_max            int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
as $$
declare
  v_window_start timestamptz;
  v_count        int;
begin
  v_window_start := now() - (p_window_seconds || ' seconds')::interval;

  -- Lazy cleanup: remove stale events for this key
  delete from public.rate_limit_events
  where key = p_key and created_at < now() - interval '24 hours';

  select count(*) into v_count
  from public.rate_limit_events
  where key = p_key and created_at >= v_window_start;

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_events(key) values (p_key);
  return true;
end;
$$;
