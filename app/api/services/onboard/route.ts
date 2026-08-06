import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runCheck } from '@/lib/check-runner/runner';
import { persistCheckResult } from '@/lib/check-runner/persist';

export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const {
    name, endpoint_url, environment, test_input, expected_schema,
    expected_price, max_price, check_interval_minutes,
    latency_threshold_ms,
  } = body;

  if (!name || !endpoint_url || !expected_price || !max_price) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Parse and validate
  let parsedInput: Record<string, unknown>;
  let parsedSchema: Record<string, unknown>;
  try { parsedInput = typeof test_input === 'string' ? JSON.parse(test_input) : (test_input as Record<string, unknown>) ?? {}; }
  catch { return NextResponse.json({ error: 'test_input must be valid JSON' }, { status: 400 }); }
  try { parsedSchema = typeof expected_schema === 'string' ? JSON.parse(expected_schema) : (expected_schema as Record<string, unknown>) ?? { type: 'object' }; }
  catch { return NextResponse.json({ error: 'expected_schema must be valid JSON' }, { status: 400 }); }

  const interval = parseInt(String(check_interval_minutes ?? 60), 10);
  const latency = parseInt(String(latency_threshold_ms ?? 10000), 10);
  const env = (environment === 'testnet' ? 'testnet' : 'mainnet') as 'mainnet' | 'testnet';

  // Create service
  const { data: svc, error: insertErr } = await supabase
    .from('services')
    .insert({
      user_id: user.id,
      name: String(name).trim(),
      endpoint_url: String(endpoint_url).trim(),
      environment: env,
      test_input: parsedInput,
      expected_schema: parsedSchema,
      expected_price: parseFloat(String(expected_price)),
      max_price: parseFloat(String(max_price)),
      latency_threshold_ms: latency,
      check_interval_minutes: interval,
      next_check_at: new Date(Date.now() + interval * 60 * 1000).toISOString(),
    })
    .select('id, user_id, name, status, consecutive_failures, check_interval_minutes, latency_threshold_ms')
    .single();

  if (insertErr || !svc) {
    return NextResponse.json({ error: insertErr?.message ?? 'Failed to create service' }, { status: 500 });
  }

  // Run first check
  const result = await runCheck({
    id: svc.id,
    user_id: svc.user_id,
    endpoint_url: String(endpoint_url).trim(),
    test_input: parsedInput,
    expected_schema: parsedSchema,
    expected_price: String(expected_price),
    max_price: String(max_price),
    latency_threshold_ms: latency,
    environment: env,
  });

  await persistCheckResult(svc, result);

  return NextResponse.json({
    serviceId: svc.id,
    status: result.status,
    stages: result.stages,
    failure_stage: result.failure_stage,
    observed_price: result.observed_price,
    error_message: result.error_message,
  });
}
