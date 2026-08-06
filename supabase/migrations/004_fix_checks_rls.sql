-- Fix checks INSERT policy: previous policy used `with check (true)` which granted
-- any authenticated user insert access for any user_id/service_id.
-- This replaces it with ownership-scoped insert that also verifies service ownership.

drop policy if exists "Service role inserts checks" on public.checks;

create policy "Users insert own checks"
  on public.checks for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.services
      where services.id = checks.service_id
        and services.user_id = auth.uid()
    )
  );
