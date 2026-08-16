-- Migration 010: paid verification interval → 1440 min (once per day)
--
-- Cron runs every 2 hours. Lightweight pings fire on every cron run.
-- Paid checks (real USDC) should fire once per day only.
-- Setting paid_verification_interval_minutes = 1440 achieves this.

-- Update column default
alter table public.services
  alter column paid_verification_interval_minutes set default 1440;

-- Update all existing active services
update public.services
set
  paid_verification_interval_minutes = 1440,
  next_paid_verification_at = now()  -- so next cron fire triggers the first daily paid check
where deleted_at is null;
