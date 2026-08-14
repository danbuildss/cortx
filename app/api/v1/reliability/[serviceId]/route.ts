import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { computeMetrics } from '@/lib/metrics';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
      .select('id, name, status, last_checked_at')
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
      .select('status, latency_ms, stages')
      .eq('service_id', serviceId)
      .gte('started_at', since30)
      .order('started_at', { ascending: false })
      .limit(1000),
  ]);

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  const metrics = computeMetrics(checks ?? []);

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
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    }
  );
}
