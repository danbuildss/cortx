import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--status-critical)',
  degraded: 'var(--status-degraded)',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'rgba(239,68,68,0.1)',
  degraded: 'rgba(245,158,11,0.1)',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'var(--status-critical)',
  acknowledged: 'var(--status-degraded)',
  resolved: 'var(--status-operational)',
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
    <div style={{ padding: '32px 40px', maxWidth: 960, margin: '0 auto' }}>
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
            background: 'rgba(239,68,68,0.1)',
            color: 'var(--status-critical)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 6,
          }}>
            {open.length} active
          </span>
        )}
      </div>

      {/* Open incidents */}
      {open.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHeader>Open</SectionHeader>
          <IncidentTable incidents={open} />
        </section>
      )}

      {open.length === 0 && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8,
          padding: '32px 24px', textAlign: 'center', marginBottom: 40,
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No open incidents — all services nominal.</p>
        </div>
      )}

      {/* Resolved incidents */}
      {resolved.length > 0 && (
        <section>
          <SectionHeader>Resolved</SectionHeader>
          <IncidentTable incidents={resolved} />
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

function IncidentTable({ incidents }: { incidents: IncidentRow[] }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
            {['', 'Service', 'Severity', 'Status', 'Failed stage', 'Opened', 'Duration'].map((h, idx) => (
              <th key={idx} style={{
                textAlign: 'left',
                padding: h === '' ? '10px 0 10px 16px' : '10px 16px',
                fontSize: 11, fontWeight: 500,
                color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                width: h === '' ? 4 : undefined,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {incidents.map((inc, i) => {
            const isLast = i === incidents.length - 1;
            const duration = inc.resolved_at
              ? formatDuration(inc.opened_at, inc.resolved_at)
              : formatRelative(inc.opened_at);
            return (
              <tr key={inc.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                {/* Severity stripe */}
                <td style={{ padding: 0, width: 4 }}>
                  <div style={{
                    width: 3, height: '100%', minHeight: 48,
                    background: SEVERITY_BG[inc.severity] ?? 'transparent',
                    borderLeft: `3px solid ${SEVERITY_COLOR[inc.severity] ?? 'transparent'}`,
                  }} />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Link href={`/incidents/${inc.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
                    {(() => { const svc = Array.isArray(inc.services) ? inc.services[0] : inc.services; return svc?.name ?? '—'; })()}
                  </Link>
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
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 12, color: STATUS_COLOR[inc.status] ?? 'var(--text-secondary)' }}>
                    {inc.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)' }}>
                  {inc.failure_stage}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(inc.opened_at).toLocaleString()}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12 }}>
                  {inc.resolved_at
                    ? <span style={{ color: 'var(--text-muted)' }}>{duration}</span>
                    : <span style={{ color: 'var(--status-degraded)' }}>{duration} ongoing</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </h2>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
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
