import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runCheck } from '@/lib/check-runner/runner';
import { persistCheckResult } from '@/lib/check-runner/persist';


// GET /api/cron?secret=... — called by cron-job.org on schedule
// Processes all services where next_check_at <= now()
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: services, error } = await db
    .from('services')
    .select('id, user_id, name, endpoint_url, environment, test_input, expected_schema, expected_price, max_price, latency_threshold_ms, check_interval_minutes, status, consecutive_failures')
    .is('deleted_at', null)
    .lte('next_check_at', new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const due = services ?? [];
  const results: Array<{ id: string; status: string }> = [];

  for (const svc of due) {
    try {
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
      results.push({ id: svc.id, status: result.status });
    } catch (err) {
      console.error(`Check failed for service ${svc.id}:`, err);
      results.push({ id: svc.id, status: 'error' });
    }
  }

  return NextResponse.json({ processed: due.length, results });
}
