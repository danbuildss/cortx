import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { computeMetrics } from '@/lib/metrics';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const STATUS_LABEL: Record<string, string> = {
  operational: 'Operational',
  degraded:    'Degraded',
  critical:    'Outage',
  unknown:     'Unknown',
};

const STATUS_COLOR: Record<string, string> = {
  operational: '#22c55e',
  degraded:    '#f59e0b',
  critical:    '#ef4444',
  unknown:     '#6b7280',
};

// Escape XML entities for safe SVG embedding
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSvg(opts: {
  status: string;
  deliveryPct: string | null;
  uptime: string | null;
  medianMs: number | null;
}): string {
  const statusLabel = STATUS_LABEL[opts.status] ?? 'Unknown';
  const statusColor = STATUS_COLOR[opts.status] ?? '#6b7280';

  // Right-side metrics text
  const metricParts: string[] = [];
  if (opts.deliveryPct !== null) metricParts.push(`${opts.deliveryPct}% delivery`);
  if (opts.uptime !== null) metricParts.push(`${opts.uptime}% uptime`);
  const metricsText = metricParts.join(' · ') || '';

  // Rough character widths for text sizing
  const leftText  = 'CORTX Monitored';
  const midText   = statusLabel;
  const rightText = metricsText;

  const CHAR_W = 7;
  const PAD    = 12;
  const GAP    = 10;

  const leftW  = leftText.length  * CHAR_W + PAD * 2;
  const midW   = midText.length   * CHAR_W + PAD * 2;
  const rightW = rightText ? rightText.length * CHAR_W + PAD * 2 : 0;
  const totalW = leftW + midW + rightW;
  const H = 28;

  let midX  = leftW + midW / 2;
  let rightX = leftW + midW + rightW / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${H}" role="img" aria-label="CORTX Monitored · ${esc(statusLabel)}">
  <title>CORTX Monitored · ${esc(statusLabel)}</title>
  <defs>
    <linearGradient id="s" x2="0" y2="100%">
      <stop offset="0"   stop-color="#bbb" stop-opacity=".1"/>
      <stop offset="1"   stop-color="#000" stop-opacity=".1"/>
    </linearGradient>
    <clipPath id="r">
      <rect width="${totalW}" height="${H}" rx="5" fill="white"/>
    </clipPath>
  </defs>
  <g clip-path="url(#r)">
    <!-- Left: CORTX Monitored -->
    <rect width="${leftW}" height="${H}" fill="#111214"/>
    <!-- Middle: status -->
    <rect x="${leftW}" width="${midW}" height="${H}" fill="${esc(statusColor)}"/>
    <!-- Right: metrics (if any) -->
    ${rightText ? `<rect x="${leftW + midW}" width="${rightW}" height="${H}" fill="#1e2028"/>` : ''}
    <!-- Gradient overlay -->
    <rect width="${totalW}" height="${H}" fill="url(#s)"/>
  </g>
  <!-- Text -->
  <g fill="#fff" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${leftW / 2}" y="${H / 2 + 4}" text-anchor="middle" fill="#e2e8f0" font-weight="600" letter-spacing="0.5">${esc(leftText)}</text>
    <text x="${midX}" y="${H / 2 + 4}" text-anchor="middle" font-weight="600">${esc(statusLabel)}</text>
    ${rightText ? `<text x="${rightX}" y="${H / 2 + 4}" text-anchor="middle" fill="#cbd5e1">${esc(rightText)}</text>` : ''}
  </g>
  <!-- Status dot -->
  <circle cx="${leftW - 14}" cy="${H / 2}" r="3" fill="${esc(statusColor)}" opacity="0.9"/>
</svg>`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  const { serviceId } = await params;
  const supabase = db();

  const { data: service } = await supabase
    .from('services')
    .select('id, status, last_checked_at')
    .eq('id', serviceId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!service) {
    return new NextResponse(
      buildSvg({ status: 'unknown', deliveryPct: null, uptime: null, medianMs: null }),
      { status: 200, headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
    );
  }

  // 30-day window — up to 1000 checks
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: recentChecks } = await supabase
    .from('checks')
    .select('status, latency_ms, stages')
    .eq('service_id', serviceId)
    .gte('started_at', since30)
    .order('started_at', { ascending: false })
    .limit(1000);

  const metrics = computeMetrics(recentChecks ?? []);
  const deliveryPct = metrics.paid_delivery_percent !== null ? String(metrics.paid_delivery_percent) : null;
  const uptimePct   = metrics.uptime_percent !== null        ? String(metrics.uptime_percent)        : null;
  const medianMs    = metrics.median_latency_ms;

  const svg = buildSvg({
    status: service.status ?? 'unknown',
    deliveryPct,
    uptime: uptimePct,
    medianMs,
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    },
  });
}
