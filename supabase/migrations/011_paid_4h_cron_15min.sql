-- Migration 011: paid verification every 4 hours, cron every 15 minutes
--
-- Model:
--   Cron fires every 15 minutes (set on cron-job.org)
--   Lightweight ping fires on every cron run (~15 min detection for availability)
--   Paid check fires every 4 hours (240 min) — catches payment flow failures within 4h
--
-- At 30 endpoints: ~180 paid checks/day, ~$0.18/day at $0.001/check

alter table public.services
  alter column paid_verification_interval_minutes set default 240;

update public.services
set
  paid_verification_interval_minutes = 240,
  next_paid_verification_at = now()
where deleted_at is null;
