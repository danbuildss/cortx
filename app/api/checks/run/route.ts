import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { runCheck } from '@/lib/check-runner/runner';
import { persistCheckResult } from '@/lib/check-runner/persist';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;

// POST /api/checks/run
// Body: { service_id: string }
// Runs a check immediately for the given service (manual trigger from UI)
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { service_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.service_id) {
    return NextResponse.json({ error: 'service_id required' }, { status: 400 });
  }

  // Verify user session
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 3 manual checks per service per 10 minutes
  const allowed = await checkRateLimit(`run:${user.id}:${body.service_id}`, 3, 600);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many manual checks. Wait a few minutes before trying again.' }, { status: 429 });
  }

  // Fetch service (enforces ownership via RLS)
  const { data: svc, error } = await userClient
    .from('services')
    .select('id, user_id, name, endpoint_url, environment, test_input, expected_schema, expected_price, max_price, latency_threshold_ms, check_interval_minutes, status, consecutive_failures')
    .eq('id', body.service_id)
    .is('deleted_at', null)
    .single();

  if (error || !svc) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  const result = await runCheck({
    id: svc.id,
    user_id: svc.user_id,
    endpoint_url: svc.endpoint_url,
    test_input: svc.test_input as Record<string, unknown>,
    expected_schema: svc.expected_schema as Record<string, unknown>,
    expected_price: String(svc.expected_price),
    max_price: String(svc.max_price),
    latency_threshold_ms: svc.latency_threshold_ms,
    environment: svc.environment as 'mainnet' | 'testnet',
  });

  await persistCheckResult(svc, result);

  return NextResponse.json({ status: result.status, failure_stage: result.failure_stage, latency_ms: result.latency_ms });
}
