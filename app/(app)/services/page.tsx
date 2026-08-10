import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

// eslint-disable-next-line react-hooks/purity
const now = Date.now();
const since24h = new Date(now - 86400000).toISOString();

const STATUS_COLOR: Record<string, string> = {
  operational: 'var(--status-operational)',
  degraded:    'var(--status-degraded)',
  critical:    'var(--status-critical)',
  unknown:     'var(--text-muted)',
};
const STATUS_LABEL: Record<string, string> = {
  operational: 'Operational',
  degraded:    'Degraded',
  critical:    'Critical',
  unknown:     'Unknown',
};

export default async function ServicesPage() {
  const supabase = await createClient();

  const [{ data: services }, { data: checks24h }, { data: openIncidents }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, endpoint_url, status, last_checked_at, check_interval_minutes')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),

    supabase
      .from('checks')
      .select('service_id, status, latency_ms, started_at')
      .gte('started_at', since24h)
      .limit(2000),

    supabase
      .from('incidents')
      .select('id, service_id')
      .in('status', ['open', 'acknowledged']),
  ]);

  // Per-service avg latency (24h)
  const latSum = new Map<string, number>();
  const latCnt = new Map<string, number>();
  for (const c of checks24h ?? []) {
    if (c.latency_ms == null || c.status === 'error') continue;
    latSum.set(c.service_id, (latSum.get(c.service_id) ?? 0) + c.latency_ms);
    latCnt.set(c.service_id, (latCnt.get(c.service_id) ?? 0) + 1);
  }

  // Per-service 24h uptime
  const upTotal = new Map<string, number>();
  const upPass  = new Map<string, number>();
  for (const c of checks24h ?? []) {
    if (c.status === 'error') continue;
    upTotal.set(c.service_id, (upTotal.get(c.service_id) ?? 0) + 1);
    if (c.status === 'passed') upPass.set(c.service_id, (upPass.get(c.service_id) ?? 0) + 1);
  }

  // Open incident count per service
  const incMap = new Map<string, number>();
  for (const i of openIncidents ?? []) {
    incMap.set(i.service_id, (incMap.get(i.service_id) ?? 0) + 1);
  }

  const total       = services?.length ?? 0;
  const operational = services?.filter(s => s.status === 'operational').length ?? 0;
  const withIssues  = services?.filter(s => s.status === 'critical' || s.status === 'degraded').length ?? 0;

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Services</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {total} total · {operational} operational
            {withIssues > 0 ? ` · ${withIssues} with issues` : ''}
          </p>
        </div>
        <Link href="/services/new" className="btn-primary">
          + Add service
        </Link>
      </div>

      {/* Services list */}
      {total === 0 ? (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
          borderRadius: 8, padding: '64px 24px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>No services yet</p>
          <Link
            href="/services/new"
            style={{
              fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none',
              padding: '8px 16px', border: '1px solid var(--border-default)', borderRadius: 6,
            }}
          >
            Add your first service
          </Link>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 0 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 0 10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: 4 }}></th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th className="mobile-hide" style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Uptime 24h</th>
                  <th className="mobile-hide" style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Latency</th>
                  <th className="mobile-hide" style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Check</th>
                  <th className="mobile-hide" style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incidents</th>
                </tr>
              </thead>
              <tbody>
                {services?.map((svc, i) => {
                  const isLast   = i === (services.length - 1);
                  const color    = STATUS_COLOR[svc.status ?? 'unknown'] ?? STATUS_COLOR.unknown;
                  const label    = STATUS_LABEL[svc.status ?? 'unknown'] ?? 'Unknown';
                  const total24  = upTotal.get(svc.id) ?? 0;
                  const pass24   = upPass.get(svc.id) ?? 0;
                  const upPct    = total24 > 0 ? ((pass24 / total24) * 100).toFixed(1) + '%' : '—';
                  const latMs    = latCnt.get(svc.id) ? Math.round((latSum.get(svc.id) ?? 0) / (latCnt.get(svc.id) ?? 1)) : null;
                  const openCnt  = incMap.get(svc.id) ?? 0;

                  return (
                    <tr key={svc.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                      {/* Status stripe */}
                      <td style={{ padding: 0, width: 4 }}>
                        <div style={{ width: 3, minHeight: 52, background: color, opacity: 0.6 }} />
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <Link
                          href={`/services/${svc.id}`}
                          style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500, fontSize: 13 }}
                        >
                          {svc.name}
                        </Link>
                        <div style={{
                          fontSize: 11, color: 'var(--text-dim)',
                          fontFamily: 'var(--font-geist-mono)',
                          marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', maxWidth: 260,
                        }}>
                          {svc.endpoint_url}
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                          <span style={{ fontSize: 12, color }}>{label}</span>
                        </span>
                      </td>
                      <td className="mobile-hide" style={{ padding: '13px 16px', fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {upPct}
                      </td>
                      <td className="mobile-hide" style={{ padding: '13px 16px', fontSize: 13, fontFamily: 'var(--font-geist-mono)', color: 'var(--text-secondary)' }}>
                        {latMs != null ? (latMs < 1000 ? `${latMs}ms` : `${(latMs / 1000).toFixed(1)}s`) : '—'}
                      </td>
                      <td className="mobile-hide" style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {svc.last_checked_at ? formatRelative(svc.last_checked_at) : '—'}
                      </td>
                      <td className="mobile-hide" style={{ padding: '13px 16px' }}>
                        {openCnt > 0 ? (
                          <Link href="/incidents" style={{ fontSize: 12, color: 'var(--status-critical)', textDecoration: 'none' }}>
                            {openCnt} open
                          </Link>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
