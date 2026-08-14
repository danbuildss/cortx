import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

  // Last 100 checks for recent stats
  const { data: recentChecks } = await supabase
    .from('checks')
    .select('status, latency_ms, stages')
    .eq('service_id', serviceId)
    .order('started_at', { ascending: false })
    .limit(100);

  let deliveryPassed = 0, deliveryTotal = 0;
  let uptimePassed   = 0, uptimeTotal   = 0;
  const latencies: number[] = [];

  for (const c of recentChecks ?? []) {
    if (c.status === 'error') continue;
    uptimeTotal++;
    if (c.status === 'passed') uptimePassed++;

    if (c.latency_ms != null) latencies.push(c.latency_ms);

    const stages = Array.isArray(c.stages) ? (c.stages as { stage: string; passed: boolean | null }[]) : [];
    const stageMap = new Map(stages.map(s => [s.stage, s.passed]));
    const payment  = stageMap.get('payment');
    const delivery = stageMap.get('delivery');
    if (payment !== undefined && delivery !== undefined) {
      deliveryTotal++;
      if (payment === true && delivery === true) deliveryPassed++;
    }
  }

  const deliveryPct = deliveryTotal > 0
    ? ((deliveryPassed / deliveryTotal) * 100).toFixed(1)
    : null;
  const uptimePct = uptimeTotal > 0
    ? ((uptimePassed / uptimeTotal) * 100).toFixed(1)
    : null;
  const medianMs = latencies.length > 0
    ? [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length / 2)]
    : null;

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
