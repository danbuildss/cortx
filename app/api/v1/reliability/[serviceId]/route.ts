import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { computeMetrics } from '@/lib/metrics';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const { serviceId } = await params;
  const supabase = db();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();

  const [
    { data: service },
    { data: activeIncident },
    { data: checks },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, status, last_checked_at, paid_verification_mode, last_lightweight_check_at, last_paid_verification_at, last_full_verification_at')
      .eq('id', serviceId)
      .is('deleted_at', null)
      .maybeSingle(),

    supabase
      .from('incidents')
      .select('id, severity, failure_stage, opened_at')
      .eq('service_id', serviceId)
      .in('status', ['open', 'acknowledged'])
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('checks')
      .select('status, latency_ms, stages, check_type')
      .eq('service_id', serviceId)
      .gte('started_at', since30)
      .order('started_at', { ascending: false })
      .limit(1000),
  ]);

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: CORS });
  }

  const allChecks = checks ?? [];
  const paidChecks = allChecks.filter(c => c.check_type === 'full' || c.check_type === 'canary');
  const metrics = computeMetrics(paidChecks.length > 0 ? paidChecks : allChecks);

  return NextResponse.json(
    {
      service_id:              service.id,
      service_name:            service.name,
      status:                  service.status ?? 'unknown',
      window:                  '30d',
      uptime_percent:          metrics.uptime_percent,
      paid_delivery_percent:   metrics.paid_delivery_percent,
      schema_validity_percent: metrics.schema_validity_percent,
      median_latency_ms:       metrics.median_latency_ms,
      last_verified_at:        service.last_checked_at ?? null,
      verification: {
        mode:               service.paid_verification_mode ?? 'full',
        last_lightweight_at: service.last_lightweight_check_at ?? null,
        last_paid_at:        service.last_paid_verification_at ?? null,
        last_full_at:        service.last_full_verification_at ?? null,
      },
      active_incident:         activeIncident
        ? {
            id:            activeIncident.id,
            severity:      activeIncident.severity,
            failure_stage: activeIncident.failure_stage,
            opened_at:     activeIncident.opened_at,
          }
        : null,
    },
    {
      headers: {
        ...CORS,
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    }
  );
}
