-- Migration 019: System settings key-value store
--
-- Used for internal operational state that doesn't belong on a user-facing table.
-- First use: tracking last_wallet_alert_sent_at to prevent spam from the
-- low-balance alert in the cron loop.

CREATE TABLE IF NOT EXISTS public.system_settings (
  key     TEXT PRIMARY KEY,
  value   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the service role can read/write this table — no user-facing RLS needed.
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Seed the wallet alert key so the cron can upsert without a prior insert.
INSERT INTO public.system_settings (key, value)
VALUES ('last_wallet_alert_sent_at', NULL)
ON CONFLICT (key) DO NOTHING;
