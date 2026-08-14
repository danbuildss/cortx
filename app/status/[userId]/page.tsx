import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';

export const revalidate = 60;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Dark-mode palette (matches app CSS tokens)
const C = {
  page:       '#08090a',
  surface:    '#111214',
  elevated:   '#16181d',
  border:     '#1e2028',
  borderAlt:  '#2a2d35',
  textPrimary:'#f0f1f3',
  textSecondary:'#9ca3af',
  textMuted:  '#6b7280',
  textDim:    '#4b5563',
  green:      '#22c55e',
  greenBg:    'rgba(34,197,94,0.07)',
  greenBorder:'rgba(34,197,94,0.18)',
  amber:      '#f59e0b',
  amberBg:    'rgba(245,158,11,0.08)',
  red:        '#ef4444',
  redBg:      'rgba(239,68,68,0.08)',
  redBorder:  'rgba(239,68,68,0.2)',
};

const STATUS_COLOR: Record<string, string> = {
  operational: C.green,
  degraded:    C.amber,
  critical:    C.red,
  unknown:     C.textDim,
};

const STATUS_LABEL: Record<string, string> = {
  operational: 'Operational',
  degraded:    'Degraded',
  critical:    'Outage',
  unknown:     'Checking…',
};

type StageRow = { stage: string; passed: boolean | null };

