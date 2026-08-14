import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { computeMetrics } from '@/lib/metrics';

export const revalidate = 60;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const C = {
  page:          '#08090a',
  surface:       '#111214',
  elevated:      '#16181d',
  border:        '#1e2028',
  borderAlt:     '#2a2d35',
  textPrimary:   '#f0f1f3',
  textSecondary: '#9ca3af',
  textMuted:     '#6b7280',
  textDim:       '#4b5563',
  green:         '#22c55e',
  greenBg:       'rgba(34,197,94,0.07)',
  greenBorder:   'rgba(34,197,94,0.18)',
  amber:         '#f59e0b',
  amberBg:       'rgba(245,158,11,0.08)',
  amberBorder:   'rgba(245,158,11,0.2)',
  red:           '#ef4444',
  redBg:         'rgba(239,68,68,0.08)',
  redBorder:     'rgba(239,68,68,0.2)',
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

type IncidentRow = {
  id: string;
  severity: string;
  failure_stage: string | null;
  opened_at: string;
  resolved_at: string | null;
  status: string;
};

export default async function ServiceStatusPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const supabase = db();

  const since90 = new Date(Date.now() - 90 * 864e5).toISOString();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();

  const [
    { data: service },
    { data: activeIncident },
    { data: checks30 },
    { data: checks90 },
    { data: recentIncidents },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, user_id, name, endpoint_url, status, last_checked_at')
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

    supabase
      .from('checks')
      .select('status, started_at')
      .eq('service_id', serviceId)
      .gte('started_at', since90)
      .limit(5000),

    supabase
      .from('incidents')
      .select('id, severity, failure_stage, opened_at, resolved_at, status')
      .eq('service_id', serviceId)
      .order('opened_at', { ascending: false })
      .limit(10),
  ]);

  if (!service) notFound();

  const metrics = computeMetrics(checks30 ?? []);

  // 90-day uptime bars
  const dailyMap = new Map<string, { passed: number; failed: number }>();
  for (const c of checks90 ?? []) {
    if (c.status === 'error') continue;
    const day = new Date(c.started_at).toISOString().slice(0, 10);
    const cur = dailyMap.get(day) ?? { passed: 0, failed: 0 };
    if (c.status === 'passed') cur.passed++; else cur.failed++;
    dailyMap.set(day, cur);
  }

  const now = Date.now();
  const days90: string[] = [];
  for (let i = 89; i >= 0; i--) {
    days90.push(new Date(now - i * 864e5).toISOString().slice(0, 10));
  }

  // 90-day overall uptime
  const eligible90 = (checks90 ?? []).filter(c => c.status !== 'error');
  const uptime90Pct = eligible90.length > 0
    ? (eligible90.filter(c => c.status === 'passed').length / eligible90.length * 100).toFixed(1)
    : null;

  const status = service.status ?? 'unknown';
  const statusColor = STATUS_COLOR[status] ?? C.textDim;
  const statusLabel = STATUS_LABEL[status] ?? 'Unknown';

  const siteUrl = 'https://usecortx.dev';
  const badgeUrl  = `${siteUrl}/api/badge/${serviceId}`;
  const statusUrl = `${siteUrl}/status/service/${serviceId}`;
  const accountStatusUrl = `${siteUrl}/status/${service.user_id}`;
  const apiUrl    = `${siteUrl}/api/v1/reliability/${serviceId}`;
  const markdown  = `[![CORTX Monitored](${badgeUrl})](${statusUrl})`;
  const htmlEmbed = `<a href="${statusUrl}"><img src="${badgeUrl}" alt="CORTX Monitored"></a>`;

  const updatedAt = new Date().toUTCString();

  return (
    <div style={{ minHeight: '100vh', background: C.page, color: C.textPrimary, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
          <a href={accountStatusUrl} style={{ fontSize: 12, color: C.textMuted, textDecoration: 'none' }}>
            ← Account status
          </a>
          <a href={siteUrl} style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em', color: C.textPrimary, textDecoration: 'none' }}>
            CORTX
          </a>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: statusColor,
              boxShadow: status === 'operational' ? `0 0 8px ${statusColor}88` : undefined,
            }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', color: C.textPrimary, marginBottom: 6 }}>
            {service.name}
          </h1>
          <div style={{ fontSize: 12, color: C.textDim, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {service.endpoint_url}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: C.textDim }}>
            Updated {updatedAt}
          </div>
        </div>

        {/* Active incident */}
        {activeIncident && (
          <div style={{
            background: C.redBg, border: `1px solid ${C.redBorder}`,
            borderRadius: 8, padding: '14px 18px', marginBottom: 32,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Active incident
            </div>
            <div style={{ fontSize: 14, color: C.textPrimary, marginBottom: 4, fontWeight: 500 }}>
              {activeIncident.severity === 'critical' ? 'Outage' : 'Degraded performance'}
              {activeIncident.failure_stage && (
                <span style={{ fontWeight: 400, color: C.textSecondary }}> — failed at <span style={{ fontFamily: 'monospace', color: C.red }}>{activeIncident.failure_stage}</span></span>
              )}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              Opened {formatRelative(activeIncident.opened_at)}
            </div>
          </div>
        )}

        {/* 30-day metrics */}
        <div style={{ marginBottom: 36 }}>
          <SectionLabel>30-day metrics</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            {uptime90Pct !== null && (
              <MetricCard
                label="90d uptime"
                value={`${uptime90Pct}%`}
                color={Number(uptime90Pct) >= 99 ? C.green : Number(uptime90Pct) >= 95 ? C.amber : C.red}
              />
            )}
            {metrics.uptime_percent !== null && (
              <MetricCard
                label="30d uptime"
                value={`${metrics.uptime_percent}%`}
                color={metrics.uptime_percent >= 99 ? C.green : metrics.uptime_percent >= 95 ? C.amber : C.red}
              />
            )}
            {metrics.paid_delivery_percent !== null && (
              <MetricCard
                label="Paid delivery"
                value={`${metrics.paid_delivery_percent}%`}
                color={metrics.paid_delivery_percent >= 99 ? C.green : metrics.paid_delivery_percent >= 95 ? C.amber : C.red}
              />
            )}
            {metrics.schema_validity_percent !== null && (
              <MetricCard
                label="Schema valid"
                value={`${metrics.schema_validity_percent}%`}
                color={metrics.schema_validity_percent >= 99 ? C.green : metrics.schema_validity_percent >= 95 ? C.amber : C.red}
              />
            )}
            {metrics.median_latency_ms !== null && (
              <MetricCard label="Median latency" value={`${metrics.median_latency_ms}ms`} />
            )}
            {service.last_checked_at && (
              <MetricCard label="Last verified" value={formatRelative(service.last_checked_at)} />
            )}
          </div>
        </div>

        {/* 90-day uptime bar */}
        <div style={{ marginBottom: 40 }}>
          <SectionLabel>90-day availability</SectionLabel>
          <div style={{ display: 'flex', gap: 1.5, height: 20, alignItems: 'stretch' }}>
            {days90.map(day => {
              const counts = dailyMap.get(day);
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

        {/* Recent incidents */}
        {(recentIncidents ?? []).length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <SectionLabel>Recent incidents</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(recentIncidents as IncidentRow[]).map((inc, i) => {
                const isFirst = i === 0;
                const isLast  = i === (recentIncidents!.length - 1);
                const isOpen  = inc.status !== 'resolved';
                const severityColor = inc.severity === 'critical' ? C.red : C.amber;
                return (
                  <div key={inc.id} style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderTopLeftRadius:     isFirst ? 8 : 0,
                    borderTopRightRadius:    isFirst ? 8 : 0,
                    borderBottomLeftRadius:  isLast  ? 8 : 0,
                    borderBottomRightRadius: isLast  ? 8 : 0,
                    padding: '12px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: isOpen ? severityColor : C.green,
                      flexShrink: 0, marginTop: 5,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>
                          {inc.severity === 'critical' ? 'Outage' : 'Degraded'}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: isOpen ? `${severityColor}1a` : C.greenBg,
                          color: isOpen ? severityColor : C.green,
                        }}>
                          {isOpen ? inc.status : 'resolved'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>
                        {inc.failure_stage && (
                          <>Failed at <span style={{ fontFamily: 'monospace', color: C.textSecondary }}>{inc.failure_stage}</span> · </>
                        )}
                        Opened {formatRelative(inc.opened_at)}
                        {inc.resolved_at && (
                          <> · resolved {formatRelative(inc.resolved_at)}</>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Badge embed */}
        <div style={{ marginBottom: 40 }}>
          <SectionLabel>Embed this service</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <EmbedRow label="Markdown" code={markdown} />
            <EmbedRow label="HTML" code={htmlEmbed} />
            <EmbedRow label="Badge URL" code={badgeUrl} />
            <EmbedRow label="API" code={apiUrl} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', paddingTop: 24 }}>
          <a
            href={siteUrl}
            style={{ fontSize: 12, color: C.textDim, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span>Monitored by</span>
            <span style={{ color: C.textSecondary, fontWeight: 600 }}>CORTX</span>
            <span>· x402 payment reliability</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: color ?? C.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function EmbedRow({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{
        background: C.elevated, border: `1px solid ${C.border}`,
        borderRadius: 6, padding: '8px 12px',
        fontSize: 11, color: C.textSecondary,
        fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre',
      }}>
        {code}
      </div>
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
