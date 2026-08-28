import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runFullCheck, runCanaryCheck } from '@/lib/check-runner/runner';
import { runLightweightCheck } from '@/lib/check-runner/lightweight';
import { persistCheckResult } from '@/lib/check-runner/persist';
import type { TriggerSource } from '@/lib/check-runner/persist';
import { sendTelegramAlert } from '@/lib/telegram';
import type { CanaryConfig, CheckResult } from '@/lib/check-runner/types';

const SPEND_CAP_CODES = new Set(['DAILY_SPEND_CAP_EXCEEDED', 'MONTHLY_SPEND_CAP_EXCEEDED']);

// Don't fire another anomaly-triggered paid check within this window
const ANOMALY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export const maxDuration = 60;

// GET /api/cron — called by cron-job.org on schedule
// Requires: Authorization: Bearer {CRON_SECRET}
// Dual-loop: lightweight pings on next_check_at, paid verifications on next_paid_verification_at
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization') ?? '';
  const secret = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  // ── Loop 1: Lightweight pings ─────────────────────────────────────────────
  const { data: lightweightDue, error: lwErr } = await db
    .from('services')
    .select('id, user_id, name, endpoint_url, check_interval_minutes, status, consecutive_failures, latency_threshold_ms, lightweight_check_interval_minutes, last_anomaly_triggered_at, paid_verification_mode, monitoring_paused_reason')
    .is('deleted_at', null)
    .lte('next_check_at', now);

  if (lwErr) {
    return NextResponse.json({ error: lwErr.message }, { status: 500 });
  }

  const lightweightResults: Array<{ id: string; status: string; triggered?: string }> = [];
  const triggeredServiceIds: string[] = [];

  for (const svc of lightweightDue ?? []) {
    try {
      const result = await runLightweightCheck(svc.id, svc.endpoint_url);
      await persistCheckResult(svc, result);

      // Evaluate anomaly triggers after persisting lightweight result
      const triggerReason = evaluateTrigger(svc, result);
      if (triggerReason) {
        await db.from('services')
          .update({
            next_paid_verification_at: now,
            last_anomaly_triggered_at: now,
          })
          .eq('id', svc.id);

        triggeredServiceIds.push(svc.id);
        lightweightResults.push({ id: svc.id, status: result.status, triggered: triggerReason });
      } else {
        lightweightResults.push({ id: svc.id, status: result.status });
      }
    } catch (err) {
      console.error(`Lightweight check failed for service ${svc.id}:`, err);
      lightweightResults.push({ id: svc.id, status: 'error' });
    }
  }

  // ── Loop 2: Paid verifications ────────────────────────────────────────────
  // Auto-unpause services paused by a spend cap if the cap has reset
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(todayStart);
  monthStart.setUTCDate(1);

  await db
    .from('services')
    .update({ monitoring_paused_reason: null })
    .in('monitoring_paused_reason', ['SPEND_CAP_DAILY', 'SPEND_CAP_MONTHLY'])
    .is('deleted_at', null);

  const { data: paidDue, error: paidErr } = await db
    .from('services')
    .select('id, user_id, name, endpoint_url, environment, test_input, expected_schema, expected_price, max_price, latency_threshold_ms, check_interval_minutes, paid_verification_interval_minutes, paid_verification_mode, canary_payload, canary_expected_schema, canary_max_price_usdc, status, consecutive_failures')
    .is('deleted_at', null)
    .is('monitoring_paused_reason', null)
    .lte('next_paid_verification_at', now)
    .neq('paid_verification_mode', 'disabled');

  if (paidErr) {
    return NextResponse.json({ error: paidErr.message }, { status: 500 });
  }

  const paidResults: Array<{ id: string; status: string; type: string; trigger: string }> = [];

  for (const svc of paidDue ?? []) {
    // Determine whether this paid check was anomaly-triggered or scheduled
    const triggerSource: TriggerSource = triggeredServiceIds.includes(svc.id)
      ? (lightweightResults.find(r => r.id === svc.id)?.triggered as TriggerSource ?? 'scheduled')
      : 'scheduled';

    try {
      const serviceConfig = {
        id: svc.id,
        user_id: svc.user_id,
        endpoint_url: svc.endpoint_url,
        test_input: svc.test_input as Record<string, unknown>,
        expected_schema: svc.expected_schema as Record<string, unknown>,
        expected_price: String(svc.expected_price),
        max_price: String(svc.max_price),
        latency_threshold_ms: svc.latency_threshold_ms,
        environment: svc.environment as 'mainnet' | 'testnet',
      };

      let result: CheckResult;
      if (svc.paid_verification_mode === 'canary' && svc.canary_payload) {
        const canaryConfig: CanaryConfig = {
          payload: svc.canary_payload as Record<string, unknown>,
          expected_schema: (svc.canary_expected_schema ?? svc.expected_schema) as Record<string, unknown>,
          max_price_usdc: String(svc.canary_max_price_usdc ?? svc.max_price),
        };
        result = await runCanaryCheck(serviceConfig, canaryConfig);
      } else {
        result = await runFullCheck(serviceConfig);
      }

      await persistCheckResult(svc, result, triggerSource);
      paidResults.push({ id: svc.id, status: result.status, type: result.check_type, trigger: triggerSource });

      // Detect spend cap hit — pause the service and alert the builder
      const paymentStage = result.stages?.find(s => s.stage === 'payment');
      const capCode = paymentStage?.error;
      if (capCode && SPEND_CAP_CODES.has(capCode)) {
        const pauseReason = capCode === 'DAILY_SPEND_CAP_EXCEEDED'
          ? 'SPEND_CAP_DAILY'
          : 'SPEND_CAP_MONTHLY';

        await db
          .from('services')
          .update({ monitoring_paused_reason: pauseReason })
          .eq('id', svc.id);

        const { data: telegramConns } = await db
          .from('telegram_connections')
          .select('chat_id')
          .eq('user_id', svc.user_id)
          .eq('active', true);

        const label = capCode === 'DAILY_SPEND_CAP_EXCEEDED'
          ? 'Daily spend cap reached'
          : 'Monthly spend cap reached';
        const alertText =
          `⚠️ <b>CORTX monitoring paused</b>\n\n` +
          `<b>${svc.name}</b> — ${label}.\n\n` +
          `Paid verification has stopped. The service will resume automatically when the cap resets. ` +
          `Check your spend limits in CORTX settings.`;

        for (const conn of telegramConns ?? []) {
          await sendTelegramAlert(conn.chat_id, alertText).catch(() => {});
        }
      }
    } catch (err) {
      console.error(`Paid check failed for service ${svc.id}:`, err);
      paidResults.push({ id: svc.id, status: 'error', type: svc.paid_verification_mode, trigger: triggerSource });
    }
  }

  return NextResponse.json({
    lightweight: { processed: (lightweightDue ?? []).length, results: lightweightResults },
    paid: {
      processed: (paidDue ?? []).length,
      results: paidResults,
      anomaly_triggered: triggeredServiceIds.length,
    },
  });
}

