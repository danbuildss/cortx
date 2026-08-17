create table if not exists discord_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  webhook_url text not null,
  connected_at timestamptz not null default now(),
  on_open boolean not null default true,
  on_severity_increase boolean not null default true,
  on_resolve boolean not null default true,
  unique (user_id)
);

alter table discord_connections enable row level security;

create policy "Users can manage own discord connection"
  on discord_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
