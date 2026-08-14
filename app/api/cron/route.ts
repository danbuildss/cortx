import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runFullCheck, runCanaryCheck } from '@/lib/check-runner/runner';
import { runLightweightCheck } from '@/lib/check-runner/lightweight';
import { persistCheckResult } from '@/lib/check-runner/persist';
import type { CanaryConfig } from '@/lib/check-runner/types';

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
  const { data: paidDue, error: paidErr } = await db
    .from('services')
    .select('id, user_id, name, endpoint_url, environment, test_input, expected_schema, expected_price, max_price, latency_threshold_ms, check_interval_minutes, paid_verification_interval_minutes, paid_verification_mode, canary_payload, canary_expected_schema, canary_max_price_usdc, status, consecutive_failures')
    .is('deleted_at', null)
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