function getStages(stages: unknown): StageRow[] {
  if (!Array.isArray(stages)) return [];
  return stages as StageRow[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export default async function StatusPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = db();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) notFound();

  const since90 = new Date(Date.now() - 90 * 864e5).toISOString();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();

  const [
    { data: services },
    { data: openIncidents },
    { data: checks90 },
    { data: recentChecks },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, endpoint_url, status, last_checked_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),

    supabase
      .from('incidents')
      .select('id, service_id, severity, failure_stage, opened_at')
      .eq('user_id', userId)
      .in('status', ['open', 'acknowledged'])
      .order('opened_at', { ascending: false }),

    // 90-day data for uptime bars (lightweight — no stages)
    supabase
      .from('checks')
      .select('service_id, status, started_at')
      .eq('user_id', userId)
      .gte('started_at', since90)
      .limit(5000),

    // 30-day data for delivery/schema/latency metrics
    supabase
      .from('checks')
      .select('service_id, status, latency_ms, stages')
      .eq('user_id', userId)
      .gte('started_at', since30)
      .order('started_at', { ascending: false })
      .limit(2000),
  ]);

  // ── 90-day uptime bars ──────────────────────────────────────
  const dailyMap = new Map<string, Map<string, { passed: number; failed: number }>>();
  for (const c of checks90 ?? []) {
    if (c.status === 'error') continue;
    const day = new Date(c.started_at).toISOString().slice(0, 10);
    if (!dailyMap.has(c.service_id)) dailyMap.set(c.service_id, new Map());
    const svcDays = dailyMap.get(c.service_id)!;
    const cur = svcDays.get(day) ?? { passed: 0, failed: 0 };
    if (c.status === 'passed') cur.passed++; else cur.failed++;
    svcDays.set(day, cur);
  }

  // 90-day overall uptime per service
  const uptime90 = new Map<string, { passed: number; total: number }>();
  for (const c of checks90 ?? []) {
    if (c.status === 'error') continue;
    const cur = uptime90.get(c.service_id) ?? { passed: 0, total: 0 };
    cur.total++;
    if (c.status === 'passed') cur.passed++;
    uptime90.set(c.service_id, cur);
  }

  const now90 = Date.now();
  const days90: string[] = [];
  for (let i = 89; i >= 0; i--) {
    days90.push(new Date(now90 - i * 864e5).toISOString().slice(0, 10));
  }

  // ── 30-day delivery / schema / latency metrics per service ──
  type SvcMetrics = {
    deliveryPassed: number; deliveryTotal: number;
    schemaPassed: number;   schemaTotal: number;
    latencies: number[];
  };
  const metricsMap = new Map<string, SvcMetrics>();

  for (const c of recentChecks ?? []) {
    if (c.status === 'error') continue;
    const m = metricsMap.get(c.service_id) ?? {
      deliveryPassed: 0, deliveryTotal: 0,
      schemaPassed: 0,   schemaTotal: 0,
      latencies: [],
    };

    const stages = getStages(c.stages);
    const stageMap = new Map(stages.map(s => [s.stage, s.passed]));

    // Paid delivery success: payment stage AND delivery stage both passed
    const paymentPassed  = stageMap.get('payment');
    const deliveryPassed = stageMap.get('delivery');
    if (paymentPassed !== undefined && deliveryPassed !== undefined) {
      m.deliveryTotal++;
      if (paymentPassed === true && deliveryPassed === true) m.deliveryPassed++;
    }

    // Schema validity: checks that reached schema_validation stage
    const schemaPassed = stageMap.get('schema_validation');
    if (schemaPassed !== undefined) {
      m.schemaTotal++;
      if (schemaPassed === true) m.schemaPassed++;
    }

    if (c.latency_ms != null) m.latencies.push(c.latency_ms);

    metricsMap.set(c.service_id, m);
  }

  const incidentServiceIds = new Set((openIncidents ?? []).map(i => i.service_id));
  const allOk = (services ?? []).every(s => s.status === 'operational' || s.status === 'unknown');
  const hasCritical = (services ?? []).some(s => s.status === 'critical');

  const overallColor = hasCritical ? C.red : !allOk ? C.amber : C.green;
  const overallLabel = hasCritical ? 'Partial outage' : !allOk ? 'Degraded performance' : 'All systems operational';

  const now = new Date().toUTCString();

  return (
    <div style={{ minHeight: '100vh', background: C.page, color: C.textPrimary, fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: overallColor,
              boxShadow: `0 0 8px ${overallColor}88`,
            }} />
            <span style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary }}>{overallLabel}</span>
          </div>
          <p style={{ fontSize: 12, color: C.textDim, marginLeft: 20 }}>Updated {now}</p>
        </div>

        {/* Active incidents */}
        {(openIncidents ?? []).length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <SectionLabel>Active incidents</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {openIncidents!.map(inc => {
                const svc = (services ?? []).find(s => s.id === inc.service_id);
                return (
                  <div key={inc.id} style={{
                    background: C.redBg, border: `1px solid ${C.redBorder}`,
                    borderRadius: 8, padding: '12px 16px',
                  }}>
                    <div style={{ fontSize: 13, color: C.red, fontWeight: 500, marginBottom: 4 }}>
                      {inc.severity === 'critical' ? 'Outage' : 'Degraded'} — {svc?.name ?? 'Unknown service'}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      Failed at <span style={{ fontFamily: 'var(--font-geist-mono)', color: C.textSecondary }}>{inc.failure_stage}</span>
                      {' · '}opened {formatRelative(inc.opened_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Services */}
        <div>
          <SectionLabel>Services</SectionLabel>

          {(services ?? []).length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '32px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>
              No services configured.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(services ?? []).map((svc, i) => {
                const color  = STATUS_COLOR[svc.status ?? 'unknown'] ?? C.textDim;
                const label  = STATUS_LABEL[svc.status ?? 'unknown'] ?? 'Unknown';
                const hasIncident = incidentServiceIds.has(svc.id);
                const isFirst = i === 0;
                const isLast  = i === (services!.length - 1);

                const svcDays = dailyMap.get(svc.id);

                const stat90 = uptime90.get(svc.id);
                const uptime90pct = stat90 && stat90.total > 0
                  ? ((stat90.passed / stat90.total) * 100).toFixed(1)
                  : null;

                const m = metricsMap.get(svc.id);
                const deliveryPct = m && m.deliveryTotal > 0
                  ? ((m.deliveryPassed / m.deliveryTotal) * 100).toFixed(1)
                  : null;
                const schemaPct = m && m.schemaTotal > 0
                  ? ((m.schemaPassed / m.schemaTotal) * 100).toFixed(1)
                  : null;
                const medianMs = m ? median(m.latencies) : null;
                const lastVerified = svc.last_checked_at ? formatRelative(svc.last_checked_at) : null;

                return (
                  <div key={svc.id} style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderTopLeftRadius:     isFirst ? 8 : 0,
                    borderTopRightRadius:    isFirst ? 8 : 0,
                    borderBottomLeftRadius:  isLast  ? 8 : 0,
                    borderBottomRightRadius: isLast  ? 8 : 0,
                    padding: '16px 18px',
                  }}>
                    {/* Service name row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, marginBottom: 2 }}>
                          {svc.name}
                          {hasIncident && (
                            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: C.red, background: C.redBg, padding: '2px 6px', borderRadius: 4 }}>
                              INCIDENT
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: C.textDim, fontFamily: 'var(--font-geist-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {svc.endpoint_url}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%', background: color,
                          ...(svc.status === 'operational' ? { boxShadow: `0 0 5px ${color}88` } : {}),
                        }} />
                        <span style={{ fontSize: 12, color, fontWeight: 500 }}>{label}</span>
                      </div>
                    </div>

                    {/* Metrics row */}
                    <div style={{ display: 'flex', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
                      {uptime90pct !== null && (
                        <Metric
                          label="90d uptime"
                          value={`${uptime90pct}%`}
                          color={Number(uptime90pct) >= 99 ? C.green : Number(uptime90pct) >= 95 ? C.amber : C.red}
                        />
                      )}
                      {deliveryPct !== null && (
                        <Metric
                          label="Paid delivery"
                          value={`${deliveryPct}%`}
                          color={Number(deliveryPct) >= 99 ? C.green : Number(deliveryPct) >= 95 ? C.amber : C.red}
                        />
                      )}
                      {schemaPct !== null && (
                        <Metric
                          label="Schema valid"
                          value={`${schemaPct}%`}
                          color={Number(schemaPct) >= 99 ? C.green : Number(schemaPct) >= 95 ? C.amber : C.red}
                        />
                      )}
                      {medianMs !== null && (
                        <Metric label="Median latency" value={`${medianMs}ms`} />
                      )}
                      {lastVerified && (
                        <Metric label="Last verified" value={lastVerified} />
                      )}
                    </div>

                    {/* 90-day uptime bars */}
                    <div style={{ display: 'flex', gap: 1.5, height: 20, alignItems: 'stretch' }}>
                      {days90.map(day => {
                        const counts = svcDays?.get(day);
                        const hasData = counts && (counts.passed > 0 || counts.failed > 0);
                        const bg = !hasData ? C.elevated : counts!.failed > 0 ? C.red : C.green;
                        return (
                          <div key={day} title={day} style={{ flex: 1, background: bg, borderRadius: 2, minWidth: 0, opacity: hasData ? 1 : 0.3 }} />
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: C.textDim }}>90 days ago</span>
                      <span style={{ fontSize: 10, color: C.textDim }}>today</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 60, textAlign: 'center' }}>
          <a
            href="https://usecortx.dev"
            style={{ fontSize: 12, color: C.textDim, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ color: C.textDim }}>Monitored by</span>
            <span style={{ color: C.textSecondary, fontWeight: 600 }}>CORTX</span>
            <span style={{ color: C.textDim }}>· x402 payment reliability</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: color ?? C.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: C.textDim,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
