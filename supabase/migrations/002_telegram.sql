-- ─────────────────────────────────────────────────────────────────────────────
-- CORTX — Telegram connection tables
-- Run this in Supabase → SQL editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── telegram_link_tokens — single-use deep-link tokens ──────────────────────

create table if not exists public.telegram_link_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  token      text        not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_link_tokens_token_idx   on public.telegram_link_tokens (token);
create index if not exists telegram_link_tokens_user_id_idx on public.telegram_link_tokens (user_id);

alter table public.telegram_link_tokens enable row level security;

do $$ begin
  create policy "Users manage own telegram tokens"
    on public.telegram_link_tokens for all
    using  (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ─── telegram_connections — one connection per user ───────────────────────────

create table if not exists public.telegram_connections (
  id                    uuid        primary key default gen_random_uuid(),
  user_id               uuid        not null unique references public.profiles(id) on delete cascade,
  chat_id               text        not null,
  username              text,
  connected_at          timestamptz not null default now(),
  active                boolean     not null default true,
  on_open               boolean     not null default true,
  on_severity_increase  boolean     not null default true,
  on_resolve            boolean     not null default true
);

create index if not exists telegram_connections_user_id_idx on public.telegram_connections (user_id);

alter table public.telegram_connections enable row level security;

do $$ begin
  create policy "Users manage own telegram connection"
    on public.telegram_connections for all
    using  (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
