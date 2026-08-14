import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--status-critical)',
  degraded: 'var(--status-degraded)',
};

const SEVERITY_BG: Record<string, string> = {
  critical: 'var(--status-critical-bg)',
  degraded: 'var(--status-degraded-bg)',
};

const STATUS_COLOR: Record<string, string> = {
  open: 'var(--status-critical)',
  acknowledged: 'var(--status-degraded)',
  resolved: 'var(--status-operational)',
};

const STATUS_BG: Record<string, string> = {
  open: 'var(--status-critical-bg)',
  acknowledged: 'var(--status-degraded-bg)',
  resolved: 'var(--status-operational-bg)',
};

type TimelineEvent = {
  event: string;
  at: string;
  actor: string;
  note?: string;
};

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: incident } = await supabase
    .from('incidents')
    .select(`
      id, service_id, severity, status, failure_stage, opened_at, resolved_at, acknowledged_at,
      timeline, resolution_type,
      services ( id, name, endpoint_url )
    `)
    .eq('id', id)
    .single();

  if (!incident) notFound();

  const svc = Array.isArray(incident.services) ? incident.services[0] : incident.services;
  const timeline = (incident.timeline as TimelineEvent[] | null) ?? [];

  const duration = incident.resolved_at
    ? formatDuration(incident.opened_at, incident.resolved_at)
    : null;

  // Find the check that triggered this incident: most recent failed/error check
  // for this service at or just before the incident opened.
  const openedAtMs = new Date(incident.opened_at).getTime();
  const windowStart = new Date(openedAtMs - 2 * 60 * 60 * 1000).toISOString(); // 2h before
  const windowEnd   = new Date(openedAtMs + 5 * 60 * 1000).toISOString();      // 5min after

  const { data: triggeringCheck } = await supabase
    .from('checks')
    .select('id, started_at, status, failure_stage, latency_ms')
    .eq('service_id', incident.service_id)
    .in('status', ['failed', 'error'])
    .gte('started_at', windowStart)
    .lte('started_at', windowEnd)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/incidents" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>← Incidents</Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            background: SEVERITY_BG[incident.severity] ?? 'transparent',
            color: SEVERITY_COLOR[incident.severity] ?? 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {incident.severity}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
            background: STATUS_BG[incident.status] ?? 'transparent',
            color: STATUS_COLOR[incident.status] ?? 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {incident.status}
          </span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          {svc?.name ?? 'Unknown service'}
        </h1>
        {svc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link href={`/services/${svc.id}`} style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', fontFamily: 'var(--font-geist-mono)' }}>
              {svc.endpoint_url}
            </Link>
            <Link
              href={`/services/${svc.id}`}
              style={{
                fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none',
                padding: '4px 10px', border: '1px solid var(--border-default)',
                borderRadius: 5, fontWeight: 500,
              }}
            >
              View service →
            </Link>
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 32 }}>
        <MetaCard label="Failed stage" value={incident.failure_stage} mono />
        <MetaCard label="Opened" value={formatRelative(incident.opened_at)} />
        <MetaCard
          label={incident.resolved_at ? 'Duration' : 'Ongoing for'}
          value={incident.resolved_at ? (duration ?? '—') : formatElapsed(incident.opened_at)}
        />
      </div>

      {/* Triggering check */}
      {triggeringCheck && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Triggering check
          </h2>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--status-critical-border)',
            borderRadius: 8, padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '2px 6px', borderRadius: 4,
                  background: triggeringCheck.status === 'failed' ? 'var(--status-critical-bg)' : 'var(--status-degraded-bg)',
                  color: triggeringCheck.status === 'failed' ? 'var(--status-critical)' : 'var(--status-degraded)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {triggeringCheck.status}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(triggeringCheck.started_at).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 2 }}>
                {triggeringCheck.failure_stage && (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Failed at <span style={{ fontFamily: 'var(--font-geist-mono)', color: 'var(--status-critical)' }}>{triggeringCheck.failure_stage}</span>
                  </span>
                )}
                {triggeringCheck.latency_ms != null && (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)' }}>
                    {triggeringCheck.latency_ms}ms
                  </span>
                )}
              </div>
            </div>
            {svc && (
              <Link
                href={`/services/${svc.id}`}
                style={{
                  fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none',
                  padding: '6px 12px', border: '1px solid var(--border-default)',
                  borderRadius: 5, fontWeight: 500, flexShrink: 0,
                }}
              >
                Inspect check →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <h2 style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Timeline
      </h2>

      {timeline.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
          No timeline events recorded.
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{
            position: 'absolute', left: 7, top: 8, bottom: 8,
            width: 1, background: 'var(--border-mid)',
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {timeline.map((evt, i) => {
              const isLast = i === timeline.length - 1;
              const dotColor = evt.event === 'resolved' ? 'var(--status-operational)'
                : evt.event === 'escalated' ? 'var(--status-critical)'
                : evt.event === 'opened' ? 'var(--status-degraded)'
                : 'var(--text-muted)';

              return (
                <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 24 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: dotColor, border: '2px solid var(--bg-page)',
                    flexShrink: 0, marginLeft: -21, marginTop: 2,
                    boxShadow: `0 0 6px ${dotColor}66`,
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {evt.event}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        {new Date(evt.at).toLocaleString()}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                        by {evt.actor}
                      </span>
                    </div>
                    {evt.note && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{evt.note}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resolution note */}
      {incident.resolved_at && (
        <div style={{
          marginTop: 24, background: 'var(--status-operational-bg)',
          border: '1px solid var(--status-operational-border)', borderRadius: 8,
          padding: '12px 16px', fontSize: 13, color: 'var(--status-operational)',
        }}>
          ✓ Resolved {formatRelative(incident.resolved_at)} — {incident.resolution_type ?? 'auto'}
        </div>
      )}
    </div>
  );
}

function MetaCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-mid)', borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-geist-mono)' : undefined }}>{value}</div>
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
