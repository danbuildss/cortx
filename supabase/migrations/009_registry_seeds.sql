-- Registry seeds: admin-curated endpoints (observed or verified by owner)
create table if not exists public.registry_seeds (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  endpoint_url  text        not null,
  description   text,
  status        text        not null default 'unknown'
    check (status in ('operational', 'degraded', 'critical', 'unknown')),
  is_verified   boolean     not null default false,
  created_at    timestamptz not null default now()
);
