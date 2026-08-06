-- Feedback table for beta user submissions
create table if not exists public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references public.profiles(id) on delete set null,
  email      text,
  task       text,
  problem    text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Users can insert their own feedback; service role reads all
do $$ begin
  create policy "Users insert own feedback"
    on public.feedback for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
