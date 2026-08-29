-- Migration 018: Triggered paid checks + spend instrumentation
--
-- Track 1 of the layered monitoring architecture:
-- - Anomaly-driven paid checks (recovery from downtime, latency spike)
-- - Cooldown column prevents repeated triggers on consecutive anomalous pings
-- - trigger_source on checks enables spend attribution by cause
--
-- What can trigger between paid checks (from the lightweight HEAD/GET loop):
--   anomaly_recovery: lightweight passes AND service status is degraded/critical
--   anomaly_latency:  lightweight latency_ms > latency_threshold_ms
--
-- What cannot trigger (lightweight doesn't observe these):
--   price drift, payment terms change — only visible during a full paid check
--
-- Triggered checks supplement periodic paid canaries, not replace them.

-- Track when we last fired an anomaly-triggered paid check.
-- Used for cooldown: don't retrigger within 60 minutes of the last trigger.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS last_anomaly_triggered_at TIMESTAMPTZ;

-- Track the cause of each check for spend attribution.
--   scheduled:         normal periodic paid check
--   anomaly_recovery:  endpoint recovered from degraded/critical status
--   anomaly_latency:   latency exceeded threshold on lightweight ping
ALTER TABLE public.checks
  ADD COLUMN IF NOT EXISTS trigger_source TEXT NOT NULL DEFAULT 'scheduled'
  CHECK (trigger_source IN ('scheduled', 'anomaly_recovery', 'anomaly_latency'));

-- Index for spend attribution queries (total USDC by cause, by service, by period)
CREATE INDEX IF NOT EXISTS checks_trigger_source_idx
  ON public.checks (service_id, trigger_source, started_at DESC)
  WHERE observed_price IS NOT NULL;
