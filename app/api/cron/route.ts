import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runFullCheck, runCanaryCheck } from '@/lib/check-runner/runner';
import { runLightweightCheck } from '@/lib/check-runner/lightweight';
import { persistCheckResult } from '@/lib/check-runner/persist';
import { sendTelegramAlert } from '@/lib/telegram';
import type { CanaryConfig } from '@/lib/check-runner/types';

const SPEND_CAP_CODES = new Set(['DAILY_SPEND_CAP_EXCEEDED', 'MONTHLY_SPEND_CAP_EXCEEDED']);

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
    .select('id, user_id, name, endpoint_url, check_interval_minutes, status, consecutive_failures, latency_threshold_ms, lightweight_check_interval_minutes')
    .is('deleted_at', null)
    .lte('next_check_at', now);

  if (lwErr) {
    return NextResponse.json({ error: lwErr.message }, { status: 500 });
  }

  const lightweightResults: Array<{ id: string; status: string }> = [];

  for (const svc of lightweightDue ?? []) {
    try {
      const result = await runLightweightCheck(svc.id, svc.endpoint_url);
      await persistCheckResult(svc, result);
      lightweightResults.push({ id: svc.id, status: result.status });
    } catch (err) {
      console.error(`Lightweight check failed for service ${svc.id}:`, err);
      lightweightResults.push({ id: svc.id, status: 'error' });
    }
  }

  // ── Loop 2: Paid verifications ────────────────────────────────────────────
  // Auto-unpause services paused by a spend cap if the cap has reset
  // (daily cap resets at UTC midnight, monthly at UTC month start).
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

  const paidResults: Array<{ id: string; status: string; type: string }> = [];

  for (const svc of paidDue ?? []) {
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

      let result;
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

      await persistCheckResult(svc, result);
      paidResults.push({ id: svc.id, status: result.status, type: result.check_type });

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

        // Alert all active Telegram connections for this service's owner
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
      paidResults.push({ id: svc.id, status: 'error', type: svc.paid_verification_mode });
    }
  }

  return NextResponse.json({
    lightweight: { processed: (lightweightDue ?? []).length, results: lightweightResults },
    paid: { processed: (paidDue ?? []).length, results: paidResults },
  });
}