// Returns the trigger reason if a paid check should be fired now, null otherwise.
// Lightweight checks only observe endpoint reachability and latency — price drift
// and payment terms changes are not detectable here and are excluded.
function evaluateTrigger(
  svc: {
    status: string;
    latency_threshold_ms: number;
    last_anomaly_triggered_at: string | null;
    paid_verification_mode: string;
    monitoring_paused_reason: string | null;
  },
  result: CheckResult
): 'anomaly_recovery' | 'anomaly_latency' | null {
  // Don't trigger if monitoring is paused (spend cap hit)
  if (svc.monitoring_paused_reason) return null;

  // Don't trigger if paid checks are disabled for this service
  if (svc.paid_verification_mode === 'disabled') return null;

  // Cooldown: don't retrigger within 1 hour of the last anomaly trigger
  if (svc.last_anomaly_triggered_at) {
    const elapsed = Date.now() - new Date(svc.last_anomaly_triggered_at).getTime();
    if (elapsed < ANOMALY_COOLDOWN_MS) return null;
  }

  // Recovery: endpoint is reachable again after being in a degraded/critical state
  if (result.status === 'passed' && (svc.status === 'degraded' || svc.status === 'critical')) {
    return 'anomaly_recovery';
  }

  // Latency spike: lightweight ping exceeded the user-configured threshold
  if (
    result.latency_ms != null &&
    svc.latency_threshold_ms > 0 &&
    result.latency_ms > svc.latency_threshold_ms
  ) {
    return 'anomaly_latency';
  }

  return null;
}
