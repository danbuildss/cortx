import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';

export const revalidate = 60;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const STATUS_COLOR: Record<string, string> = {
  operational: '#22c55e',
  degraded:    '#f59e0b',
  critical:    '#ef4444',
  unknown:     '#444',
};

const STATUS_LABEL: Record<string, string> = {
  operational: 'Operational',
  degraded:    'Degraded',
  critical:    'Outage',
  unknown:     'Checking…',
};

export default async function StatusPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const supabase = db();

  // Verify user exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) notFound();

  const [
    { data: services },
    { data: openIncidents },
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

    supabase
      .from('checks')
      .select('service_id, status, started_at')
      .eq('user_id', userId)
      .gte('started_at', new Date(Date.now() - 90 * 864e5).toISOString())
      .limit(5000),
  ]);

  // Uptime % per service (last 90 days, errors excluded)
  const uptime = new Map<string, { passed: number; total: number }>();
  for (const c of recentChecks ?? []) {
    if (c.status === 'error') continue;
    const cur = uptime.get(c.service_id) ?? { passed: 0, total: 0 };
    cur.total++;
    if (c.status === 'passed') cur.passed++;
    uptime.set(c.service_id, cur);
  }

  // Daily buckets for 90-day uptime bars
  const dailyMap = new Map<string, Map<string, { passed: number; failed: number }>>();
  const now90 = Date.now();
  for (const c of recentChecks ?? []) {
    if (c.status === 'error') continue;
    const day = new Date(c.started_at).toISOString().slice(0, 10);
    if (!dailyMap.has(c.service_id)) dailyMap.set(c.service_id, new Map());
    const svcDays = dailyMap.get(c.service_id)!;
    const cur = svcDays.get(day) ?? { passed: 0, failed: 0 };
    if (c.status === 'passed') cur.passed++;
    else cur.failed++;
    svcDays.set(day, cur);
  }

  // Pre-compute 90-day keys in order
  const days90: string[] = [];
  for (let i = 89; i >= 0; i--) {
    days90.push(new Date(now90 - i * 864e5).toISOString().slice(0, 10));
  }

  const incidentServiceIds = new Set((openIncidents ?? []).map(i => i.service_id));
  const allOk = (services ?? []).every(s => s.status === 'operational' || s.status === 'unknown');
  const hasCritical = (services ?? []).some(s => s.status === 'critical');

  const overallColor = hasCritical ? '#ef4444' : !allOk ? '#f59e0b' : '#22c55e';
  const overallLabel = hasCritical
    ? 'Partial outage'
    : !allOk
    ? 'Degraded performance'
    : 'All systems operational';

  const now = new Date().toUTCString();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#f0f0f0',
      fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: overallColor,
              boxShadow: `0 0 8px ${overallColor}88`,
            }} />
            <span style={{ fontSize: 22, fontWeight: 600, color: '#f0f0f0' }}>
              {overallLabel}
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#444', marginLeft: 20 }}>
            Updated {now}
          </p>
        </div>

        {/* Open incidents */}
        {(openIncidents ?? []).length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <SectionLabel>Active incidents</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {openIncidents!.map(inc => {
                const svc = (services ?? []).find(s => s.id === inc.service_id);
                return (
                  <div key={inc.id} style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 8,
                    padding: '12px 16px',
                  }}>
                    <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 500, marginBottom: 4 }}>
                      {inc.severity === 'critical' ? 'Outage' : 'Degraded'} — {svc?.name ?? 'Unknown service'}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Failed at <span style={{ fontFamily: 'var(--font-geist-mono)', color: '#888' }}>{inc.failure_stage}</span>
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
            <div style={{
              background: '#111', border: '1px solid #1f1f1f', borderRadius: 8,
              padding: '32px', textAlign: 'center', color: '#444', fontSize: 13,
            }}>
              No services configured.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(services ?? []).map((svc, i) => {
                const stat = uptime.get(svc.id);
                const pct = stat && stat.total > 0
                  ? ((stat.passed / stat.total) * 100).toFixed(1)
                  : null;
                const color = STATUS_COLOR[svc.status ?? 'unknown'] ?? '#444';
                const label = STATUS_LABEL[svc.status ?? 'unknown'] ?? 'Unknown';
                const hasIncident = incidentServiceIds.has(svc.id);
                const isFirst = i === 0;
                const isLast = i === (services!.length - 1);

                const svcDays = dailyMap.get(svc.id);

                return (
                  <div key={svc.id} style={{
                    background: '#111',
                    border: '1px solid #1a1a1a',
                    borderTopLeftRadius: isFirst ? 8 : 0,
                    borderTopRightRadius: isFirst ? 8 : 0,
                    borderBottomLeftRadius: isLast ? 8 : 0,
                    borderBottomRightRadius: isLast ? 8 : 0,
                    padding: '14px 18px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f0', marginBottom: 2 }}>
                          {svc.name}
                          {hasIncident && (
                            <span style={{
                              marginLeft: 8, fontSize: 10, fontWeight: 600,
                              color: '#ef4444', background: 'rgba(239,68,68,0.1)',
                              padding: '2px 6px', borderRadius: 4,
                            }}>
                              INCIDENT
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: 11, color: '#444',
                          fontFamily: 'var(--font-geist-mono)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {svc.endpoint_url}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
                        {pct !== null && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: Number(pct) >= 99 ? '#22c55e' : Number(pct) >= 95 ? '#f59e0b' : '#ef4444' }}>
                              {pct}%
                            </div>
                            <div style={{ fontSize: 10, color: '#444' }}>90d uptime</div>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%', background: color,
                            ...(svc.status === 'operational' ? { boxShadow: `0 0 5px ${color}88` } : {}),
                          }} />
                          <span style={{ fontSize: 12, color, fontWeight: 500, minWidth: 76 }}>
                            {label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 90-day uptime bars */}
                    <div style={{ display: 'flex', gap: 1.5, height: 24, alignItems: 'stretch' }}>
                      {days90.map(day => {
                        const counts = svcDays?.get(day);
                        const hasData = counts && (counts.passed > 0 || counts.failed > 0);
                        const bg = !hasData ? '#1f1f1f' : counts.failed > 0 ? '#ef4444' : '#22c55e';
                        return (
                          <div key={day} title={day} style={{ flex: 1, background: bg, borderRadius: 2, minWidth: 0, opacity: hasData ? 1 : 0.4 }} />
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: '#333' }}>90 days ago</span>
                      <span style={{ fontSize: 10, color: '#333' }}>today</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 60, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#333' }}>
            Monitored by{' '}
            <span style={{ color: '#555', fontWeight: 500 }}>CORTX</span>
            {' '}· x402 payment reliability
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: '#444',
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
