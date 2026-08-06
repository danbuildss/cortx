import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { StatusPageLink } from './_components/status-page-link';

const STATUS_COLORS: Record<string, string> = {
  operational: 'var(--status-operational)',
  degraded: 'var(--status-degraded)',
  critical: 'var(--status-critical)',
  unknown: 'var(--text-muted)',
};

const STATUS_LABELS: Record<string, string> = {
  operational: 'Operational',
  degraded: 'Degraded',
  critical: 'Critical',
  unknown: 'Unknown',
};

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: services } = await supabase
    .from('services')
    .select('id, name, endpoint_url, status, last_checked_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const { data: openIncidents } = await supabase
    .from('incidents')
    .select('id, service_id, status')
    .in('status', ['open', 'acknowledged']);

  const incidentsByService = new Map<string, number>();
  for (const inc of openIncidents ?? []) {
    incidentsByService.set(inc.service_id, (incidentsByService.get(inc.service_id) ?? 0) + 1);
  }

  const operationalCount = services?.filter(s => s.status === 'operational').length ?? 0;
  const degradedCount = services?.filter(s => s.status === 'degraded').length ?? 0;
  const criticalCount = services?.filter(s => s.status === 'critical').length ?? 0;
  const total = services?.length ?? 0;
  const openCount = openIncidents?.length ?? 0;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Overview</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email}</p>
        </div>
        <Link
          href="/services/new"
          style={{
            padding: '8px 16px', background: 'var(--text-primary)', color: 'var(--bg-page)',
            borderRadius: 6, fontSize: 13, fontWeight: 500, textDecoration: 'none',
          }}
        >
          Add service
        </Link>
      </div>

      {/* Top metrics strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <MetricCard label="Services" value={String(total)} />
        <MetricCard label="Operational" value={String(operationalCount)} accent="var(--status-operational)" />
        <MetricCard label="Open incidents" value={String(openCount)} accent={openCount > 0 ? 'var(--status-critical)' : undefined} />
        <MetricCard label="Issues" value={String(degradedCount + criticalCount)} accent={(degradedCount + criticalCount) > 0 ? 'var(--status-degraded)' : undefined} />
      </div>

      {/* Status page link */}
      {user && <StatusPageLink userId={user.id} />}

      {/* Summary cards */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
          <SummaryCard label="Operational" count={operationalCount} color="var(--status-operational)" total={total} />
          <SummaryCard label="Degraded" count={degradedCount} color="var(--status-degraded)" total={total} />
          <SummaryCard label="Critical" count={criticalCount} color="var(--status-critical)" total={total} />
        </div>
      )}

      {/* Services table */}
      {total === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
                <Th>Service</Th>
                <Th>Endpoint</Th>
                <Th>Status</Th>
                <Th>Last checked</Th>
                <Th>Incidents</Th>
              </tr>
            </thead>
            <tbody>
              {services?.map((svc, i) => {
                const openCnt = incidentsByService.get(svc.id) ?? 0;
                const isLast = i === (services.length - 1);
                return (
                  <tr
                    key={svc.id}
                    style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}
                  >
                    <Td>
                      <Link
                        href={`/services/${svc.id}`}
                        style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500, fontSize: 13 }}
                      >
                        {svc.name}
                      </Link>
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)', wordBreak: 'break-all' }}>
                        {svc.endpoint_url}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={svc.status ?? 'unknown'} />
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {svc.last_checked_at ? formatRelative(svc.last_checked_at) : '—'}
                      </span>
                    </Td>
                    <Td>
                      {openCnt > 0 ? (
                        <Link href="/incidents" style={{ fontSize: 12, color: 'var(--status-critical)', textDecoration: 'none' }}>
                          {openCnt} open
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: accent ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function SummaryCard({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{count}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>of {total} services</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  const label = STATUS_LABELS[status] ?? 'Unknown';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 12, color }}>{label}</span>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
      {children}
    </td>
  );
}

function EmptyState() {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>No services yet</div>
      <Link
        href="/services/new"
        style={{ fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', padding: '8px 16px', border: '1px solid var(--border-default)', borderRadius: 6 }}
      >
        Add your first service
      </Link>
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
