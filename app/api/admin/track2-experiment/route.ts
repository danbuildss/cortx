import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runReadinessCheck } from '@/lib/check-runner/readiness';
import type { ReadinessResult } from '@/lib/check-runner/readiness';

// GET /api/admin/track2-experiment
// Requires: Authorization: Bearer {CRON_SECRET}
//
// Runs the Track 2 /verify experiment server-side — wallet key stays in Vercel,
// never leaves the server. Returns JSON results to paste into docs/track2-findings.md.
//
// Query params:
//   ?url=<endpoint>   Run against a single URL instead of all DB services
//   ?max_price=<n>    Override max price cap (default 1.0 USDC)

export const maxDuration = 60;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization') ?? '';
  const secret = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const singleUrl = searchParams.get('url');
  const maxPrice = searchParams.get('max_price') ?? '1.0';

  type ServiceRow = {
    id: string;
    name: string;
    endpoint_url: string;
    max_price: string;
    environment: string;
    test_input: Record<string, unknown> | null;
    paid_verification_mode: string;
  };

  let services: Array<{
    id: string;
    name: string;
    endpoint_url: string;
    max_price: string;
    environment: 'mainnet' | 'testnet';
    test_input: Record<string, unknown> | null;
  }>;

  if (singleUrl) {
    services = [{
      id: 'manual',
      name: singleUrl,
      endpoint_url: singleUrl,
      max_price: maxPrice,
      environment: 'mainnet',
      test_input: null,
    }];
  } else {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await db
      .from('services')
      .select('id, name, endpoint_url, max_price, environment, test_input, paid_verification_mode')
      .is('deleted_at', null)
      .is('monitoring_paused_reason', null)
      .neq('paid_verification_mode', 'disabled');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    services = (data as ServiceRow[] ?? []).map(r => ({
      id: r.id,
      name: r.name,
      endpoint_url: r.endpoint_url,
      max_price: r.max_price ?? maxPrice,
      environment: (r.environment as 'mainnet' | 'testnet') ?? 'mainnet',
      test_input: r.test_input,
    }));
  }

  const results: Array<{ service_name: string; result: ReadinessResult }> = [];

  for (const svc of services) {
    const result = await runReadinessCheck({
      service_id: svc.id,
      endpoint_url: svc.endpoint_url,
      max_price: svc.max_price,
      environment: svc.environment,
      test_input: svc.test_input,
    });
    results.push({ service_name: svc.name, result });
  }

  // Build summary
  const total = results.length;
  const ready = results.filter(r => r.result.status === 'ready').length;
  const notReady = results.filter(r => r.result.status === 'not_ready').length;
  const errored = results.filter(r => r.result.status === 'error').length;
  const facilitatorResponded = results.filter(r => r.result.facilitator_responded).length;
  const uniqueFacilitators = [...new Set(results.map(r => r.result.facilitator_url).filter(Boolean))];
  const customFacilitators = [...new Set(
    results.filter(r => r.result.facilitator_is_custom).map(r => r.result.facilitator_url)
  )];
  const ttls = results.map(r => r.result.authorization_ttl_seconds).filter(Boolean) as number[];
  const avgTtl = ttls.length > 0 ? Math.round(ttls.reduce((a, b) => a + b, 0) / ttls.length) : null;

  const stageFailures: Record<string, number> = {};
  const invalidReasons: Record<string, number> = {};
  for (const { result } of results) {
    if (result.failure_stage) {
      stageFailures[result.failure_stage] = (stageFailures[result.failure_stage] ?? 0) + 1;
    }
    if (result.verify_invalid_reason) {
      invalidReasons[result.verify_invalid_reason] = (invalidReasons[result.verify_invalid_reason] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    summary: {
      total_services: total,
      ready,
      not_ready: notReady,
      errors: errored,
      facilitator_responded: facilitatorResponded,
      unique_facilitators: uniqueFacilitators,
      custom_facilitators: customFacilitators,
      avg_authorization_ttl_seconds: avgTtl,
      stage_failures: stageFailures,
      verify_invalid_reasons: invalidReasons,
    },
    results,
  });
}
