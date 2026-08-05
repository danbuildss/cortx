import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  degraded: '#f59e0b',
};

const STATUS_COLOR: Record<string, string> = {
  open: '#ef4444',
  acknowledged: '#f59e0b',
  resolved: '#22c55e',
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
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#f0f0f0', marginBottom: 4 }}>Incidents</h1>
      <p style={{ fontSize: 13, color: '#555', marginBottom: 32 }}>
        {open.length > 0 ? `${open.length} open` : 'All clear'} · {resolved.length} resolved
      </p>

      {/* Open incidents */}
      {open.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHeader>Open</SectionHeader>
          <IncidentTable incidents={open} />
        </section>
      )}

      {open.length === 0 && (
        <div style={{
          background: '#111', border: '1px solid #1f1f1f', borderRadius: 8,
          padding: '32px 24px', textAlign: 'center', marginBottom: 40,
        }}>
          <p style={{ fontSize: 13, color: '#555' }}>No open incidents — all services nominal.</p>
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
    <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1f1f1f' }}>
            {['Service', 'Severity', 'Status', 'Failed stage', 'Opened', 'Duration'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 500, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
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
              <tr key={inc.id} style={{ borderBottom: isLast ? 'none' : '1px solid #1a1a1a' }}>
                <td style={{ padding: '12px 16px' }}>
                  <Link href={`/incidents/${inc.id}`} style={{ color: '#f0f0f0', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>
                    {(() => { const svc = Array.isArray(inc.services) ? inc.services[0] : inc.services; return svc?.name ?? '—'; })()}
                  </Link>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 12, color: SEVERITY_COLOR[inc.severity] ?? '#888', fontWeight: 500 }}>
                    {inc.severity}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 12, color: STATUS_COLOR[inc.status] ?? '#888' }}>
                    {inc.status}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#888', fontFamily: 'var(--font-geist-mono)' }}>
                  {inc.failure_stage}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#555' }}>
                  {new Date(inc.opened_at).toLocaleString()}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#555' }}>
                  {inc.resolved_at ? duration : <span style={{ color: '#f59e0b' }}>{duration} ongoing</span>}
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
    <h2 style={{ fontSize: 13, fontWeight: 500, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
