import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--status-critical)',
  degraded: 'var(--status-degraded)',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'var(--status-critical-bg)',
  degraded: 'var(--status-degraded-bg)',
};

export default async function IncidentsPage() {
  const supabase = await createClient();

  const { data: incidents } = await supabase
    .from('incidents')
    .select(`
      id, severity, status, failure_stage, opened_at, resolved_at, acknowledged_at,
      services ( id, name, endpoint_url )
    `)
    .order('opened_at', { ascending: false })
    .limit(50);

  const open = incidents?.filter(i => i.status !== 'resolved') ?? [];
  const resolved = incidents?.filter(i => i.status === 'resolved') ?? [];

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Incidents</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {open.length > 0 ? `${open.length} open` : 'All clear'} · {resolved.length} resolved
          </p>
        </div>
        {open.length > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 600,
            padding: '4px 10px',
            background: 'var(--status-critical-bg)',
            color: 'var(--status-critical)',
            border: '1px solid var(--status-critical-border)',
            borderRadius: 6,
          }}>
            {open.length} active
          </span>
        )}
      </div>

      {/* Open incidents */}
      {open.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--status-critical)',
              boxShadow: '0 0 0 3px var(--status-critical-bg)',
            }} />
            <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-critical)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Open · {open.length}
            </h2>
          </div>
          <IncidentTable incidents={open} isOpen />
        </section>
      )}

      {open.length === 0 && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--status-operational-border)',
          borderRadius: 8, padding: '20px 24px', marginBottom: 40,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 14, color: 'var(--status-operational)' }}>✓</span>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No open incidents — all services nominal.</p>
        </div>
      )}

      {/* Resolved incidents */}
      {resolved.length > 0 && (
        <section>
          <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Resolved · {resolved.length}
          </h2>
          <IncidentTable incidents={resolved} isOpen={false} />
        </section>
      )}
    </div>
  );
}

type IncidentRow = {
  id: string;
  severity: string;
  status: string;
  failure_stage: string;
  opened_at: string;
  resolved_at: string | null;
  acknowledged_at: string | null;
  services: { id: string; name: string; endpoint_url: string }[] | { id: string; name: string; endpoint_url: string } | null;
};

function IncidentTable({ incidents, isOpen }: { incidents: IncidentRow[]; isOpen: boolean }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: `1px solid ${isOpen ? 'var(--status-critical-border)' : 'var(--border-mid)'}`,
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 0 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
              <th style={{ textAlign: 'left', padding: '10px 0 10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: 4 }}></th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Severity</th>
              <th className="mobile-hide" style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed at</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Opened</th>
              <th className="mobile-hide" style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((inc, i) => {
              const isLast = i === incidents.length - 1;
              const svc = Array.isArray(inc.services) ? inc.services[0] : inc.services;
              const elapsed = inc.resolved_at
                ? formatDuration(inc.opened_at, inc.resolved_at)
                : formatElapsed(inc.opened_at);
              return (
                <tr
                  key={inc.id}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                    background: isOpen ? 'var(--status-critical-bg)' : undefined,
                  }}
                >
                  {/* Severity stripe */}
                  <td style={{ padding: 0, width: 4 }}>
                    <div style={{
                      width: 3, height: '100%', minHeight: 48,
                      borderLeft: `3px solid ${SEVERITY_COLOR[inc.severity] ?? 'transparent'}`,
                      background: SEVERITY_BG[inc.severity] ?? 'transparent',
                    }} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/incidents/${inc.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
                      {svc?.name ?? '—'}
                    </Link>
                    {inc.status === 'acknowledged' && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--status-degraded)', background: 'var(--status-degraded-bg)', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
                        ACK
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '2px 7px', borderRadius: 4,
                      background: SEVERITY_BG[inc.severity] ?? 'transparent',
                      color: SEVERITY_COLOR[inc.severity] ?? 'var(--text-secondary)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)' }}>
                    {inc.failure_stage ?? '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatRelative(inc.opened_at)}
                  </td>
                  <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12 }}>
                    {inc.resolved_at
                      ? <span style={{ color: 'var(--text-muted)' }}>{elapsed}</span>
                      : <span style={{ color: 'var(--status-degraded)', fontWeight: 500 }}>{elapsed} ongoing</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

function formatElapsed(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatDuration(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d`;
}
